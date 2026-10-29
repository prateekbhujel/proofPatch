<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Agent\SingleUseReviewApproval;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class IssueWorkbenchReplayAndConcurrencyIntegrationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    private string $tempDir;
    private string $approvalsDir;
    private string $budgetDir;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();

        $this->tempDir = sys_get_temp_dir() . '/proofpatch_wb_replay_' . bin2hex(random_bytes(6));
        $this->approvalsDir = $this->tempDir . '/approvals';
        $this->budgetDir = $this->tempDir . '/budget';

        @mkdir($this->approvalsDir, 0700, true);
        @mkdir($this->budgetDir, 0700, true);

        putenv('PROOFPATCH_APPROVALS_DIR=' . $this->approvalsDir);

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        $this->teardownIsolatedDatabase();

        putenv('PROOFPATCH_APPROVALS_DIR');

        if (is_dir($this->tempDir)) {
            $it = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->tempDir, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($it as $item) {
                $item->isDir() && !$item->isLink() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
            }
            @rmdir($this->tempDir);
        }
        $_SESSION = [];

        @restore_error_handler();
        @restore_exception_handler();
    }

    private function createDedicatedContext(): array
    {
        $fixturePath = dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case';
        $srcFile = $fixturePath . '/src/OrderTotal.php';
        $source = (string) file_get_contents($srcFile);

        return [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Zero-quantity order items incorrectly charged once',
            'body' => 'In OrderTotal::calculate, max(1, quantity) is used.',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];
    }

    private function mockModelResponse(): array
    {
        return [
            'model' => 'meta-models/muse-spark-open-1026',
            'choices' => [
                [
                    'finish_reason' => 'stop',
                    'message' => [
                        'content' => json_encode([
                            'explanation' => 'Fix zero-quantity item calculation in OrderTotal.',
                            'find' => "max(1, \$item['quantity'])",
                            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                            'replace' => "\$item['quantity']",
                        ], JSON_THROW_ON_ERROR),
                    ],
                ],
            ],
            'usage' => [
                'prompt_tokens' => 500,
                'completion_tokens' => 300,
            ],
        ];
    }

    private function authorizePublicContext(Request $request): void
    {
        $repo = \ProofPatch\GitHub\DedicatedTestRepo::requireName();
        $request->session()->put('github_auth.repositories', [['fullName' => $repo, 'isPrivate' => false]]);
        $request->attributes->set('proofpatch_github_access', [
            'userId' => 1, 'repositories' => [strtolower($repo) => true],
        ]);
    }

    private function mockPublicContextAndModel(array $context): MockHttpClient
    {
        return new MockHttpClient(function (string $method, string $url) use ($context): MockResponse {
            if ($method === 'POST') {
                return new MockResponse(json_encode($this->mockModelResponse()));
            }
            $path = (string) parse_url($url, PHP_URL_PATH);
            if (str_ends_with($path, '/commits/main')) {
                return new MockResponse(json_encode(['sha' => $context['commit']]));
            }
            if (str_ends_with($path, '/issues/1')) {
                return new MockResponse(json_encode(['number' => 1, 'title' => $context['title'], 'body' => $context['body']]));
            }
            if (str_ends_with($path, '/contents/src/OrderTotal.php')) {
                return new MockResponse(json_encode(['type' => 'file', 'path' => $context['path'], 'encoding' => 'base64',
                    'size' => strlen($context['source']), 'content' => base64_encode($context['source'])]));
            }
            return new MockResponse(json_encode(['private' => false, 'visibility' => 'public',
                'default_branch' => 'main', 'full_name' => $context['repository']]));
        });
    }

    public function testShowGeneratesSingleUseApprovalTokenBoundToPreview(): void
    {
        $session = app('session')->driver('array');
        $context = $this->createDedicatedContext();
        $session->put('issue_context', $context);
        $session->put('issue_is_dedicated_test_repo', true);
        $session->put('github_auth', ['token' => 'gho_dummy_token_for_tests_1234567890']);

        $budget = new RequestBudget($this->budgetDir, 500000, 10);
        $approvalStore = new SingleUseReviewApproval($this->approvalsDir);
        $controller = new IssueWorkbenchController(
            customBudget: $budget,
            customApprovals: $approvalStore
        );

        $showRequest = Request::create('/issues', 'GET');
        $showRequest->setLaravelSession($session);
        $this->authorizePublicContext($showRequest);

        $response = $controller->show($showRequest);
        $props = $response->toResponse($showRequest)->getOriginalContent()->getData()['page']['props'];

        self::assertNotNull($props['preview']);
        self::assertArrayHasKey('approvalToken', $props['preview']);
        $token = $props['preview']['approvalToken'];
        self::assertIsString($token);
        self::assertSame(64, strlen($token));

        // Verify token exists in approval store on disk
        $tokenFile = $this->approvalsDir . '/' . $token . '.json';
        self::assertFileExists($tokenFile);
        $record = json_decode((string) file_get_contents($tokenFile), true);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::name(), $record['repository']);
        self::assertSame(1, $record['pullNumber']);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(), $record['headSha']);
        self::assertSame($props['preview']['digest'], $record['digest']);
        self::assertFalse($record['consumed']);
    }

    public function testLiveModelProposalFailsClosedWithoutApprovalToken(): void
    {
        $session = app('session')->driver('array');
        $context = $this->createDedicatedContext();
        $session->put('issue_context', $context);
        $session->put('issue_is_dedicated_test_repo', true);
        $session->put('github_auth', ['token' => 'gho_dummy_token_for_tests_1234567890']);

        $budget = new RequestBudget($this->budgetDir, 500000, 10);
        $approvalStore = new SingleUseReviewApproval($this->approvalsDir);

        // Mock Baseten HTTP client to simulate live model provider response
        $mockHttp = $this->mockPublicContextAndModel($context);

        $controller = new IssueWorkbenchController(
            http: $mockHttp,
            customBudget: $budget,
            customRunner: null,
            customApprovals: $approvalStore
        );

        // Preview to get digest
        $preview = (new IssueSuggestion($mockHttp, $budget))->preview($context);

        // Set dummy Baseten credentials in environment
        $oldKey = getenv('BASETEN_API_KEY');
        putenv('BASETEN_API_KEY=test_baseten_key_live_mock_12345678');

        try {
            // Attempt to propose WITHOUT approval_token
            $proposeRequest = Request::create('/issues/propose', 'POST', [
                'approved' => true,
                'digest' => $preview['digest'],
                // Missing approval_token!
            ]);
            $proposeRequest->setLaravelSession($session);
            $this->authorizePublicContext($proposeRequest);

            $response = $controller->propose($proposeRequest);
            self::assertTrue($response->isRedirection());

            // Must redirect with error in session
            $flashError = (string) ($response->getSession()?->get('error') ?? $session->get('error'));
            self::assertNotEmpty($flashError);
            self::assertStringContainsString('approval token is required', $flashError);

            // Zero suggestions stored
            self::assertNull($session->get('issue_suggestion'));

            // Budget ledger must have zero attempts consumed
            $budgetStatus = $budget->status();
            self::assertSame(0, $budgetStatus['attempts']);
        } finally {
            if ($oldKey !== false) {
                putenv('BASETEN_API_KEY=' . $oldKey);
            } else {
                putenv('BASETEN_API_KEY');
            }
        }
    }

    public function testLiveModelProposalRejectsReplayOfConsumedToken(): void
    {
        $session = app('session')->driver('array');
        $context = $this->createDedicatedContext();
        $session->put('issue_context', $context);
        $session->put('issue_is_dedicated_test_repo', true);
        $session->put('github_auth', ['token' => 'gho_dummy_token_for_tests_1234567890']);

        $budget = new RequestBudget($this->budgetDir, 500000, 10);
        $approvalStore = new SingleUseReviewApproval($this->approvalsDir);

        $mockHttp = $this->mockPublicContextAndModel($context);

        $controller = new IssueWorkbenchController(
            http: $mockHttp,
            customBudget: $budget,
            customRunner: null,
            customApprovals: $approvalStore
        );

        // Step 1: Issue token
        $preview = (new IssueSuggestion($mockHttp, $budget))->preview($context);
        $approval = $approvalStore->issue(
            \ProofPatch\GitHub\DedicatedTestRepo::name(),
            1,
            \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            $preview['digest']
        );
        $token = $approval['token'];

        $oldKey = getenv('BASETEN_API_KEY');
        putenv('BASETEN_API_KEY=test_baseten_key_live_mock_12345678');

        try {
            // First request: valid token -> MUST SUCCEED
            $req1 = Request::create('/issues/propose', 'POST', [
                'approved' => true,
                'digest' => $preview['digest'],
                'approval_token' => $token,
            ]);
            $req1->setLaravelSession($session);
            $this->authorizePublicContext($req1);
            $res1 = $controller->propose($req1);
            self::assertTrue($res1->isRedirection());
            self::assertNull($res1->getSession()?->get('error'));

            $suggestion = $session->get('issue_suggestion');
            self::assertIsArray($suggestion);
            self::assertSame('meta-models/muse-spark-open-1026', $suggestion['model']);

            // Budget ledger recorded exactly 1 attempt
            $budgetStatus = $budget->status();
            self::assertSame(1, $budgetStatus['attempts']);

            // Step 2: Second request (Replay attack with same token) -> MUST FAIL CLOSED
            $req2 = Request::create('/issues/propose', 'POST', [
                'approved' => true,
                'digest' => $preview['digest'],
                'approval_token' => $token,
            ]);
            $req2->setLaravelSession($session);
            $this->authorizePublicContext($req2);
            $res2 = $controller->propose($req2);
            self::assertTrue($res2->isRedirection());

            $flashError = (string) ($res2->getSession()?->get('error') ?? $session->get('error'));
            self::assertNotEmpty($flashError);
            self::assertStringContainsString('already been consumed', $flashError);

            // Crucial: Budget ledger must STILL be 1 (no second attempt or charge occurred!)
            $budgetStatusAfterReplay = $budget->status();
            self::assertSame(1, $budgetStatusAfterReplay['attempts']);
        } finally {
            if ($oldKey !== false) {
                putenv('BASETEN_API_KEY=' . $oldKey);
            } else {
                putenv('BASETEN_API_KEY');
            }
        }
    }

    public function testConcurrentConsumptionOfSameApprovalTokenExecutesExactlyOnce(): void
    {
        $approvalStore = new SingleUseReviewApproval($this->approvalsDir);
        $digest = hash('sha256', 'test-concurrency-digest');

        $approval = $approvalStore->issue(
            \ProofPatch\GitHub\DedicatedTestRepo::name(),
            1,
            \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            $digest
        );
        $token = $approval['token'];

        // Two racing consumers attempting to consume the same token
        $successCount = 0;
        $failCount = 0;

        try {
            $approvalStore->consume(
                $token,
                \ProofPatch\GitHub\DedicatedTestRepo::name(),
                1,
                \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
                $digest
            );
            $successCount++;
        } catch (\Throwable) {
            $failCount++;
        }

        try {
            $approvalStore->consume(
                $token,
                \ProofPatch\GitHub\DedicatedTestRepo::name(),
                1,
                \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
                $digest
            );
            $successCount++;
        } catch (\Throwable) {
            $failCount++;
        }

        self::assertSame(1, $successCount, 'Exactly one concurrent consumption must succeed.');
        self::assertSame(1, $failCount, 'The duplicate consumption must fail closed.');
    }

    public function testOfflineFallbackWorksDeterministicallyWhenBudgetIsExhausted(): void
    {
        $session = app('session')->driver('array');
        $context = $this->createDedicatedContext();
        $session->put('issue_context', $context);
        $session->put('issue_is_dedicated_test_repo', true);
        $session->put('github_auth', ['token' => 'gho_dummy_token_for_tests_1234567890']);

        // Budget with 1 attempt limit, pre-exhausted
        $budget = new RequestBudget($this->budgetDir, 500000, 1);
        $budget->run(10000, fn() => ['usage' => ['prompt_tokens' => 10, 'completion_tokens' => 10]]);

        self::assertFalse($budget->status()['canRequest'], 'Budget must be exhausted.');

        $approvalStore = new SingleUseReviewApproval($this->approvalsDir);
        $mockHttp = new MockHttpClient();
        $controller = new IssueWorkbenchController(
            http: $mockHttp,
            customBudget: $budget,
            customRunner: null,
            customApprovals: $approvalStore
        );

        $preview = (new IssueSuggestion($mockHttp, $budget))->preview($context);

        $req = Request::create('/issues/propose', 'POST', [
            'approved' => true,
            'digest' => $preview['digest'],
        ]);
        $req->setLaravelSession($session);
        $res = $controller->propose($req);
        self::assertTrue($res->isRedirection());
        self::assertNull($res->getSession()?->get('error'));

        $suggestion = $session->get('issue_suggestion');
        self::assertIsArray($suggestion);
        self::assertTrue($suggestion['isOfflineExample']);
        self::assertNull($suggestion['model']);
        self::assertNull($suggestion['usage']);

        // Budget ledger must remain at exactly 1 attempt (the pre-exhausted one); no extra attempt charged
        $budgetStatus = $budget->status();
        self::assertSame(1, $budgetStatus['attempts']);
    }
}
