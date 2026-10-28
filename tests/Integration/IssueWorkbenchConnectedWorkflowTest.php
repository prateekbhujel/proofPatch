<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class IssueWorkbenchConnectedWorkflowTest extends TestCase
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

        // Block outbound network and isolate environment
        putenv('BASETEN_API_KEY');
        $this->tempBudgetDir = sys_get_temp_dir().'/proofpatch-budget-'.bin2hex(random_bytes(6));
        mkdir($this->tempBudgetDir, 0700, true);
        putenv('HOME='.$this->tempBudgetDir);

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

    public function testConnectedOwnedWorkflowFromIntakeToProposeToVerifyAndDraft(): void
    {
        $session = app('session')->driver('array');
        $budget = new RequestBudget($this->tempBudgetDir, 500000, 10);
        $controller = new IssueWorkbenchController($this->blockingHttp, $budget);

        // Step 1: Load owned review case
        $loadReq = Request::create('/issues/load-owned', 'POST');
        $loadReq->setLaravelSession($session);
        $controller->loadOwnedCase($loadReq);

        $context = $session->get('issue_context');
        self::assertIsArray($context);
        self::assertTrue($context['isSynthetic']);
        self::assertSame('src/OrderTotal.php', $context['path']);

        // Step 2: Propose (deterministic offline reference in test environment)
        $preview = (new IssueSuggestion($this->blockingHttp, $budget))->preview($context);
        $proposeReq = Request::create('/issues/propose', 'POST', [
            'approved' => true,
            'digest' => $preview['digest'],
        ]);
        $proposeReq->setLaravelSession($session);
        $controller->propose($proposeReq);

        $suggestion = $session->get('issue_suggestion');
        self::assertIsArray($suggestion);
        self::assertArrayHasKey('candidate', $suggestion);
        self::assertFalse($suggestion['candidate']['verified']);
        self::assertStringContainsString('$item[\'quantity\']', $suggestion['candidate']['source']);

        // Step 3: Verify candidate with ProofPatch Verifier
        $verifyReq = Request::create('/issues/verify', 'POST');
        $verifyReq->setLaravelSession($session);
        $verifyRes = $controller->verifyCandidate($verifyReq);

        self::assertTrue($verifyRes->isRedirection());
        self::assertStringEndsWith('/issues', $verifyRes->getTargetUrl());

        $report = $session->get('issue_verification_report');
        self::assertIsArray($report);
        self::assertSame('VERIFIED', $report['decision']);
        self::assertSame('owned_backend', $report['kind']);
        self::assertTrue($report['isSynthetic']);

        // Check all 5 verification gates
        self::assertTrue($report['gates']['baselineReproduced']);
        self::assertTrue($report['gates']['negativeControlCaught']);
        self::assertTrue($report['gates']['candidatePassed']);
        self::assertTrue($report['gates']['candidateStaticSafetyPassed']);
        self::assertTrue($report['gates']['allowlistIntegrityIntact']);

        // Check runs exit codes
        self::assertSame(1, $report['runs']['baseline']['exitCode']);
        self::assertSame(1, $report['runs']['negative']['exitCode']);
        self::assertSame(0, $report['runs']['candidate']['exitCode']);

        // Check cryptographic receipt
        self::assertArrayHasKey('receipt', $report);
        self::assertSame('VALID', $report['receipt']['integrity']);
        self::assertFalse($report['receipt']['externallyAnchored']);
        self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $report['receipt']['sha256']);

        // Verify receipt from disk independently
        // Locally generated manifest without external expected digest is not externally anchored
        $diskVerified = (new Receipt())->verify($report['evidenceDirectory']);
        self::assertSame('VALID', $diskVerified['integrity']);
        self::assertFalse($diskVerified['externallyAnchored']);
        self::assertSame('VERIFIED', $diskVerified['decision']);

        // When verified against an independently provided expected digest, it is externally anchored
        $anchoredVerified = (new Receipt())->verify($report['evidenceDirectory'], $report['receipt']['sha256']);
        self::assertSame('VALID', $anchoredVerified['integrity']);
        self::assertTrue($anchoredVerified['externallyAnchored']);

        // Suggestion updated in session
        $updatedSuggestion = $session->get('issue_suggestion');
        self::assertTrue($updatedSuggestion['candidate']['verified']);
        self::assertSame('verified_allowlisted_candidate', $updatedSuggestion['candidate']['status']);

        // Notification queued in tray
        $notifications = $session->get('notifications');
        self::assertIsArray($notifications);
        self::assertNotEmpty($notifications);
        self::assertSame('success', $notifications[0]['type']);
        self::assertSame('Candidate Verified with Receipt', $notifications[0]['title']);

        // Step 4: Save local review draft
        $draftReq = Request::create('/issues/draft', 'POST', [
            'comment' => 'Verified OrderTotal bug reproduction (exit 1), negative control (exit 1), and candidate fix (exit 0) with valid cryptographic receipt.',
        ]);
        $draftReq->setLaravelSession($session);
        $controller->saveDraft($draftReq);

        $draft = $session->get('issue_draft');
        self::assertIsArray($draft);
        self::assertStringContainsString('Verified OrderTotal bug', $draft['comment']);
        self::assertStringContainsString('Local draft only', $draft['readOnlyPolicy']);

        // Step 5: Render workbench page
        $showReq = Request::create('/issues', 'GET');
        $showReq->setLaravelSession($session);
        $showRes = $controller->show($showReq);
        self::assertInstanceOf(\Inertia\Response::class, $showRes);
    }

    public function testVerifyCandidateFailsWhenNoCandidateAvailable(): void
    {
        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $controller = new IssueWorkbenchController($this->blockingHttp);

        $req = Request::create('/issues/verify', 'POST');
        $req->setLaravelSession($session);
        $res = $controller->verifyCandidate($req);

        self::assertTrue($res->isRedirection());
        self::assertSame('No candidate proposal available to verify.', $session->get('error'));
    }

    public function testVerifyCandidateRejectsArbitraryUntrustedPath(): void
    {
        $session = app('session')->driver('array');
        app('redirect')->setSession($session);
        $session->put('issue_is_owned_fixture', false);
        $session->put('issue_suggestion', [
            'path' => 'app/ArbitraryUntrusted.php',
            'candidate' => ['source' => '<?php echo "untrusted";'],
        ]);

        $controller = new IssueWorkbenchController($this->blockingHttp);
        $req = Request::create('/issues/verify', 'POST');
        $req->setLaravelSession($session);
        $res = $controller->verifyCandidate($req);

        self::assertTrue($res->isRedirection());
        self::assertStringContainsString('restricted to the allowlisted owned review case fixture', (string) $session->get('error'));
    }
}
