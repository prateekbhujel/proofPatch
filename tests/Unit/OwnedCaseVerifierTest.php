<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Verifier\OwnedCaseVerifier;

final class OwnedCaseVerifierTest extends TestCase
{
    private string $testRunsDir;

    protected function setUp(): void
    {
        $this->testRunsDir = sys_get_temp_dir() . '/proofpatch-test-runs-' . bin2hex(random_bytes(8));
        mkdir($this->testRunsDir, 0700);
    }

    protected function tearDown(): void
    {
        if (is_dir($this->testRunsDir)) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->testRunsDir, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($iterator as $item) {
                $item->isDir() && !$item->isLink() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
            }
            @rmdir($this->testRunsDir);
        }
    }

    public function testStaticAstSafetyRejectsUnsafeTokens(): void
    {
        // Shell commands
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php `ls -la`;')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php exec("id");')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php shell_exec("cat /etc/passwd");')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php system("uname");')['safe']);

        // Eval and includes
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php eval("return 1;");')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php require "evil.php";')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php include_once "/tmp/payload";')['safe']);

        // Network & File I/O
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php curl_init("https://evil.com");')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php file_get_contents("/etc/shadow");')['safe']);
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php unlink("/tmp/flag");')['safe']);

        // Syntax error
        self::assertFalse(OwnedCaseVerifier::checkCandidateSafety('<?php function () {')['safe']);

        // Clean arithmetic candidate
        $cleanCandidate = <<<'PHP'
<?php

declare(strict_types=1);

function orderTotal(array $items): int
{
    $total = 0;
    foreach ($items as $item) {
        $total += $item['unit_price'] * $item['quantity'];
    }

    return $total;
}
PHP;
        self::assertTrue(OwnedCaseVerifier::checkCandidateSafety($cleanCandidate)['safe']);
    }

    public function testVerifiesPassingCandidateWithAllGatesAndReceipt(): void
    {
        $projectRoot = dirname(__DIR__, 2);
        $verifier = new OwnedCaseVerifier($projectRoot, $this->testRunsDir);

        $passingCandidate = <<<'PHP'
<?php

declare(strict_types=1);

function orderTotal(array $items): int
{
    $total = 0;
    foreach ($items as $item) {
        $total += $item['unit_price'] * $item['quantity'];
    }

    return $total;
}
PHP;

        $report = $verifier->verify($passingCandidate, [
            'repository' => 'synthetic-fixture/order-total',
            'issueNumber' => 101,
        ]);

        self::assertSame('VERIFIED', $report['decision']);
        self::assertSame('owned_backend', $report['kind']);
        self::assertTrue($report['isSynthetic']);
        self::assertSame('Local checked-in test fixture (tests/Fixtures/owned-review-case)', $report['provenance']);

        // All gates passed
        self::assertTrue($report['gates']['baselineReproduced']);
        self::assertTrue($report['gates']['negativeControlCaught']);
        self::assertTrue($report['gates']['candidatePassed']);
        self::assertTrue($report['gates']['candidateStaticSafetyPassed']);
        self::assertTrue($report['gates']['allowlistIntegrityIntact']);

        // Run details
        self::assertSame(1, $report['runs']['baseline']['exitCode']);
        self::assertSame(1, $report['runs']['negative']['exitCode']);
        self::assertSame(0, $report['runs']['candidate']['exitCode']);

        // Cryptographic receipt verification
        self::assertArrayHasKey('receipt', $report);
        self::assertSame('VALID', $report['receipt']['integrity']);
        self::assertTrue($report['receipt']['externallyAnchored']);
        self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $report['receipt']['sha256']);

        // Independent receipt verification directly from disk
        $receiptHelper = new Receipt();
        $verifiedFromDisk = $receiptHelper->verify($report['evidenceDirectory'], $report['receipt']['sha256']);
        self::assertSame('VALID', $verifiedFromDisk['integrity']);
        self::assertSame('VERIFIED', $verifiedFromDisk['decision']);

        // Sandbox boundary disclosures
        self::assertArrayHasKey('backendSandboxGap', $report);
        self::assertSame('allowlisted_bounded_demonstration', $report['backendSandboxGap']['status']);
    }

    public function testFailsClosedOnStaticSafetyViolationWithoutRunningCandidate(): void
    {
        $projectRoot = dirname(__DIR__, 2);
        $verifier = new OwnedCaseVerifier($projectRoot, $this->testRunsDir);

        $maliciousCandidate = <<<'PHP'
<?php

declare(strict_types=1);

function orderTotal(array $items): int
{
    system('echo exploit');
    return 250;
}
PHP;

        $report = $verifier->verify($maliciousCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertSame(255, $report['runs']['candidate']['exitCode']);

        $candidateLog = file_get_contents($report['evidenceDirectory'] . '/candidate/run.log');
        self::assertStringContainsString('ABORTED: Candidate failed static AST safety check', $candidateLog);
    }

    public function testFailsWhenCandidateFailsLogicChecks(): void
    {
        $projectRoot = dirname(__DIR__, 2);
        $verifier = new OwnedCaseVerifier($projectRoot, $this->testRunsDir);

        $brokenCandidate = <<<'PHP'
<?php

declare(strict_types=1);

function orderTotal(array $items): int
{
    return 999;
}
PHP;

        $report = $verifier->verify($brokenCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertTrue($report['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertSame(1, $report['runs']['candidate']['exitCode']);
    }
}
