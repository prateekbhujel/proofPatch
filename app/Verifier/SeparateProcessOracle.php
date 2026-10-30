<?php

declare(strict_types=1);

namespace ProofPatch\Verifier;

use ProofPatch\Support\LocalProcess;

/**
 * Local simulated process test oracle double for controlled testing.
 *
 * CRITICAL SECURITY NOTICE:
 * A separate host process is NOT a security sandbox.
 * Host execution is unisolated and network-unrestricted (isolated=false, networkBlocked=false).
 * This class is strictly for local test demonstration with explicitly trusted handcrafted benign candidates.
 * It must NEVER be used to execute untrusted model-generated code on the host,
 * and must NEVER be used for genuine verification or draft PR publication.
 * Genuine execution of untrusted code requires an external containerized microVM boundary (e.g. Modal gVisor sandbox).
 */
final readonly class SeparateProcessOracle implements IsolatedRunnerInterface
{
    public const DEFAULT_TIMEOUT_SECONDS = 10;

    /** Ground truth test cases for owned review case fixture */
    public const FIXTURE_CASES = [
        'empty order' => [[], 0],
        'multiple items' => [[['unit_price' => 125, 'quantity' => 2], ['unit_price' => 80, 'quantity' => 1]], 330],
        'zero quantity' => [[['unit_price' => 500, 'quantity' => 0], ['unit_price' => 125, 'quantity' => 2]], 250],
    ];

    /** Ground truth test cases for dedicated repository case */
    public const DEDICATED_CASES = [
        'empty order' => [[], 0],
        'single item' => [[['unit_price' => 100, 'quantity' => 2]], 200],
        'zero quantity' => [[['unit_price' => 100, 'quantity' => 0]], 0],
        'mixed quantities' => [[['unit_price' => 100, 'quantity' => 0], ['unit_price' => 50, 'quantity' => 2]], 100],
    ];

    public function isAvailable(): array
    {
        return [
            'available' => true,
            'runner' => 'simulated-unisolated-oracle',
            'isGenuineProvider' => false,
            'reason' => 'Local simulated process test double for controlled tests only. Not an isolated sandbox; network is unrestricted and host environment is unisolated.',
        ];
    }

    /**
     * Executes the candidate code across an isolated separate process boundary.
     *
     * @param string $source Candidate source file content
     * @param string $testHarness Test harness source or digest
     * @param string $relativePath Relative path of target file (e.g. 'src/OrderTotal.php')
     * @param int $timeoutSeconds Timeout bound in seconds
     * @return array{
     *     exitCode: int,
     *     output: string,
     *     logSha256: string,
     *     durationMs: int,
     *     sandboxId: string,
     *     runnerType: string,
     *     networkBlocked: bool,
     *     credentialsMounted: bool,
     *     isolated: bool,
     *     oracleVerified: bool,
     *     truncated: bool,
     *     timedOut: bool,
     * }
     */
    public function runIsolated(
        string $source,
        string $testHarness,
        string $relativePath = 'src/OrderTotal.php',
        int $timeoutSeconds = self::DEFAULT_TIMEOUT_SECONDS
    ): array {
        $startTime = hrtime(true);
        $this->validateRelativePath($relativePath);

        $tmpDir = sys_get_temp_dir() . '/proofpatch_oracle_' . bin2hex(random_bytes(8));
        $targetFile = $tmpDir . '/' . $relativePath;
        $harnessFile = $tmpDir . '/tests/order_total.php';

        try {
            $targetDir = dirname($targetFile);
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0700, true);
            }
            $harnessDir = dirname($harnessFile);
            if (!is_dir($harnessDir)) {
                mkdir($harnessDir, 0700, true);
            }

            file_put_contents($targetFile, $source);
            file_put_contents($harnessFile, $testHarness);

            $initialTargetSha = hash_file('sha256', $targetFile);
            $initialHarnessSha = hash_file('sha256', $harnessFile);

            $timedOut = false;
            $cmd = [
                'php',
                '-n',
                '-d',
                'open_basedir=' . $tmpDir . ':/tmp',
                'tests/order_total.php',
            ];

            try {
                $proc = LocalProcess::create($cmd, $tmpDir, timeout: max(2, min(10, $timeoutSeconds)));
                $proc->run();
                $exitCode = (int) $proc->getExitCode();
                $stdout = trim($proc->getOutput());
                $stderr = trim($proc->getErrorOutput());
            } catch (\Throwable $e) {
                $timedOut = str_contains(strtolower($e->getMessage()), 'timeout');
                $exitCode = 1;
                $stdout = '';
                $stderr = 'execution error: ' . $e->getMessage();
            }

            $postTargetSha = is_file($targetFile) ? hash_file('sha256', $targetFile) : '';
            $postHarnessSha = is_file($harnessFile) ? hash_file('sha256', $harnessFile) : '';

            if (!hash_equals((string) $initialTargetSha, (string) $postTargetSha)
                || !hash_equals((string) $initialHarnessSha, (string) $postHarnessSha)) {
                $finalExitCode = 1;
                $oracleVerified = false;
                $output = "[PROOFPATCH_ORACLE_ABORT: Filesystem tampering detected during harness execution]\n";
            } elseif (str_contains($stdout, '[PROOFPATCH_ORACLE_SUCCESS') || str_contains($stderr, '[PROOFPATCH_ORACLE_SUCCESS')
                || str_contains($stdout, '[PROOFPATCH_ORACLE_ABORT') || str_contains($stderr, '[PROOFPATCH_ORACLE_ABORT')) {
                $finalExitCode = 1;
                $oracleVerified = false;
                $output = "[PROOFPATCH_ORACLE_ABORT: Candidate attempted oracle sentinel injection]\n";
            } elseif ($exitCode !== 0 || $stderr !== '' || str_contains($stdout, 'expected ')) {
                $finalExitCode = 1;
                $oracleVerified = false;
                $combined = trim($stderr . "\n" . $stdout);
                $output = ($combined !== '' ? $combined : "worker exited with code {$exitCode}") . "\n";
            } elseif (!str_contains($stdout, 'All order total cases passed.')) {
                $finalExitCode = 1;
                $oracleVerified = false;
                $output = "[PROOFPATCH_ORACLE_ABORT: Test harness did not reach natural completion]\n";
            } else {
                $workerCheck = $this->verifyCasesInSeparateWorkers($tmpDir, $relativePath, $testHarness, $timeoutSeconds);
                if (!$workerCheck['passed']) {
                    $finalExitCode = 1;
                    $oracleVerified = false;
                    $output = $workerCheck['output'];
                } else {
                    $finalExitCode = 0;
                    $oracleVerified = true;
                    $output = "All order total cases passed.\n";
                }
            }

            $durationMs = (int) ((hrtime(true) - $startTime) / 1_000_000);

            return [
                'exitCode' => $finalExitCode,
                'output' => $output,
                'logSha256' => hash('sha256', $output),
                'durationMs' => $durationMs,
                'sandboxId' => 'simulated-proc-' . bin2hex(random_bytes(6)),
                'runnerType' => 'simulated-unisolated-oracle',
                'genuineProviderEvidence' => false,
                'networkBlocked' => false,
                'credentialsMounted' => false,
                'isolated' => false,
                'oracleVerified' => $oracleVerified,
                'truncated' => false,
                'timedOut' => $timedOut,
            ];
        } finally {
            @unlink($targetFile);
            @unlink($harnessFile);
            $this->removeDirectory($tmpDir);
        }
    }

    /**
     * @return array{passed: bool, output: string}
     */
    private function verifyCasesInSeparateWorkers(
        string $tmpDir,
        string $relativePath,
        string $testHarness,
        int $timeoutSeconds
    ): array {
        $workerFile = $tmpDir . '/_oracle_worker.php';
        file_put_contents($workerFile, self::getWorkerScript());
        $cases = $this->resolveTestCases($testHarness);
        $failures = [];

        try {
            foreach ($cases as $name => [$items, $expected]) {
                $cmd = [
                    'php',
                    '-n',
                    '-d',
                    'open_basedir=' . $tmpDir . ':/tmp',
                    '_oracle_worker.php',
                    $relativePath,
                    json_encode($items, JSON_THROW_ON_ERROR),
                ];

                $proc = LocalProcess::create($cmd, $tmpDir, timeout: max(2, min(10, $timeoutSeconds)));
                $proc->run();
                $exitCode = (int) $proc->getExitCode();
                $stdout = trim($proc->getOutput());
                $stderr = trim($proc->getErrorOutput());

                if ($exitCode !== 0 || $stderr !== '') {
                    $reason = $stderr !== '' ? $stderr : "worker exited with code {$exitCode}";
                    $failures[] = "{$name}: {$reason}";
                    continue;
                }

                $decoded = json_decode($stdout, true);
                if (!is_array($decoded) || !array_key_exists('order_total', $decoded) || !is_int($decoded['order_total'])) {
                    $failures[] = "{$name}: invalid worker JSON output";
                    continue;
                }

                $actual = $decoded['order_total'];
                if ($actual !== $expected) {
                    $failures[] = "{$name}: expected {$expected}, got {$actual}";
                }
            }
        } finally {
            @unlink($workerFile);
        }

        if ($failures !== []) {
            return [
                'passed' => false,
                'output' => implode("\n", $failures) . "\n",
            ];
        }

        return [
            'passed' => true,
            'output' => "All order total cases passed.\n",
        ];
    }

    private function resolveTestCases(string $testHarness): array
    {
        $testSha = hash('sha256', $testHarness);
        if (hash_equals(OwnedCaseVerifier::KNOWN_TEST_SHA256_DEDICATED, $testSha)
            || str_contains($testHarness, "'single item' =>")
            || str_contains($testHarness, "'mixed quantities' =>")) {
            return self::DEDICATED_CASES;
        }

        return self::FIXTURE_CASES;
    }

    private function validateRelativePath(string $path): void
    {
        if (str_starts_with($path, '/') || str_contains($path, '..') || str_contains($path, '\\')) {
            throw new \InvalidArgumentException("Path traversal or absolute paths are strictly prohibited: '{$path}'");
        }
        if (!preg_match('~\A[a-zA-Z0-9_./-]+\z~', $path)) {
            throw new \InvalidArgumentException("Invalid characters in relative file path: '{$path}'");
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $item) {
            $item->isDir() && !$item->isLink() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($dir);
    }

    public static function getWorkerScript(): string
    {
        return <<<'PHP'
<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

$candidatePath = $argv[1] ?? '';
$inputJson = $argv[2] ?? '';

if (!is_file($candidatePath)) {
    fwrite(STDERR, "Candidate file missing.\n");
    exit(2);
}

$items = json_decode($inputJson, true);
if (!is_array($items)) {
    fwrite(STDERR, "Invalid input JSON.\n");
    exit(2);
}

// Trap any output before/during execution
ob_start();

try {
    require $candidatePath;
    if (!function_exists('orderTotal')) {
        fwrite(STDERR, "Function orderTotal() not defined in candidate.\n");
        exit(2);
    }
    $result = orderTotal($items);
} catch (\Throwable $e) {
    ob_end_clean();
    fwrite(STDERR, "Exception in candidate: " . $e->getMessage() . "\n");
    exit(3);
}

$spuriousOutput = ob_get_clean();
if ($spuriousOutput !== '' && $spuriousOutput !== false) {
    fwrite(STDERR, "Candidate emitted illegal stdout text: " . substr((string) $spuriousOutput, 0, 100) . "\n");
    exit(4);
}

if (!is_int($result)) {
    fwrite(STDERR, "Candidate returned non-integer value.\n");
    exit(5);
}

// Strict JSON response to supervisor
echo json_encode(['order_total' => $result], JSON_THROW_ON_ERROR);
exit(0);
PHP;
    }
}
