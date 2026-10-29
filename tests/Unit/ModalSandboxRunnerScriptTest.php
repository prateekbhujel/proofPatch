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
