<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\DedicatedTestRepo;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\GitHubAppClient;
use ProofPatch\GitHub\ManualInlineCommentPublisher;
use ProofPatch\Http\Controllers\DashboardController;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Http\Controllers\LocalTaskCardController;
use ProofPatch\Http\Controllers\LocalTaskImageController;
use ProofPatch\Http\Controllers\ManualInlineCommentController;
use ProofPatch\Http\Middleware\AuthorizeGithubTasks;
use ProofPatch\Models\LocalTaskCard;
use ProofPatch\Models\WorkbenchTask;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/**
 * End-to-end integration test verifying the complete ProofPatcher workflow:
 * 1. Create task card with repository, description, and attached screenshot.
 * 2. Assign task to Muse; verify private text/screenshots stay local.
 * 3. Generate proposal preview with budget controls and request proposal.
 * 4. Run 5-gate verifier, producing cryptographic receipt and publication authorization.
 * 5. Publish draft PR to dedicated test repo (no auto-merge) and verify UI status binding.
 * 6. Capture private test PR, draft line-anchored review comment, and approve posting.
 */
final class EndToEndTaskToDraftPrIntegrationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    private string|false $previousRepo;
    private string|false $previousBaseCommit;
    private string $tempHome;
    private string $dedicatedRepo = 'owner/dedicated-workflow-test';
    private string $baseCommit;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();

        $this->previousRepo = getenv('PROOFPATCH_TEST_REPO');
        $this->previousBaseCommit = getenv('PROOFPATCH_TEST_BASE_COMMIT');

        $this->baseCommit = str_repeat('d', 40);
        putenv('PROOFPATCH_TEST_REPO=' . $this->dedicatedRepo);
        putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $this->baseCommit);
        putenv('BASETEN_API_KEY'); // Preserves Meta/Baseten credits

        $this->tempHome = sys_get_temp_dir() . '/proofpatch_e2e_' . bin2hex(random_bytes(6));
        mkdir($this->tempHome, 0700, true);
        putenv('HOME=' . $this->tempHome);

        config(['session.driver' => 'array']);
    }

    protected function tearDown(): void
    {
        $this->previousRepo === false ? putenv('PROOFPATCH_TEST_REPO') : putenv('PROOFPATCH_TEST_REPO=' . $this->previousRepo);
        $this->previousBaseCommit === false ? putenv('PROOFPATCH_TEST_BASE_COMMIT') : putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $this->previousBaseCommit);

        if (is_dir($this->tempHome)) {
            $it = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->tempHome, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($it as $item) {
                $item->isDir() && !$item->isLink() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
            }
            @rmdir($this->tempHome);
        }

        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function createSession(): \Illuminate\Session\Store
    {
        $session = app('session')->driver('array');
        $session->put('github_auth', [
            'token' => 'gho_authenticated_mock_token_12345',
            'user' => ['id' => 1, 'login' => 'test-owner'],
            'repositories' => [
                ['fullName' => $this->dedicatedRepo, 'isPrivate' => false],
            ],
        ]);
        app('redirect')->setSession($session);
        return $session;
    }

    private function createMiddleware(int $userId = 1): AuthorizeGithubTasks
    {
        $mockClient = new MockHttpClient(function (string $method, string $url): MockResponse {
            $path = parse_url($url, PHP_URL_PATH);
            if ($path === '/user') {
                return new MockResponse(json_encode(['id' => 1, 'login' => 'test-owner']));
            }
            if ($path === '/user/installations') {
                return new MockResponse(json_encode(['installations' => [['id' => 42]]]));
            }
            if ($path === '/user/installations/42/repositories') {
                return new MockResponse(json_encode(['repositories' => [
                    ['id' => 101, 'name' => 'dedicated-workflow-test', 'full_name' => $this->dedicatedRepo, 'private' => false, 'owner' => ['login' => 'owner']],
                ]]));
            }
            throw new \RuntimeException("Unexpected HTTP call to {$method} {$url}");
        });
        return new AuthorizeGithubTasks(new GitHubAppClient($mockClient));
    }

    public function testCompleteTicketToMuseToVerifierToDraftPrPath(): void
    {
        $session = $this->createSession();
        $middleware = $this->createMiddleware(1);

        // =========================================================================
        // STEP 1: Create a task card in ProofPatcher with description and screenshot
        // =========================================================================
        $createRequest = Request::create('/issues/tasks', 'POST', [
            'title' => 'Fix order total calculation for zero quantity items',
            'description' => "Private customer report: When an order contains zero items, OrderTotal charged for 1 item.\nReproduction note: tests/order_total.php fails.",
            'repository' => $this->dedicatedRepo,
        ]);
        $createRequest->setLaravelSession($session);
        $middleware->handle($createRequest, fn (Request $req) => (new LocalTaskCardController())->store($req));

        self::assertSame(1, LocalTaskCard::count());
        $card = LocalTaskCard::firstOrFail();
        self::assertSame('Fix order total calculation for zero quantity items', $card->title);
        self::assertSame('queued', $card->status);
        self::assertSame(strtolower($this->dedicatedRepo), $card->repository);

        // Upload a 1x1 PNG screenshot
        $png1x1 = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        $tmpImage = tempnam(sys_get_temp_dir(), 'test_img_') . '.png';
        file_put_contents($tmpImage, $png1x1);
        $uploadedFile = new UploadedFile($tmpImage, 'bug_screenshot.png', 'image/png', null, true);

        $uploadRequest = Request::create("/issues/tasks/{$card->id}/image", 'POST', [], [], ['image' => $uploadedFile]);
        $uploadRequest->setLaravelSession($session);
        $middleware->handle($uploadRequest, fn (Request $req) => (new LocalTaskImageController())->store($req, (int) $card->id));
        @unlink($tmpImage);

        $card->refresh();
        self::assertTrue($card->image_mime !== null);
        self::assertSame('image/png', $card->image_mime);

        // Verify screenshot is served with strict no-store headers
        $imgRequest = Request::create("/issues/tasks/{$card->id}/image", 'GET');
        $imgRequest->setLaravelSession($session);
        $imgResponse = $middleware->handle($imgRequest, fn (Request $req) => (new LocalTaskImageController())->show($req, (int) $card->id));
        self::assertSame(200, $imgResponse->getStatusCode());
        self::assertSame('image/png', $imgResponse->headers->get('Content-Type'));
        self::assertStringContainsString('no-store', (string) $imgResponse->headers->get('Cache-Control'));

        // =========================================================================
        // STEP 2: Assign task card to Muse; verify private text/screenshots stay local
        // =========================================================================
        $assignRequest = Request::create("/issues/tasks/{$card->id}/assign", 'POST');
        $assignRequest->setLaravelSession($session);
        $middleware->handle($assignRequest, fn (Request $req) => (new LocalTaskCardController())->assign($req, (int) $card->id));

        $card->refresh();
        self::assertSame('in_progress', $card->status);
        self::assertNotNull($card->workbench_task_id);

        // Verify session now holds active issue context
        $context = $session->get('issue_context');
        self::assertIsArray($context);
        self::assertSame('src/OrderTotal.php', $context['path']);
        self::assertSame($this->dedicatedRepo, $context['repository']);

        // CRITICAL PRIVACY INVARIANT: Private task description and screenshots NEVER enter model context
        self::assertStringNotContainsString('Private customer report', json_encode($context));
        self::assertStringNotContainsString('bug_screenshot', json_encode($context));

        // Verify WorkbenchTask is linked to LocalTaskCard
        $workbenchTask = WorkbenchTask::findOrFail($card->workbench_task_id);
        self::assertSame('in_progress', $workbenchTask->status);
        self::assertSame($card->id, $workbenchTask->metadata['local_task_card_id'] ?? null);

        // =========================================================================
        // STEP 3: Generate proposal (using offline reference mode to preserve credits)
        // =========================================================================
        $showRequest = Request::create('/issues', 'GET');
        $showRequest->setLaravelSession($session);
        $middleware->handle($showRequest, static fn () => new \Illuminate\Http\Response());

        $workbenchController = new IssueWorkbenchController();
        $showResponse = $workbenchController->show($showRequest);
        $props = $showResponse->toResponse($showRequest)->getOriginalContent()->getData()['page']['props'];

        self::assertNotNull($props['preview']);
        self::assertNotEmpty($props['preview']['digest']);
        self::assertStringNotContainsString('Private customer report', json_encode($props['preview']));

        // User reviews exact preview and approves proposal request
        $proposeRequest = Request::create('/issues/propose', 'POST', [
            'approved' => true,
            'digest' => $props['preview']['digest'],
        ]);
        $proposeRequest->setLaravelSession($session);
        $middleware->handle($proposeRequest, fn (Request $req) => $workbenchController->propose($req));

        $suggestion = $session->get('issue_suggestion');
        self::assertIsArray($suggestion);
        self::assertSame('offline_reference_example', $suggestion['status']);
        self::assertStringContainsString("max(1, \$item['quantity'])", $suggestion['find']);
        self::assertStringContainsString("\$item['quantity']", $suggestion['replace']);
        self::assertStringContainsString('not security sandboxes', $suggestion['safetyNotice']);

        $card->refresh();
        self::assertSame('in_progress', $card->status);

        // =========================================================================
        // STEP 4A: Verifier on Host Runner fails closed on draft PR publication
        // =========================================================================
        $verifyRequest = Request::create('/issues/verify', 'POST');
        $verifyRequest->setLaravelSession($session);
        $middleware->handle($verifyRequest, fn (Request $req) => $workbenchController->verifyCandidate($req));

        $hostReport = $session->get('issue_verification_report');
        self::assertIsArray($hostReport);
        self::assertSame('VERIFIED', $hostReport['decision']);
        self::assertSame('VALID', $hostReport['receipt']['integrity']);
        self::assertTrue($hostReport['isSimulated']); // Host execution is marked simulated

        // Attempting publication of host/simulated run fails closed
        $blockedPublishRequest = Request::create('/issues/publish-pr', 'POST');
        $blockedPublishRequest->setLaravelSession($session);
        $middleware->handle($blockedPublishRequest, fn (Request $req) => $workbenchController->publishDraftPr($req));
        self::assertStringContainsString('mock/simulated runner', (string) $session->get('error'));

        // =========================================================================
        // STEP 4B: Verifier with Genuine MicroVM Runner produces publishable token
        // =========================================================================
        $genuineRunner = new class implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function isAvailable(): array {
                return ['available' => true, 'runner' => 'modal', 'isGenuineProvider' => true];
            }
            public function runIsolated(string $src, string $harness, string $path = 'src/OrderTotal.php', int $timeout = 30): array {
                if (str_contains($src, 'max(1,')) {
                    return [
                        'exitCode' => 1, 'output' => "zero quantity: expected 250, got 750\n",
                        'oracleVerified' => false, 'sandboxId' => 'sb-genuine-base', 'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true, 'networkBlocked' => true, 'credentialsMounted' => false, 'isolated' => true,
                    ];
                }
                if (str_contains($src, 'return 0;')) {
                    return [
                        'exitCode' => 1, 'output' => "multiple items: expected 330, got 0\n",
                        'oracleVerified' => false, 'sandboxId' => 'sb-genuine-neg', 'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true, 'networkBlocked' => true, 'credentialsMounted' => false, 'isolated' => true,
                    ];
                }
                return [
                    'exitCode' => 0, 'output' => "All order total cases passed.\n",
                    'oracleVerified' => true, 'truncated' => false, 'timedOut' => false, 'durationMs' => 45,
                    'sandboxId' => 'sb-genuine-cand', 'runnerType' => 'modal-microvm', 'genuineProviderEvidence' => true,
                    'networkBlocked' => true, 'credentialsMounted' => false, 'isolated' => true,
                ];
            }
        };

        $isolatedWorkbenchController = new IssueWorkbenchController(customRunner: $genuineRunner);
        $verifyIsoRequest = Request::create('/issues/verify', 'POST');
        $verifyIsoRequest->setLaravelSession($session);
        $middleware->handle($verifyIsoRequest, fn (Request $req) => $isolatedWorkbenchController->verifyCandidate($req));

        $report = $session->get('issue_verification_report');
        self::assertIsArray($report);
        self::assertSame('VERIFIED', $report['decision']);
        self::assertFalse($report['isSimulated']); // Genuine microVM run
        self::assertTrue($report['gates']['baselineReproduced']);
        self::assertTrue($report['gates']['negativeControlCaught']);
        self::assertTrue($report['gates']['candidatePassed']);
        self::assertTrue($report['gates']['candidateStaticSafetyPassed']);
        self::assertTrue($report['gates']['allowlistIntegrityIntact']);
        self::assertSame('VALID', $report['receipt']['integrity']);
        self::assertNotEmpty($report['receipt']['sha256']);

        // Server-held publication authorization token issued
        $pubToken = $session->get('issue_publication_token');
        self::assertIsString($pubToken);
        self::assertSame(64, strlen($pubToken));

        $card->refresh();
        self::assertSame('needs_review', $card->status);

        // =========================================================================
        // STEP 5: Publish Draft PR to Dedicated Test Repo; verify status binding
        // =========================================================================
        $mockGitHubResponses = [
            // 1. GET git/ref/heads/main
            new MockResponse(json_encode(['object' => ['sha' => $this->baseCommit]])),
            // 2. GET git/commits/{baseSha}
            new MockResponse(json_encode(['tree' => ['sha' => str_repeat('1', 40)]])),
            // 3. POST git/blobs
            new MockResponse(json_encode(['sha' => str_repeat('2', 40)])),
            // 4. POST git/trees
            new MockResponse(json_encode(['sha' => str_repeat('3', 40)])),
            // 5. POST git/commits
            new MockResponse(json_encode(['sha' => str_repeat('4', 40)])),
            // 6. POST git/refs
            new MockResponse(json_encode(['ref' => 'refs/heads/proofpatch/issue-1-run-' . $report['id']])),
            // 7. POST pulls (creates draft PR)
            new MockResponse(json_encode([
                'number' => 88,
                'html_url' => 'https://github.com/' . $this->dedicatedRepo . '/pull/88',
                'draft' => true,
            ])),
        ];

        $mockHttp = new MockHttpClient($mockGitHubResponses);
        $publishingWorkbenchController = new IssueWorkbenchController($mockHttp);

        $publishRequest = Request::create('/issues/publish-pr', 'POST');
        $publishRequest->setLaravelSession($session);
        $middleware->handle($publishRequest, fn (Request $req) => $publishingWorkbenchController->publishDraftPr($req));

        $publishedPr = $session->get('issue_published_pr');
        self::assertIsArray($publishedPr);
        self::assertSame(88, $publishedPr['prNumber']);
        self::assertTrue($publishedPr['draft']);
        self::assertSame('https://github.com/' . $this->dedicatedRepo . '/pull/88', $publishedPr['prUrl']);
        self::assertSame($report['receipt']['sha256'], $publishedPr['receiptSha256']);

        // Publication token is consumed (single use)
        self::assertNull($session->get('issue_publication_token'));

        // Local task card lifecycle reaches completed
        $card->refresh();
        self::assertSame('completed', $card->status);

        // Verify final UI props accurately reflect completed status and proof evidence
        $finalShowRequest = Request::create('/issues', 'GET');
        $finalShowRequest->setLaravelSession($session);
        $middleware->handle($finalShowRequest, static fn () => new \Illuminate\Http\Response());
        $finalProps = $workbenchController->show($finalShowRequest)->toResponse($finalShowRequest)->getOriginalContent()->getData()['page']['props'];

        self::assertNotNull($finalProps['publishedPr']);
        self::assertSame(88, $finalProps['publishedPr']['prNumber']);
        self::assertSame('completed', $finalProps['localTasks'][0]['status']);
    }

    public function testPrReviewPathWithLineAnchoredCommentApproval(): void
    {
        $session = app('session')->driver('array');
        $session->put('github_auth', [
            'token' => 'mock-token',
            'user' => ['id' => 1, 'login' => 'owner'],
            'repositories' => [
                ['fullName' => $this->dedicatedRepo, 'isPrivate' => true],
            ],
        ]);
        app('redirect')->setSession($session);

        $mockClient = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            $path = parse_url($url, PHP_URL_PATH);
            if ($method === 'GET' && $path === '/user') {
                return new MockResponse(json_encode(['id' => 1, 'login' => 'owner']));
            }
            if ($method === 'GET' && $path === '/user/installations') {
                return new MockResponse(json_encode(['installations' => [['id' => 42]]]));
            }
            if ($method === 'GET' && $path === '/user/installations/42/repositories') {
                return new MockResponse(json_encode(['repositories' => [[
                    'id' => 101, 'name' => 'dedicated-workflow-test', 'full_name' => $this->dedicatedRepo,
                    'owner' => ['login' => 'owner'], 'private' => true,
                ]]]));
            }
            if ($method === 'GET' && $path === '/repos/' . $this->dedicatedRepo . '/pulls/83') {
                return new MockResponse(json_encode([
                    'number' => 83, 'title' => 'Fix discount calculation', 'state' => 'open', 'changed_files' => 1,
                    'head' => ['sha' => str_repeat('a', 40), 'ref' => 'fix-discount'],
                    'base' => ['sha' => str_repeat('b', 40), 'ref' => 'main', 'repo' => ['private' => true]],
                    'user' => ['login' => 'owner'],
                ]));
            }
            if ($method === 'GET' && $path === '/repos/' . $this->dedicatedRepo . '/pulls/83/files') {
                return new MockResponse(json_encode([[
                    'filename' => 'src/OrderTotal.php',
                    'patch' => "@@ -1,2 +1,3 @@\n <?php\n // line 2\n+// line 3 added",
                ]]));
            }
            if ($method === 'POST' && $path === '/repos/' . $this->dedicatedRepo . '/pulls/83/comments') {
                $body = json_decode($options['body'], true, 16, JSON_THROW_ON_ERROR);
                self::assertSame('Line anchored review: looks safe and verified.', $body['body']);
                return new MockResponse(json_encode(['id' => 999]), ['http_code' => 201]);
            }
            throw new \RuntimeException("Unexpected HTTP call to {$method} {$url}");
        });

        $gitHubAppClient = new GitHubAppClient($mockClient);
        $middleware = new AuthorizeGithubTasks($gitHubAppClient);
        $dashboardController = new DashboardController($gitHubAppClient);

        // 1. Capture authorized private test PR
        $captureRequest = Request::create('/github/pulls/capture', 'POST', [
            'repository' => $this->dedicatedRepo,
            'number' => 83,
        ]);
        $captureRequest->setLaravelSession($session);
        $middleware->handle($captureRequest, fn (Request $req) => $dashboardController->captureInstalledPullRequest($req));

        $capturedPull = $session->get('pullRequest');
        self::assertIsArray($capturedPull);
        self::assertSame(83, $capturedPull['number']);
        self::assertTrue($capturedPull['isPrivate']);

        // 2. Draft line-anchored review comment
        $draftRequest = Request::create('/repositories/review/draft', 'POST', [
            'path' => 'src/OrderTotal.php',
            'line' => 3,
            'side' => 'RIGHT',
            'headSha' => str_repeat('a', 40),
            'comment' => 'Line anchored review: looks safe and verified.',
        ]);
        $draftRequest->setLaravelSession($session);
        $middleware->handle($draftRequest, fn (Request $req) => $dashboardController->saveDraftComment($req));

        $drafts = $session->get('review_drafts');
        self::assertIsArray($drafts);
        self::assertCount(1, $drafts);
        $draft = array_values($drafts)[0];
        self::assertSame('Line anchored review: looks safe and verified.', $draft['comment']);

        // 3. User reviews and approves posting the comment
        $digest = ManualInlineCommentPublisher::digest(
            1,
            $this->dedicatedRepo,
            83,
            str_repeat('a', 40),
            str_repeat('b', 40),
            $draft
        );

        $commentPublisher = new ManualInlineCommentPublisher($mockClient);
        $commentController = new ManualInlineCommentController($commentPublisher);

        $postCommentRequest = Request::create('/repositories/review/comment', 'POST', [
            'id' => $draft['id'],
            'digest' => $digest,
            'approved' => true,
        ]);
        $postCommentRequest->setLaravelSession($session);
        $middleware->handle($postCommentRequest, fn (Request $req) => $commentController->store($req));

        self::assertSame([], $session->get('review_drafts'));
        self::assertTrue($session->get('comment_posted'));

        // 4. Single-use replay protection: attempting to re-post the same digest fails closed
        $replayRequest = Request::create('/repositories/review/comment', 'POST', [
            'id' => $draft['id'],
            'digest' => $digest,
            'approved' => true,
        ]);
        $replayRequest->setLaravelSession($session);
        $middleware->handle($replayRequest, fn (Request $req) => $commentController->store($req));

        self::assertStringContainsString('Connect GitHub and approve the exact draft', (string) $session->get('review_error'));
    }
}
