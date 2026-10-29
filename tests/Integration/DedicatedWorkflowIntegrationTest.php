<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\DedicatedTestRepoFetcher;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Models\WorkbenchTask;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class DedicatedWorkflowIntegrationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    private string $tempStorageDir;
    private ?string $originalHome;
    private ?string $originalBasetenKey;
    private ?string $originalGithubToken;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();

        $this->originalHome = getenv('HOME') !== false ? (string) getenv('HOME') : null;
        $this->originalBasetenKey = getenv('BASETEN_API_KEY') !== false ? (string) getenv('BASETEN_API_KEY') : null;
        $this->originalGithubToken = getenv('GITHUB_TOKEN') !== false ? (string) getenv('GITHUB_TOKEN') : null;

        putenv('BASETEN_API_KEY');
        putenv('GITHUB_TOKEN');

        $this->tempStorageDir = sys_get_temp_dir() . '/proofpatch-test-' . bin2hex(random_bytes(6));
        mkdir($this->tempStorageDir, 0700, true);
        putenv('HOME=' . $this->tempStorageDir);

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        $this->teardownIsolatedDatabase();

        if ($this->originalHome !== null) {
            putenv('HOME=' . $this->originalHome);
        } else {
            putenv('HOME');
        }

        if ($this->originalBasetenKey !== null) {
            putenv('BASETEN_API_KEY=' . $this->originalBasetenKey);
        } else {
            putenv('BASETEN_API_KEY');
        }

        if ($this->originalGithubToken !== null) {
            putenv('GITHUB_TOKEN=' . $this->originalGithubToken);
        } else {
            putenv('GITHUB_TOKEN');
        }

        $this->removeDirectory($this->tempStorageDir);
        $_SESSION = [];
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }
        foreach (new \FilesystemIterator($path) as $file) {
            $file->isDir() && !$file->isLink() ? $this->removeDirectory($file->getPathname()) : @unlink($file->getPathname());
        }
        @rmdir($path);
    }

    private function createMockGitHubClient(?string $testOverride = null): MockHttpClient
    {
        $srcContent = (string) file_get_contents(dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case/src/OrderTotal.php');
        $testFixturePath = dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case/tests/order_total.php';
        $testContent = $testOverride ?? (string) file_get_contents($testFixturePath);

        return new MockHttpClient(function (string $method, string $url) use ($srcContent, $testContent): MockResponse {
            if (str_ends_with($url, '/issues/1')) {
                return new MockResponse(json_encode([
                    'number' => 1,
                    'state' => 'open',
                    'title' => 'Zero-quantity items inflate the order total',
                    'body' => 'When an order contains items with quantity 0, OrderTotal calculates with quantity 1.',
                ], JSON_THROW_ON_ERROR));
            }

            if (str_contains($url, '/contents/src/OrderTotal.php')) {
                return new MockResponse(json_encode([
                    'name' => 'OrderTotal.php',
                    'path' => 'src/OrderTotal.php',
                    'sha' => '54bc37fb2b005badcf309c5a7091ba6a2e704fc54c8eff9e9c7afee7e4054859',
                    'content' => base64_encode($srcContent),
                ], JSON_THROW_ON_ERROR));
            }

            if (str_contains($url, '/contents/tests/order_total.php')) {
                return new MockResponse(json_encode([
                    'name' => 'order_total.php',
                    'path' => 'tests/order_total.php',
                    'sha' => '263eb70cbf346221858b9c64ba97384105d3804089a653d63d016664e8c1320e',
                    'content' => base64_encode($testContent),
                ], JSON_THROW_ON_ERROR));
            }

            throw new \RuntimeException("Unexpected HTTP call to {$url} in test.");
        });
    }

    public function testDedicatedFetcherRejectsTamperedTestHarness(): void
    {
        $harnessPath = dirname(__DIR__) . '/Fixtures/owned-review-case/tests/order_total.php';
        $modified = (string) file_get_contents($harnessPath) . "\n// tampered\n";
        $fetcher = new DedicatedTestRepoFetcher($this->createMockGitHubClient($modified));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Test harness digest mismatch');
        $fetcher->fetchAndVerify('test-github-token');
    }

    public function testLoadDedicatedCaseInitializesSessionWithBoundMetadata(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        $request = Request::create('/issues/load-dedicated', 'POST');
        $request->setLaravelSession($session);

        $response = $controller->loadDedicatedCase($request);
        self::assertTrue($response->isRedirection());
        self::assertStringEndsWith('/issues', $response->getTargetUrl());

        $context = $session->get('issue_context');
        self::assertIsArray($context, (string) $session->get('error'));
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::name(), $context['repository']);
        self::assertSame(DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER, $context['issueNumber']);
        self::assertSame(DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH, $context['path']);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(), $context['commit']);
        self::assertSame(DedicatedTestRepoFetcher::EXPECTED_SOURCE_SHA256, $context['sourceSha256']);
        self::assertSame(\ProofPatch\Verifier\OwnedCaseVerifier::KNOWN_TEST_SHA256, $context['testSha256']);
        self::assertTrue($session->get('issue_is_dedicated_test_repo'));
        self::assertTrue($session->get('issue_is_owned_fixture'));
    }

    public function testVerifyDedicatedCaseProducesReportAndServerHeldToken(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        $loadReq = Request::create('/issues/load-dedicated', 'POST');
        $loadReq->setLaravelSession($session);
        $controller->loadDedicatedCase($loadReq);

        $context = $session->get('issue_context');
        $baseSource = $context['source'];
        $candidateSource = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $baseSource);

        $session->put('issue_suggestion', [
            'status' => 'offline_reference_example',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'sourceSha256' => $context['sourceSha256'],
            'model' => null,
            'candidate' => [
                'status' => 'unverified_in_memory_preview',
                'source' => $candidateSource,
                'sha256' => hash('sha256', $candidateSource),
                'applied' => false,
                'verified' => false,
            ],
        ]);
        WorkbenchTask::findByContext($context)->recordProposal($session->get('issue_suggestion'));

        $verifyReq = Request::create('/issues/verify', 'POST');
        $verifyReq->setLaravelSession($session);
        $verifyRes = $controller->verifyCandidate($verifyReq);

        self::assertTrue($verifyRes->isRedirection());
        self::assertStringEndsWith('/issues', $verifyRes->getTargetUrl());

        $report = $session->get('issue_verification_report');
        self::assertIsArray($report);
        self::assertSame('VERIFIED', $report['decision']);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(), $report['baseCommit']);
        self::assertTrue($report['gates']['baselineReproduced']);
        self::assertTrue($report['gates']['negativeControlCaught']);
        self::assertTrue($report['gates']['candidatePassed']);
        self::assertTrue($report['gates']['candidateStaticSafetyPassed']);
        self::assertTrue($report['gates']['allowlistIntegrityIntact']);

        $token = $session->get('issue_publication_token');
        self::assertIsString($token);
        self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $token);
    }

    public function testPublishDraftPrFailsClosedInDisconnectedSafetyMode(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        // Load case
        $loadReq = Request::create('/issues/load-dedicated', 'POST');
        $loadReq->setLaravelSession($session);
        $controller->loadDedicatedCase($loadReq);

        $context = $session->get('issue_context');
        $candidateSource = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $context['source']);

        $session->put('issue_suggestion', [
            'status' => 'offline_reference_example',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'sourceSha256' => $context['sourceSha256'],
            'model' => null,
            'candidate' => [
                'status' => 'unverified_in_memory_preview',
                'source' => $candidateSource,
                'sha256' => hash('sha256', $candidateSource),
                'applied' => false,
                'verified' => false,
            ],
        ]);
        WorkbenchTask::findByContext($context)->recordProposal($session->get('issue_suggestion'));

        // Verify candidate
        $verifyReq = Request::create('/issues/verify', 'POST');
        $verifyReq->setLaravelSession($session);
        $controller->verifyCandidate($verifyReq);

        // Attempt publication (publisher fails closed on simulated verification runs)
        $publishReq = Request::create('/issues/publish-pr', 'POST');
        $publishReq->setLaravelSession($session);
        $publishRes = $controller->publishDraftPr($publishReq);

        self::assertTrue($publishRes->isRedirection());
        self::assertStringEndsWith('/issues', $publishRes->getTargetUrl());

        $flashError = $session->get('error');
        self::assertNotNull($flashError);
        self::assertStringContainsString('Verification was executed using a mock/simulated runner', $flashError);
    }

    public function testPublishDraftPrFailsClosedIfTokenMissingOrForged(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        $loadReq = Request::create('/issues/load-dedicated', 'POST');
        $loadReq->setLaravelSession($session);
        $controller->loadDedicatedCase($loadReq);

        $context = $session->get('issue_context');
        $candidateSource = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $context['source']);

        $session->put('issue_suggestion', [
            'status' => 'offline_reference_example',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'sourceSha256' => $context['sourceSha256'],
            'model' => null,
            'candidate' => [
                'source' => $candidateSource,
                'sha256' => hash('sha256', $candidateSource),
            ],
        ]);
        WorkbenchTask::findByContext($context)->recordProposal($session->get('issue_suggestion'));

        $verifyReq = Request::create('/issues/verify', 'POST');
        $verifyReq->setLaravelSession($session);
        $controller->verifyCandidate($verifyReq);

        $report = $session->get('issue_verification_report');
        $approvalStore = new \ProofPatch\GitHub\ServerHeldPublicationApproval(storage_path('app/publication_approvals'));

        // Test DedicatedTestRepoPublisher directly with disconnected: false
        $livePublisher = new DedicatedTestRepoPublisher($approvalStore, $mockHttp, disconnected: false);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Server-held publication authorization token is required');

        $livePublisher->publishDraftPr(
            $context,
            $report['evidenceDirectory'],
            $candidateSource,
            authorizationToken: null,
            githubToken: 'gho_dummy_authenticated_session_token_12345'
        );
    }

    public function testPublishDraftPrRequiresGitHubAuthentication(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        $loadReq = Request::create('/issues/load-dedicated', 'POST');
        $loadReq->setLaravelSession($session);
        $controller->loadDedicatedCase($loadReq);

        $context = $session->get('issue_context');
        $candidateSource = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $context['source']);

        $session->put('issue_suggestion', [
            'status' => 'offline_reference_example',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'sourceSha256' => $context['sourceSha256'],
            'model' => null,
            'candidate' => [
                'source' => $candidateSource,
                'sha256' => hash('sha256', $candidateSource),
            ],
        ]);
        WorkbenchTask::findByContext($context)->recordProposal($session->get('issue_suggestion'));

        $verifyReq = Request::create('/issues/verify', 'POST');
        $verifyReq->setLaravelSession($session);
        $controller->verifyCandidate($verifyReq);

        // De-authenticate session, and set host GITHUB_TOKEN to prove host token is NEVER silently used as user auth
        $session->forget('github_auth');
        putenv('GITHUB_TOKEN=ghp_host_ambient_token_must_not_be_used_123456');

        $publishReq = Request::create('/issues/publish-pr', 'POST');
        $publishReq->setLaravelSession($session);
        $publishRes = $controller->publishDraftPr($publishReq);

        self::assertTrue($publishRes->isRedirection());
        self::assertStringEndsWith('/issues', $publishRes->getTargetUrl());

        $flashError = $session->get('error');
        self::assertNotNull($flashError);
        self::assertStringContainsString('Authentication required: Connect your GitHub account before publishing.', $flashError);
    }

    public function testUnauthenticatedLoadDedicatedCaseFailsClosedEvenWhenHostHasAmbientToken(): void
    {
        $mockHttp = new MockHttpClient(function () {
            throw new \RuntimeException('Network request must not occur for unauthenticated session');
        });
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        // Explicitly unauthenticated session
        $session->forget('github_auth');
        putenv('GITHUB_TOKEN=ghp_host_ambient_token_must_not_be_used_123456');

        $loadReq = Request::create('/issues/load-dedicated', 'POST');
        $loadReq->setLaravelSession($session);
        $res = $controller->loadDedicatedCase($loadReq);

        self::assertTrue($res->isRedirection());
        self::assertStringEndsWith('/issues', $res->getTargetUrl());

        $error = $session->get('error');
        self::assertNotNull($error);
        self::assertStringContainsString('Authentication required: Connect your GitHub account before fetching the dedicated test repository.', $error);
    }

    public function testMockedActualFetchToGetIssuesToProposeFlowPreservesContextAndStripsTestFromPrompt(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        // 1. Fetch & load dedicated case
        $loadReq = Request::create('/issues/load-dedicated', 'POST');
        $loadReq->setLaravelSession($session);
        $loadRes = $controller->loadDedicatedCase($loadReq);
        self::assertTrue($loadRes->isRedirection());

        $context = $session->get('issue_context');
        self::assertIsArray($context);
        self::assertArrayHasKey('testSource', $context);
        self::assertArrayHasKey('testSha256', $context);

        // 2. GET /issues: show() must NOT throw or clear context
        $showReq = Request::create('/issues', 'GET');
        $showReq->setLaravelSession($session);
        $repo = \ProofPatch\GitHub\DedicatedTestRepo::requireName();
        $session->put('github_auth.repositories', [['fullName' => $repo, 'isPrivate' => false]]);
        $showReq->attributes->set('proofpatch_github_access', ['userId' => 1, 'repositories' => [strtolower($repo) => true]]);
        $showRes = $controller->show($showReq);
        self::assertInstanceOf(\Inertia\Response::class, $showRes);

        // Context must still be preserved in session
        self::assertNotNull($session->get('issue_context'));

        // Approval token must be issued for proposal
        $approvalToken = $session->get('issue_approval_token');
        self::assertIsString($approvalToken);
        self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $approvalToken);

        // Preview payload must strictly omit testSource and testSha256 from model prompt
        $preview = (new \ProofPatch\Agent\IssueSuggestion($mockHttp, \ProofPatch\Agent\RequestBudget::forRuntime()))->preview($context);
        $userPrompt = (string) $preview['body']['messages'][1]['content'];
        self::assertStringNotContainsString('testSource', $userPrompt);
        self::assertStringNotContainsString('testSha256', $userPrompt);
        self::assertStringNotContainsString('$cases =', $userPrompt);
        self::assertStringContainsString('src/OrderTotal.php', $userPrompt);

        // 3. Propose using issued approval token
        $proposeReq = Request::create('/issues/propose', 'POST', [
            'approved' => true,
            'digest' => $preview['digest'],
            'approval_token' => $approvalToken,
        ]);
        $proposeReq->setLaravelSession($session);
        $proposeRes = $controller->propose($proposeReq);
        self::assertTrue($proposeRes->isRedirection());

        $suggestion = $session->get('issue_suggestion');
        self::assertIsArray($suggestion);
        self::assertSame(DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH, $suggestion['path']);
        self::assertTrue($suggestion['isDedicated']);
    }

    public function testCaseSwitchingClearsStaleDedicatedFlagPublicationTokenAndPr(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('github_auth', ['token' => 'gho_dummy_authenticated_session_token_12345']);

        // Load dedicated case
        $loadDedicatedReq = Request::create('/issues/load-dedicated', 'POST');
        $loadDedicatedReq->setLaravelSession($session);
        $controller->loadDedicatedCase($loadDedicatedReq);

        self::assertTrue($session->get('issue_is_dedicated_test_repo'));

        // Seed state representing verified/published run
        $session->put('issue_publication_token', bin2hex(random_bytes(32)));
        $session->put('issue_published_pr', [
            'status' => 'published',
            'prNumber' => 42,
            'verificationRunId' => 'run-dedicated-1',
        ]);

        // Now switch to owned case
        $loadOwnedReq = Request::create('/issues/load-owned', 'POST');
        $loadOwnedReq->setLaravelSession($session);
        $controller->loadOwnedCase($loadOwnedReq);

        // All dedicated state, publication tokens, and published PRs must be purged
        self::assertFalse($session->get('issue_is_dedicated_test_repo'));
        self::assertTrue($session->get('issue_is_owned_fixture'));
        self::assertNull($session->get('issue_publication_token'));
        self::assertNull($session->get('issue_published_pr'));
    }

    public function testPrDisplayBindingDiscardsStalePrFromMismatchedRunId(): void
    {
        $mockHttp = $this->createMockGitHubClient();
        $controller = new IssueWorkbenchController($mockHttp);

        $session = app('session')->driver('array');
        app('redirect')->setSession($session);

        // Verification report is for run-active-100
        $session->put('issue_verification_report', [
            'id' => 'run-active-100',
            'decision' => 'VERIFIED',
        ]);

        // Stale PR is for run-old-999
        $session->put('issue_published_pr', [
            'status' => 'published',
            'prNumber' => 42,
            'verificationRunId' => 'run-old-999',
        ]);

        $showReq = Request::create('/issues', 'GET');
        $showReq->setLaravelSession($session);
        $controller->show($showReq);

        // Mismatched PR must be discarded from session
        self::assertNull($session->get('issue_published_pr'));

        // Matching PR must be preserved
        $session->put('issue_published_pr', [
            'status' => 'published',
            'prNumber' => 43,
            'verificationRunId' => 'run-active-100',
        ]);

        $controller->show($showReq);
        self::assertNotNull($session->get('issue_published_pr'));
        self::assertSame(43, $session->get('issue_published_pr')['prNumber']);
    }
}
