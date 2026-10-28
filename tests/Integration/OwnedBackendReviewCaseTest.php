<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\SingleFileCandidate;
use ProofPatch\GitHub\DiffHunkParser;
use ProofPatch\Support\LocalProcess;

/**
 * Evaluates the owned, self-contained synthetic backend test case checked into the repository
 * at tests/Fixtures/owned-review-case.
 *
 * Verifies file cleanliness, cryptographic integrity, and isolated execution.
 * Does not execute arbitrary external paths or mutable files.
 */
final class OwnedBackendReviewCaseTest extends TestCase
{
    private const FIXTURE_PATH = __DIR__.'/../Fixtures/owned-review-case';
    private const EXPECTED_SRC_SHA256 = '54bc37fb2b005badcf309c5a7091ba6a2e704fc54c8eff9e9c7afee7e4054859';
    private const EXPECTED_TEST_SHA256 = 'b8079fb1e7731fc763f0b009a11c2786d01b52cce08f7431768a64e8a5ef2cbf';

    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir().'/proofpatch-owned-case-'.bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0700, true);
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->tempDir);
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

    private function prepareSandboxedFixture(): string
    {
        self::assertDirectoryExists(self::FIXTURE_PATH);

        $srcFile = self::FIXTURE_PATH.'/src/OrderTotal.php';
        $testFile = self::FIXTURE_PATH.'/tests/order_total.php';

        self::assertFileExists($srcFile);
        self::assertFileExists($testFile);

        // Verify cryptographic integrity and cleanliness of checked-in fixture
        self::assertSame(self::EXPECTED_SRC_SHA256, hash_file('sha256', $srcFile), 'Checked-in src file hash mismatch.');
        self::assertSame(self::EXPECTED_TEST_SHA256, hash_file('sha256', $testFile), 'Checked-in test file hash mismatch.');

        // Copy into sandboxed temp directory
        $sandboxedPath = $this->tempDir.'/fixture';
        mkdir($sandboxedPath.'/src', 0700, true);
        mkdir($sandboxedPath.'/tests', 0700, true);
        copy($srcFile, $sandboxedPath.'/src/OrderTotal.php');
        copy($testFile, $sandboxedPath.'/tests/order_total.php');

        return $sandboxedPath;
    }

    public function testFixtureCleanlinessAndInitialSourceState(): void
    {
        $sandboxedPath = $this->prepareSandboxedFixture();

        $source = file_get_contents($sandboxedPath.'/src/OrderTotal.php');
        self::assertIsString($source);
        self::assertStringContainsString('max(1, $item[\'quantity\'])', $source);
        self::assertSame(self::EXPECTED_SRC_SHA256, hash('sha256', $source));
    }

    public function testBaselineSeededFailureMatchesExpectedMiscalculation(): void
    {
        $sandboxedPath = $this->prepareSandboxedFixture();
        $process = LocalProcess::create(['php', 'tests/order_total.php'], $sandboxedPath);
        $process->run();

        self::assertSame(1, $process->getExitCode());
        self::assertStringContainsString('zero quantity: expected 250, got 750', $process->getErrorOutput());
    }

    public function testCandidatePatchRepairsOrderTotalAndPassesAllCases(): void
    {
        $sandboxedPath = $this->prepareSandboxedFixture();
        $originalSource = file_get_contents($sandboxedPath.'/src/OrderTotal.php');
        $originalSha = hash('sha256', $originalSource);

        // Apply candidate fix in memory via SingleFileCandidate
        $candidateSource = SingleFileCandidate::create(
            $originalSource,
            $originalSha,
            'max(1, $item[\'quantity\'])',
            '$item[\'quantity\']',
        );

        self::assertStringNotContainsString('max(1,', $candidateSource);
        self::assertStringContainsString('$total += $item[\'unit_price\'] * $item[\'quantity\'];', $candidateSource);

        // Execute isolated temporary run without touching the checked-in fixture
        $runDir = $this->tempDir.'/candidate-run';
        mkdir($runDir.'/src', 0700, true);
        mkdir($runDir.'/tests', 0700, true);
        file_put_contents($runDir.'/src/OrderTotal.php', $candidateSource);
        copy($sandboxedPath.'/tests/order_total.php', $runDir.'/tests/order_total.php');

        $process = LocalProcess::create(['php', 'tests/order_total.php'], $runDir);
        $process->run();
        self::assertSame(0, $process->getExitCode());
        self::assertStringContainsString('All order total cases passed.', $process->getOutput());

        // Assert strictly non-destructive: checked-in fixture file was never touched
        self::assertSame(self::EXPECTED_SRC_SHA256, hash_file('sha256', self::FIXTURE_PATH.'/src/OrderTotal.php'));
    }

    public function testNegativeControlFailsOtherAssertionsAndPreventsFalsePass(): void
    {
        $sandboxedPath = $this->prepareSandboxedFixture();
        $originalSource = file_get_contents($sandboxedPath.'/src/OrderTotal.php');
        $originalSha = hash('sha256', $originalSource);

        // Return zero negative control: replacing accumulation loop with no-op
        $negativeControlSource = SingleFileCandidate::create(
            $originalSource,
            $originalSha,
            '$total += $item[\'unit_price\'] * max(1, $item[\'quantity\']);',
            '/* zero negative control */',
        );

        $runDir = $this->tempDir.'/negative-run';
        mkdir($runDir.'/src', 0700, true);
        mkdir($runDir.'/tests', 0700, true);
        file_put_contents($runDir.'/src/OrderTotal.php', $negativeControlSource);
        copy($sandboxedPath.'/tests/order_total.php', $runDir.'/tests/order_total.php');

        $process = LocalProcess::create(['php', 'tests/order_total.php'], $runDir);
        $process->run();
        self::assertSame(1, $process->getExitCode());
        self::assertStringContainsString('multiple items: expected 330, got 0', $process->getErrorOutput());
        self::assertStringContainsString('zero quantity: expected 250, got 0', $process->getErrorOutput());
    }

    public function testDiffHunkParserValidatesCandidateFixHunkAndAnchors(): void
    {
        $patch = <<<'DIFF'
@@ -7,5 +7,5 @@ function orderTotal(array $items): int
 {
     $total = 0;
     foreach ($items as $item) {
-        $total += $item['unit_price'] * max(1, $item['quantity']);
+        $total += $item['unit_price'] * $item['quantity'];
     }
DIFF;
        $patch .= "\n";

        $headSha = 'e845de0000000000000000000000000000000000';

        // Anchor on line 10 (the modified line) on LEFT (deletion side)
        $leftAnchor = DiffHunkParser::validateAnchor($patch, 10, $headSha, $headSha, 'LEFT');
        self::assertTrue($leftAnchor['valid']);
        self::assertTrue($leftAnchor['commentable']);
        self::assertSame('deletion', $leftAnchor['lineType']);
        self::assertSame('anchored', $leftAnchor['status']);

        // Anchor on line 10 on RIGHT (addition side)
        $rightAnchor = DiffHunkParser::validateAnchor($patch, 10, $headSha, $headSha, 'RIGHT');
        self::assertTrue($rightAnchor['valid']);
        self::assertTrue($rightAnchor['commentable']);
        self::assertSame('addition', $rightAnchor['lineType']);
        self::assertSame('anchored', $rightAnchor['status']);

        // Line 999 outside hunk must fail closed
        $outsideAnchor = DiffHunkParser::validateAnchor($patch, 999, $headSha, $headSha, 'RIGHT');
        self::assertFalse($outsideAnchor['valid']);
        self::assertFalse($outsideAnchor['commentable']);
        self::assertSame('hint_only', $outsideAnchor['status']);
    }
}
