<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class IssueWorkbenchIntegrationTest extends TestCase
{
    private string $tempBudgetDir;
    private ?string $originalHome;
    private ?string $originalBasetenKey;
    private MockHttpClient $blockingHttp;

    protected function setUp(): void
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        $this->originalHome = getenv('HOME') !== false ? (string) getenv('HOME') : null;
        $this->originalBasetenKey = getenv('BASETEN_API_KEY') !== false ? (string) getenv('BASETEN_API_KEY') : null;

        // Ensure tests NEVER make real paid calls to Baseten
        putenv('BASETEN_API_KEY');

        $this->tempBudgetDir = sys_get_temp_dir().'/proofpatch-budget-'.bin2hex(random_bytes(6));
        mkdir($this->tempBudgetDir, 0700, true);
        putenv('HOME='.$this->tempBudgetDir);

        // Blocking HTTP client that fails closed if any outbound network call is attempted
        $this->blockingHttp = new MockHttpClient(static function (): MockResponse {
            throw new \RuntimeException('Strict network isolation: real network requests are blocked in tests.');
        });

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        if ($this->originalHome !== null) {
            putenv('HOME='.$this->originalHome);
        } else {
            putenv('HOME');
        }

        if ($this->originalBasetenKey !== null) {
            putenv('BASETEN_API_KEY='.$this->originalBasetenKey);
        } else {
            putenv('BASETEN_API_KEY');
        }

        $this->removeDirectory($this->tempBudgetDir);
        $_SESSION = [];
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) return;
        foreach (new \FilesystemIterator($path) as $file) {
            $file->isDir() && !$file->isLink() ? $this->removeDirectory($file->getPathname()) : @unlink($file->getPathname());
        }
        @rmdir($path);
    }

    public function testLoadOwnedCaseSetsExpectedContextAndFixtures(): void
    {
        $session = app('session')->driver('array');
        $request = Request::create('/issues/load-owned', 'POST');
        $request->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $response = $controller->loadOwnedCase($request);

        $this->assertTrue($response->isRedirection());
        $this->assertStringEndsWith('/issues', $response->getTargetUrl());

        $context = $session->get('issue_context');
        $this->assertIsArray($context);
        $this->assertSame('synthetic-fixture/order-total', $context['repository']);
        $this->assertTrue($context['isSynthetic']);
        $this->assertNull($context['issueUrl']);
        $this->assertNull($context['commit']);
        $this->assertSame('Local checked-in test fixture (tests/Fixtures/owned-review-case)', $context['provenance']);
        $this->assertSame(101, $context['issueNumber']);
        $this->assertSame('src/OrderTotal.php', $context['path']);
        $this->assertSame('54bc37fb2b005badcf309c5a7091ba6a2e704fc54c8eff9e9c7afee7e4054859', $context['sourceSha256']);
        $this->assertTrue($session->get('issue_is_owned_fixture'));
        $this->assertStringContainsString('offline synthetic test case', $context['body']);
    }

    public function testShowRendersContextAndPreviewWithoutCallingExternalModel(): void
    {
        $session = app('session')->driver('array');
        $request = Request::create('/issues/load-owned', 'POST');
        $request->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $controller->loadOwnedCase($request);

        $showRequest = Request::create('/issues', 'GET');
        $showRequest->setLaravelSession($session);

        $response = $controller->show($showRequest);
        $props = $response->toResponse($showRequest)->getOriginalContent()->getData()['page']['props'];

        $this->assertNotNull($props['context']);
        $this->assertSame('src/OrderTotal.php', $props['context']['path']);
        $this->assertNotNull($props['preview']);
        $this->assertNotEmpty($props['preview']['digest']);
        $this->assertGreaterThan(0, $props['preview']['estimatedMicros']);
    }

    public function testProposeGeneratesOfflineReferenceCandidateWithoutFabricatingModelOrUsage(): void
    {
        $session = app('session')->driver('array');
        $loadRequest = Request::create('/issues/load-owned', 'POST');
        $loadRequest->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $controller->loadOwnedCase($loadRequest);

        $context = $session->get('issue_context');
        $preview = (new IssueSuggestion($this->blockingHttp, RequestBudget::forRuntime()))->preview($context);

        $proposeRequest = Request::create('/issues/propose', 'POST', [
            'approved' => true,
            'digest' => $preview['digest'],
        ]);
        $proposeRequest->setLaravelSession($session);

        $response = $controller->propose($proposeRequest);
        $this->assertTrue($response->isRedirection());

        $suggestion = $session->get('issue_suggestion');
        $this->assertIsArray($suggestion);
        $this->assertSame('offline_reference_example', $suggestion['status']);
        $this->assertTrue($suggestion['isOfflineExample']);
        $this->assertTrue($suggestion['isSynthetic']);
        $this->assertNull($suggestion['commit']);
        $this->assertNull($suggestion['model']);
        $this->assertNull($suggestion['usage']);
        $this->assertSame('src/OrderTotal.php', $suggestion['path']);
        $this->assertStringContainsString("max(1, \$item['quantity'])", $suggestion['find']);
        $this->assertStringContainsString("\$item['quantity']", $suggestion['replace']);

        $this->assertArrayHasKey('candidate', $suggestion);
        $this->assertSame('unverified_in_memory_preview', $suggestion['candidate']['status']);
        $this->assertFalse($suggestion['candidate']['applied']);
        $this->assertFalse($suggestion['candidate']['verified']);

        // Assert explicit safety disclosure present
        $this->assertStringContainsString('not security sandboxes', $suggestion['safetyNotice']);
    }

    public function testSaveDraftAndClearDraft(): void
    {
        $session = app('session')->driver('array');
        $saveRequest = Request::create('/issues/draft', 'POST', [
            'comment' => 'Reviewed zero quantity logic: verified in-memory diff.',
        ]);
        $saveRequest->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $response = $controller->saveDraft($saveRequest);
        $this->assertTrue($response->isRedirection());

        $draft = $session->get('issue_draft');
        $this->assertIsArray($draft);
        $this->assertSame('Reviewed zero quantity logic: verified in-memory diff.', $draft['comment']);
        $this->assertStringContainsString('Local draft only', $draft['readOnlyPolicy']);

        // Clear draft
        $clearRequest = Request::create('/issues/draft', 'POST', ['comment' => '']);
        $clearRequest->setLaravelSession($session);
        $controller->saveDraft($clearRequest);
        $this->assertNull($session->get('issue_draft'));
    }

    public function testVerifyCandidateAllowsTrustedOfflineFixtureCandidate(): void
    {
        $session = app('session')->driver('array');
        $loadRequest = Request::create('/issues/load-owned', 'POST');
        $loadRequest->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $controller->loadOwnedCase($loadRequest);

        $context = $session->get('issue_context');
        $preview = (new IssueSuggestion($this->blockingHttp, RequestBudget::forRuntime()))->preview($context);

        $proposeRequest = Request::create('/issues/propose', 'POST', [
            'approved' => true,
            'digest' => $preview['digest'],
        ]);
        $proposeRequest->setLaravelSession($session);
        $controller->propose($proposeRequest);

        $verifyRequest = Request::create('/issues/verify', 'POST');
        $verifyRequest->setLaravelSession($session);

        $response = $controller->verifyCandidate($verifyRequest);
        $this->assertTrue($response->isRedirection());
        $this->assertStringEndsWith('/issues', $response->getTargetUrl());

        $report = $session->get('issue_verification_report');
        $this->assertIsArray($report);
        $this->assertSame('VERIFIED', $report['decision']);
        $this->assertSame('VALID', $report['receipt']['integrity']);
        $this->assertFalse($report['receipt']['externallyAnchored']);

        $suggestion = $session->get('issue_suggestion');
        $this->assertTrue($suggestion['candidate']['verified']);
        $this->assertSame('verified_allowlisted_candidate', $suggestion['candidate']['status']);
    }

    public function testVerifyCandidateFailsClosedOnModelSuppliedCandidate(): void
    {
        $session = app('session')->driver('array');
        $baseFixture = (string) file_get_contents(base_path('tests/Fixtures/owned-review-case/src/OrderTotal.php'));
        $trustedSource = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $baseFixture);

        $session->put('issue_is_owned_fixture', true);
        $session->put('issue_context', ['path' => 'src/OrderTotal.php']);
        $session->put('issue_suggestion', [
            'path' => 'src/OrderTotal.php',
            'model' => 'meta-models/muse-spark-open-1026',
            'candidate' => [
                'source' => $trustedSource,
            ],
        ]);

        $verifyRequest = Request::create('/issues/verify', 'POST');
        $verifyRequest->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $response = $controller->verifyCandidate($verifyRequest);

        $this->assertTrue($response->isRedirection());
        $this->assertStringEndsWith('/issues', $response->getTargetUrl());
        $flashError = (string) ($response->getSession()?->get('error') ?? $session->get('error'));
        $this->assertStringContainsString('Host execution disabled', $flashError);
        $this->assertNull($session->get('issue_verification_report'));
    }

    public function testVerifyCandidateFailsClosedOnUntrustedCandidate(): void
    {
        $session = app('session')->driver('array');
        $session->put('issue_is_owned_fixture', true);
        $session->put('issue_context', ['path' => 'src/OrderTotal.php']);
        $session->put('issue_suggestion', [
            'path' => 'src/OrderTotal.php',
            'model' => null,
            'candidate' => [
                'source' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int { return 999; }\n",
            ],
        ]);

        $verifyRequest = Request::create('/issues/verify', 'POST');
        $verifyRequest->setLaravelSession($session);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $response = $controller->verifyCandidate($verifyRequest);

        $this->assertTrue($response->isRedirection());
        $this->assertStringEndsWith('/issues', $response->getTargetUrl());
        $flashError = (string) ($response->getSession()?->get('error') ?? $session->get('error'));
        $this->assertStringContainsString('Host execution disabled', $flashError);
        $this->assertNull($session->get('issue_verification_report'));
    }
}
