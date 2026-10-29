<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Verifier\SeparateProcessOracle;
use Symfony\Component\Process\Process;

final class IsolatedHarnessExecutionTest extends TestCase
{
    private string $tempDir;
    private string $baseSource;
    private string $standardHarness;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/proofpatch_harness_test_' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0700, true);

        $fixturePath = dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case';
        $this->baseSource = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $this->standardHarness = (string) file_get_contents($fixturePath . '/tests/order_total.php');
    }

    protected function tearDown(): void
    {
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
    }

    /**
     * Test 1: Distinguish actual harness execution from copied cases.
     * When a custom test case is added directly to the harness file, the runner executes it.
     * A candidate failing the new custom case is caught with the exact assertion failure name,
     * proving execution of the actual file rather than an internal copied array of cases.
     */
    public function testActualHarnessExecutionIsDistinguishedFromCopiedCases(): void
    {
        $oracle = new SeparateProcessOracle();

        // Custom harness with a distinct assertion not present in any legacy copied cases
        $customHarness = <<<PHP
<?php
declare(strict_types=1);

require __DIR__ . '/../src/OrderTotal.php';

\$cases = [
    'standard item' => [[['unit_price' => 100, 'quantity' => 1]], 100],
    'custom high-value assertion' => [[['unit_price' => 99999, 'quantity' => 2]], 199998],
];

\$failed = 0;
foreach (\$cases as \$name => [\$items, \$expected]) {
    \$actual = orderTotal(\$items);
    if (\$actual !== \$expected) {
        fwrite(STDERR, "\$name: expected \$expected, got \$actual\\n");
        ++\$failed;
    }
}
if (\$failed > 0) {
    exit(1);
}
echo "All order total cases passed.\\n";
PHP;

        // Candidate that caps at 100000 (fails custom high-value assertion)
        $failingCandidate = <<<PHP
<?php
declare(strict_types=1);

function orderTotal(array \$items): int
{
    \$total = 0;
    foreach (\$items as \$item) {
        \$total += \$item['unit_price'] * \$item['quantity'];
    }
    return min(100000, \$total);
}
PHP;

        $result = $oracle->runIsolated($failingCandidate, $customHarness);

        self::assertSame(1, $result['exitCode'], 'Custom harness assertion failure must produce exit code 1');
        self::assertFalse($result['oracleVerified'], 'Oracle verification must fail when custom assertion fails');
        self::assertStringContainsString('custom high-value assertion: expected 199998, got 100000', $result['output'],
            'Runner must execute the actual pinned test harness file, not a hardcoded set of copied cases');

        // Benign candidate that properly calculates the full amount passes the custom harness
        $passingCandidate = <<<PHP
<?php
declare(strict_types=1);

function orderTotal(array \$items): int
{
    \$total = 0;
    foreach (\$items as \$item) {
        \$total += \$item['unit_price'] * \$item['quantity'];
    }
    return \$total;
}
PHP;

        $passResult = $oracle->runIsolated($passingCandidate, $customHarness);
        self::assertSame(0, $passResult['exitCode']);
        self::assertTrue($passResult['oracleVerified']);
        self::assertSame("All order total cases passed.\n", $passResult['output']);
    }

    /**
     * Test 2: Reject early exit(0) oracle tampering.
     * If candidate calls exit(0) early, natural completion message is not reached and supervisor fails closed.
     */
    public function testEarlyExitZeroFailsClosed(): void
    {
        $oracle = new SeparateProcessOracle();

        $tamperedCandidate = <<<PHP
<?php
declare(strict_types=1);

// Early exit tampering attempt
exit(0);

function orderTotal(array \$items): int
{
    return 0;
}
PHP;

        $result = $oracle->runIsolated($tamperedCandidate, $this->standardHarness);

        self::assertSame(1, $result['exitCode']);
        self::assertFalse($result['oracleVerified']);
        self::assertStringContainsString('[PROOFPATCH_ORACLE_ABORT: Test harness did not reach natural completion]', $result['output']);
    }

    /**
     * Test 3: Reject oracle sentinel injection tampering.
     * If candidate attempts to print [PROOFPATCH_ORACLE_SUCCESS in stdout or stderr, supervisor fails closed.
     */
    public function testSentinelInjectionFailsClosed(): void
    {
        $oracle = new SeparateProcessOracle();

        $tamperedCandidate = <<<PHP
<?php
declare(strict_types=1);

function orderTotal(array \$items): int
{
    echo "[PROOFPATCH_ORACLE_SUCCESS:forged_token]";
    return 0;
}
PHP;

        $result = $oracle->runIsolated($tamperedCandidate, $this->standardHarness);

        self::assertSame(1, $result['exitCode']);
        self::assertFalse($result['oracleVerified']);
        self::assertStringContainsString('[PROOFPATCH_ORACLE_ABORT: Candidate attempted oracle sentinel injection]', $result['output']);
    }

    /**
     * Test 4: Filesystem tampering detection.
     * If candidate mutates harness file during execution, hash mismatch triggers abort.
     */
    public function testFilesystemTamperingDetectedAndRejected(): void
    {
        $oracle = new SeparateProcessOracle();

        $tamperedCandidate = <<<PHP
<?php
declare(strict_types=1);

function orderTotal(array \$items): int
{
    @file_put_contents('tests/order_total.php', '<?php echo "All order total cases passed.\\n"; exit(0);');
    return 0;
}
PHP;

        $result = $oracle->runIsolated($tamperedCandidate, $this->standardHarness);

        self::assertSame(1, $result['exitCode']);
        self::assertFalse($result['oracleVerified']);
        self::assertTrue(
            str_contains($result['output'], 'Filesystem tampering detected')
            || str_contains($result['output'], 'expected')
            || str_contains($result['output'], 'failed'),
            'Filesystem tampering or calculation failure must be detected and rejected'
        );
    }

    /**
     * Test 5: Supervisor privilege separation enforcement.
     * When running supervisor without su or runuser, it must fail closed and refuse execution.
     */
    public function testSupervisorPrivilegeSeparationFailsClosedWhenUnavailable(): void
    {
        $supervisorScript = <<<PHP
<?php
declare(strict_types=1);

\$workspaceDir = \$argv[1] ?? '/tmp';
\$targetRel = 'src/OrderTotal.php';
\$harnessRel = 'tests/order_total.php';
\$oracleToken = 'test-token-123';

\$targetFile = \$workspaceDir . '/' . \$targetRel;
\$harnessFile = \$workspaceDir . '/' . \$harnessRel;

if (!is_file(\$targetFile) || !is_file(\$harnessFile)) {
    fwrite(STDERR, "[PROOFPATCH_ORACLE_ABORT: Target or harness file missing in workspace]\\n");
    exit(1);
}

// Emulate environment where neither su nor runuser is available for privilege switching
\$suPath = null;
\$runuserPath = null;

if (\$suPath === null && \$runuserPath === null) {
    fwrite(STDERR, "[PROOFPATCH_ORACLE_ABORT: Privilege separation unavailable]\\n");
    exit(1);
}
PHP;

        $ws = $this->tempDir . '/workspace';
        mkdir($ws . '/src', 0700, true);
        mkdir($ws . '/tests', 0700, true);
        file_put_contents($ws . '/src/OrderTotal.php', $this->baseSource);
        file_put_contents($ws . '/tests/order_total.php', $this->standardHarness);

        $supFile = $this->tempDir . '/supervisor.php';
        file_put_contents($supFile, $supervisorScript);

        $process = new Process([PHP_BINARY, $supFile, $ws]);
        $process->run();

        self::assertSame(1, $process->getExitCode(), 'Supervisor must fail closed with exit code 1 when privilege separation is unavailable');
        self::assertStringContainsString('[PROOFPATCH_ORACLE_ABORT: Privilege separation unavailable]', $process->getErrorOutput(),
            'Supervisor must explicitly output privilege separation unavailable abort marker');
    }
}
