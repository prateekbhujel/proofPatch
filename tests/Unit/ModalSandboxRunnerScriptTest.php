<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class ModalSandboxRunnerScriptTest extends TestCase
{
    private string $scriptPath;
    private string $tempDir;

    protected function setUp(): void
    {
        $this->scriptPath = dirname(__DIR__, 2) . '/scripts/modal_sandbox_runner.py';
        $this->tempDir = sys_get_temp_dir() . '/proofpatch_script_test_' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0700, true);
    }

    protected function tearDown(): void
    {
        if (is_dir($this->tempDir)) {
            foreach (glob($this->tempDir . '/*') ?: [] as $file) {
                @unlink($file);
            }
            @rmdir($this->tempDir);
        }
    }

    public function testScriptCompilesCleanlyWithPython3(): void
    {
        self::assertFileExists($this->scriptPath);
        $cmd = 'python3 -m py_compile ' . escapeshellarg($this->scriptPath) . ' 2>&1';
        $output = shell_exec($cmd);
        self::assertEmpty($output, 'modal_sandbox_runner.py has syntax errors: ' . $output);
    }

    public function testRejectsMissingArgumentsWithExitCode2(): void
    {
        $cmd = escapeshellcmd($this->scriptPath) . ' 2>&1';
        $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $proc = proc_open($cmd, $descriptors, $pipes);
        self::assertIsResource($proc);

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($proc);
        self::assertSame(2, $exitCode);
        self::assertStringContainsString('required', $stdout . $stderr);
    }

    public function testRejectsNonExistentSpecFileWithExitCode2(): void
    {
        $nonExistent = $this->tempDir . '/does_not_exist.json';
        $resFile = $this->tempDir . '/result.json';

        $cmd = 'python3 ' . escapeshellarg($this->scriptPath) . ' ' . escapeshellarg($nonExistent) . ' ' . escapeshellarg($resFile) . ' 2>&1';
        exec($cmd, $output, $code);

        self::assertSame(2, $code);
        self::assertStringContainsString('Spec file not found', implode("\n", $output));
    }

    public function testRejectsMalformedSpecJsonWithExitCode2(): void
    {
        $badSpec = $this->tempDir . '/bad_spec.json';
        file_put_contents($badSpec, 'NOT_VALID_JSON{:::');
        $resFile = $this->tempDir . '/result.json';

        $cmd = 'python3 ' . escapeshellarg($this->scriptPath) . ' ' . escapeshellarg($badSpec) . ' ' . escapeshellarg($resFile) . ' 2>&1';
        exec($cmd, $output, $code);

        self::assertSame(2, $code);
        self::assertStringContainsString('Failed to read or parse spec file', implode("\n", $output));
    }

    public function testRejectsPathTraversalInSpecWithExitCode2(): void
    {
        $traversalSpec = $this->tempDir . '/traversal_spec.json';
        file_put_contents($traversalSpec, json_encode([
            'source_b64' => base64_encode('<?php echo 1;'),
            'test_harness_b64' => base64_encode('<?php exit(0);'),
            'relative_path' => '../escape/malicious.php',
        ]));
        $resFile = $this->tempDir . '/result.json';

        $cmd = 'python3 ' . escapeshellarg($this->scriptPath) . ' ' . escapeshellarg($traversalSpec) . ' ' . escapeshellarg($resFile) . ' 2>&1';
        exec($cmd, $output, $code);

        self::assertSame(2, $code);
        self::assertStringContainsString('Path traversal or absolute paths are strictly prohibited', implode("\n", $output));
    }

    public function testRejectsUntrustedCandidateBeforeImportingModal(): void
    {
        $harness = (string) file_get_contents(dirname(__DIR__) . '/Fixtures/owned-review-case/tests/order_total.php');
        $candidate = '<?php function orderTotal(array $items): int { $GLOBALS["expected"] = 0; return 0; }';
        $spec = $this->tempDir . '/spec.json';
        $result = $this->tempDir . '/result.json';
        file_put_contents($spec, json_encode([
            'source_b64' => base64_encode($candidate),
            'test_harness_b64' => base64_encode($harness),
            'relative_path' => 'src/OrderTotal.php',
        ], JSON_THROW_ON_ERROR));
        // If a regression reaches the import, this inert stub prevents a provider call.
        file_put_contents($this->tempDir . '/modal.py', "raise RuntimeError('Modal was imported')\n");

        $cmd = 'PYTHONPATH=' . escapeshellarg($this->tempDir) . ' python3 '
            . escapeshellarg($this->scriptPath) . ' ' . escapeshellarg($spec) . ' ' . escapeshellarg($result) . ' 2>&1';
        exec($cmd, $output, $code);

        self::assertSame(2, $code);
        self::assertStringContainsString('Untrusted candidates are blocked', implode("\n", $output));
        self::assertStringNotContainsString('Modal was imported', implode("\n", $output));
        self::assertFileDoesNotExist($result);
    }

    public function testPinnedFixtureHashesRemainInSyncWithVerifier(): void
    {
        $script = (string) file_get_contents($this->scriptPath);
        self::assertStringContainsString(\ProofPatch\Verifier\OwnedCaseVerifier::KNOWN_BASE_SHA256, $script);
        self::assertStringContainsString(\ProofPatch\Verifier\OwnedCaseVerifier::KNOWN_TRUSTED_CANDIDATE_SHA256, $script);
        self::assertStringContainsString(\ProofPatch\Verifier\OwnedCaseVerifier::KNOWN_TEST_SHA256, $script);
        self::assertStringContainsString(\ProofPatch\Verifier\OwnedCaseVerifier::KNOWN_TEST_SHA256_DEDICATED, $script);
        $negative = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 0;\n}\n";
        self::assertStringContainsString(hash('sha256', $negative), $script);
    }

    public function testPinnedBaselineAndHarnessAreAcceptedWithoutProviderCall(): void
    {
        $fixture = dirname(__DIR__) . '/Fixtures/owned-review-case';
        $program = <<<'PY'
import base64, importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('proofpatch_runner', sys.argv[1])
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
root = pathlib.Path(sys.argv[2])
source = base64.b64encode((root / 'src/OrderTotal.php').read_bytes()).decode()
harness = base64.b64encode((root / 'tests/order_total.php').read_bytes()).decode()
runner.validate_pinned_spec(source, harness, 'src/OrderTotal.php', 'tests/order_total.php', runner.DEFAULT_IMAGE)
print('accepted')
PY;
        $cmd = 'python3 -c ' . escapeshellarg($program) . ' '
            . escapeshellarg($this->scriptPath) . ' ' . escapeshellarg($fixture) . ' 2>&1';
        exec($cmd, $output, $code);
        self::assertSame(0, $code, implode("\n", $output));
        self::assertSame(['accepted'], $output);
    }

    public function testRejectsChangedHarnessAndImageBeforeImportingModal(): void
    {
        $fixture = dirname(__DIR__) . '/Fixtures/owned-review-case';
        $source = (string) file_get_contents($fixture . '/src/OrderTotal.php');
        $harness = (string) file_get_contents($fixture . '/tests/order_total.php');
        file_put_contents($this->tempDir . '/modal.py', "raise RuntimeError('Modal was imported')\n");

        foreach ([
            ['test_harness_b64' => base64_encode($harness . "\n"), 'expected' => 'Unrecognized test harness'],
            ['image' => 'untrusted-image:latest', 'expected' => 'pinned fixture paths and runtime image'],
            ['source_b64' => 'not-base64!', 'expected' => 'Invalid fixture encoding'],
            ['oracle_token' => "'; phpinfo(); //", 'expected' => 'Invalid oracle token'],
        ] as $case) {
            $spec = $this->tempDir . '/spec.json';
            $result = $this->tempDir . '/result.json';
            file_put_contents($spec, json_encode(array_merge([
                'source_b64' => base64_encode($source),
                'test_harness_b64' => base64_encode($harness),
                'relative_path' => 'src/OrderTotal.php',
            ], array_diff_key($case, ['expected' => true])), JSON_THROW_ON_ERROR));
            $cmd = 'PYTHONPATH=' . escapeshellarg($this->tempDir) . ' python3 '
                . escapeshellarg($this->scriptPath) . ' ' . escapeshellarg($spec) . ' ' . escapeshellarg($result) . ' 2>&1';
            exec($cmd, $output, $code);
            self::assertSame(2, $code);
            self::assertStringContainsString($case['expected'], implode("\n", $output));
            self::assertStringNotContainsString('Modal was imported', implode("\n", $output));
            self::assertFileDoesNotExist($result);
            $output = [];
        }
    }

    public function testRunnerScriptConfiguresUnprivilegedWorkerAndRootSupervisorBoundary(): void
    {
        $scriptContent = (string) file_get_contents($this->scriptPath);
        self::assertStringContainsString('proofpatch-worker', $scriptContent);
        self::assertStringContainsString('/root/supervisor', $scriptContent);
        self::assertStringContainsString('chmod 0700 /root /root/supervisor', $scriptContent);
        self::assertStringContainsString('open_basedir=/opt/proofpatch_worker:/tmp', $scriptContent);
        self::assertStringContainsString('chown -R root:root /opt/proofpatch_worker', $scriptContent);
        self::assertStringContainsString('Privilege separation unavailable', $scriptContent);
        self::assertStringContainsString('PROOFPATCH_ORACLE_SUCCESS', $scriptContent);
    }
}
