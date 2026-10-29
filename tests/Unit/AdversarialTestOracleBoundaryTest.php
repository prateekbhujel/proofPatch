<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\ServerHeldPublicationApproval;
use ProofPatch\Verifier\ModalIsolatedRunner;
use ProofPatch\Verifier\OwnedCaseVerifier;

final class AdversarialTestOracleBoundaryTest extends TestCase
{
    private string $tempDir;
    private string $evidenceDir;
    private string $approvalsDir;
    private string $baseSource;
    private string $testHarness;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/proofpatch_adversarial_' . bin2hex(random_bytes(6));
        $this->evidenceDir = $this->tempDir . '/runs';
        $this->approvalsDir = $this->tempDir . '/approvals';

        mkdir($this->tempDir, 0700, true);
        mkdir($this->evidenceDir, 0700, true);
        mkdir($this->approvalsDir, 0700, true);

        $fixturePath = dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case';
        $this->baseSource = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $this->testHarness = (string) file_get_contents($fixturePath . '/tests/order_total.php');
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

    private function createVerifierWithRunner(callable $executor): OwnedCaseVerifier
    {
        $projectRoot = dirname(__DIR__, 2);
        $approvalStore = new ServerHeldPublicationApproval($this->approvalsDir);
        $runner = new ModalIsolatedRunner(
            pythonPath: null,
            grantVerified: true,
            sandboxExecutor: $executor
        );

        return new OwnedCaseVerifier(
            project: $projectRoot,
            runsRoot: $this->evidenceDir,
            approvalStore: $approvalStore,
            isolatedRunner: $runner
        );
    }

    /**
     * Vector 1: Echoed success string without passing tests must NOT spoof verification.
     */
    public function testEchoedSuccessCannotSpoofVerification(): void
    {
        // Candidate echoes success string but calculation fails
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 0;\n}\n";

        $verifier = $this->createVerifierWithRunner(function (string $src, string $harness, string $path, int $timeout) {
            // Simulated runner correctly reports test failure output despite candidate
            return [
                'exitCode' => 1,
                'output' => "zero quantity: expected 0, got 100\n",
                'oracleVerified' => false,
                'sandboxId' => 'sb-adversarial-echo',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 2: Candidate with exit(0) / die(0) must fail closed.
     */
    public function testEarlyExitZeroCannotSpoofVerification(): void
    {
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\necho \"All order total cases passed.\\n\";\nexit(0);\n";

        // Static safety checker must reject exit/die immediately
        $safety = OwnedCaseVerifier::checkCandidateSafety($adversarialCandidate);
        self::assertFalse($safety['safe']);
        self::assertStringContainsString('disallowed', strtolower($safety['reason']));

        $verifier = $this->createVerifierWithRunner(function () {
            // Even if runner returned exit 0, oracle was not verified
            return [
                'exitCode' => 254,
                'output' => "[PROOFPATCH_ORACLE_ABORT] Test execution terminated prematurely\n",
                'oracleVerified' => false,
                'sandboxId' => 'sb-adversarial-exit',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 3: Candidate with infinite loop / timeout must fail closed.
     */
    public function testTimeoutFailsClosed(): void
    {
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    while (true) {}\n    return 0;\n}\n";

        $verifier = $this->createVerifierWithRunner(function (string $src, string $harness, string $path, int $timeout) {
            return [
                'exitCode' => 124,
                'output' => "[TIMEOUT: Subprocess parent deadline exceeded.]\n",
                'oracleVerified' => false,
                'timedOut' => true,
                'sandboxId' => 'sb-adversarial-timeout',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 4: Candidate throwing unhandled exception must fail closed.
     */
    public function testUnhandledExceptionFailsClosed(): void
    {
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    throw new \\RuntimeException(\"Explosion\");\n}\n";

        $verifier = $this->createVerifierWithRunner(function () {
            return [
                'exitCode' => 255,
                'output' => "Fatal error: Uncaught RuntimeException: Explosion\n",
                'oracleVerified' => false,
                'sandboxId' => 'sb-adversarial-exception',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 5: Output flood exceeding MAX_OUTPUT_BYTES must fail closed.
     */
    public function testOutputFloodFailsClosed(): void
    {
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 0;\n}\n";

        $verifier = $this->createVerifierWithRunner(function () {
            // Simulated runner detected output flood and truncated stream
            return [
                'exitCode' => 1,
                'output' => str_repeat("FLOOD ", 15000),
                'truncated' => true,
                'oracleVerified' => false,
                'sandboxId' => 'sb-adversarial-flood',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 6: Candidate attempting to mutate test harness must fail closed.
     */
    public function testMutatedTestsFailsClosed(): void
    {
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    file_put_contents('tests/order_total.php', '<?php exit(0);');\n    return 0;\n}\n";

        // Static safety checker must reject file_put_contents
        $safety = OwnedCaseVerifier::checkCandidateSafety($adversarialCandidate);
        self::assertFalse($safety['safe']);
        self::assertStringContainsString('file_put_contents', $safety['reason']);

        $verifier = $this->createVerifierWithRunner(function () {
            return [
                'exitCode' => 1,
                'output' => "Permission denied writing to tests/order_total.php\n",
                'oracleVerified' => false,
                'sandboxId' => 'sb-adversarial-mutate',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($report['gates']['candidatePassed']);
    }

    /**
     * Vector 7: Candidate returning wrong calculation must fail closed.
     */
    public function testWrongResultFailsClosed(): void
    {
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 999;\n}\n";

        $verifier = $this->createVerifierWithRunner(function () {
            return [
                'exitCode' => 1,
                'output' => "empty order: expected 0, got 999\n",
                'oracleVerified' => false,
                'sandboxId' => 'sb-adversarial-wrong',
            ];
        });

        $report = $verifier->verify($adversarialCandidate);

        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 8: Top-level expressions outside function/class declaration must be rejected by AST checker.
     */
    public function testTopLevelExecutableStatementsRejected(): void
    {
        $topLevelVar = "<?php\ndeclare(strict_types=1);\n\$globalAttack = 123;\nfunction orderTotal(array \$items): int { return 0; }\n";
        $safety1 = OwnedCaseVerifier::checkCandidateSafety($topLevelVar);
        self::assertFalse($safety1['safe']);
        self::assertStringContainsString('top-level executable statement', $safety1['reason']);

        $topLevelEcho = "<?php\ndeclare(strict_types=1);\necho 'hello';\nfunction orderTotal(array \$items): int { return 0; }\n";
        $safety2 = OwnedCaseVerifier::checkCandidateSafety($topLevelEcho);
        self::assertFalse($safety2['safe']);
        self::assertStringContainsString('echo/print', $safety2['reason']);
    }

    /**
     * Vector 9: IsolatedRunnerInterface test double cannot spoof verification with adversarial candidates.
     * Reproduces the scenario where a runner double claims exit 0 and oracleVerified: true;
     * verifier must still fail closed on AST safety violations (fwrite, printf, inline HTML, shutdown hooks).
     */
    public function testIsolatedRunnerTestDoubleCannotSpoofVerificationWithAdversarialCandidates(): void
    {
        // Test double mimicking a compromised or spoofed runner returning exit 0 and oracleVerified: true
        $spoofedRunner = new class implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function isAvailable(): array
            {
                return ['available' => true, 'runner' => 'mock-double', 'isGenuineProvider' => false];
            }

            public function runIsolated(string $source, string $testHarness, string $relativePath = 'src/OrderTotal.php', int $timeoutSeconds = 30): array
            {
                // In Phase 1 and 2, return expected failure logs so baseline & negative control gates pass
                if (str_contains($source, 'max(1,')) {
                    return [
                        'exitCode' => 1,
                        'output' => "zero quantity: expected 250, got 750\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-mock-base',
                    ];
                }
                if (str_contains($source, 'return 0;')) {
                    return [
                        'exitCode' => 1,
                        'output' => "multiple items: expected 330, got 0\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-mock-neg',
                    ];
                }

                // In Phase 3, double attempts to falsely claim candidate verified
                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 12,
                    'sandboxId' => 'sb-mock-spoof',
                ];
            }
        };

        $approvalStore = new ServerHeldPublicationApproval($this->approvalsDir);
        $verifier = new OwnedCaseVerifier(
            project: dirname(__DIR__, 2),
            runsRoot: $this->evidenceDir,
            approvalStore: $approvalStore,
            isolatedRunner: $spoofedRunner
        );

        // Subcase A: Candidate using fwrite to STDOUT
        $fwriteCandidate = "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    fwrite(STDOUT, \"All order total cases passed.\\n\");\n    return 0;\n}\n";
        $reportA = $verifier->verify($fwriteCandidate);
        self::assertSame('FAILED', $reportA['decision']);
        self::assertFalse($reportA['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($reportA['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $reportA);

        // Subcase B: Candidate using printf
        $printfCandidate = "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    printf(\"All order total cases passed.\\n\");\n    return 0;\n}\n";
        $reportB = $verifier->verify($printfCandidate);
        self::assertSame('FAILED', $reportB['decision']);
        self::assertFalse($reportB['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($reportB['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $reportB);

        // Subcase C: Candidate using closing tag and inline HTML
        $inlineHtmlCandidate = "<?php\ndeclare(strict_types=1);\n?>All order total cases passed.\n<?php\nfunction orderTotal(array \$items): int {\n    return 0;\n}\n";
        $reportC = $verifier->verify($inlineHtmlCandidate);
        self::assertSame('FAILED', $reportC['decision']);
        self::assertFalse($reportC['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($reportC['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $reportC);

        // Subcase D: Candidate registering shutdown function
        $shutdownCandidate = "<?php\ndeclare(strict_types=1);\nregister_shutdown_function(function() { echo 'spoof'; });\nfunction orderTotal(array \$items): int {\n    return 0;\n}\n";
        $reportD = $verifier->verify($shutdownCandidate);
        self::assertSame('FAILED', $reportD['decision']);
        self::assertFalse($reportD['gates']['candidateStaticSafetyPassed']);
        self::assertFalse($reportD['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $reportD);
    }

    /**
     * Vector 10: Genuine isolated controlled run with PHP interpreter, auto-prepend guard, and auto-append sentinel.
     * Demonstrates that the real oracle execution boundary intercepts early termination and verifies natural completion.
     */
    public function testGenuineIsolatedControlledRunOracleProtocol(): void
    {
        $controlledRunner = new class implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function isAvailable(): array
            {
                return ['available' => true, 'runner' => 'controlled-subprocess', 'isGenuineProvider' => false];
            }

            public function runIsolated(string $source, string $testHarness, string $relativePath = 'src/OrderTotal.php', int $timeoutSeconds = 30): array
            {
                $tempSubDir = sys_get_temp_dir() . '/proofpatch_sub_' . bin2hex(random_bytes(6));
                mkdir($tempSubDir . '/src', 0700, true);
                mkdir($tempSubDir . '/tests', 0700, true);

                $oracleToken = bin2hex(random_bytes(32));

                $guardPhp = "<?php\n"
                    . "(function() {\n"
                    . "    \$completed = false;\n"
                    . "    register_shutdown_function(function() use (&\$completed) {\n"
                    . "        if (!\$completed) {\n"
                    . "            fwrite(STDERR, \"\\n[PROOFPATCH_ORACLE_ABORT] Test execution terminated prematurely.\\n\");\n"
                    . "            exit(254);\n"
                    . "        }\n"
                    . "    });\n"
                    . "    \$GLOBALS['__proofpatch_mark_complete__'] = function() use (&\$completed) {\n"
                    . "        \$completed = true;\n"
                    . "    };\n"
                    . "})();\n";

                $appendPhp = "<?php\n"
                    . "if (isset(\$GLOBALS['__proofpatch_mark_complete__']) && is_callable(\$GLOBALS['__proofpatch_mark_complete__'])) {\n"
                    . "    \$GLOBALS['__proofpatch_mark_complete__']();\n"
                    . "    unset(\$GLOBALS['__proofpatch_mark_complete__']);\n"
                    . "}\n"
                    . "echo \"\\n[PROOFPATCH_ORACLE_SUCCESS:{$oracleToken}]\\n\";\n";

                file_put_contents($tempSubDir . '/' . $relativePath, $source);
                file_put_contents($tempSubDir . '/tests/order_total.php', $testHarness);
                file_put_contents($tempSubDir . '/tests/guard.php', $guardPhp);
                file_put_contents($tempSubDir . '/tests/append.php', $appendPhp);

                $cmd = sprintf(
                    'php -dauto_prepend_file=%s -dauto_append_file=%s %s',
                    escapeshellarg($tempSubDir . '/tests/guard.php'),
                    escapeshellarg($tempSubDir . '/tests/append.php'),
                    escapeshellarg($tempSubDir . '/tests/order_total.php')
                );

                $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
                $proc = proc_open($cmd, $descriptors, $pipes, $tempSubDir);
                if (!is_resource($proc)) {
                    throw new \RuntimeException('Failed to spawn PHP subprocess.');
                }
                fclose($pipes[0]);
                $stdout = (string) stream_get_contents($pipes[1]);
                $stderr = (string) stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $exitCode = proc_close($proc);

                // Clean up temp sub directory
                @unlink($tempSubDir . '/' . $relativePath);
                @unlink($tempSubDir . '/tests/order_total.php');
                @unlink($tempSubDir . '/tests/guard.php');
                @unlink($tempSubDir . '/tests/append.php');
                @rmdir($tempSubDir . '/src');
                @rmdir($tempSubDir . '/tests');
                @rmdir($tempSubDir);

                $sentinel = "[PROOFPATCH_ORACLE_SUCCESS:{$oracleToken}]";
                $oracleVerified = ($exitCode === 0)
                    && str_contains($stdout, $sentinel)
                    && !str_contains($stderr, '[PROOFPATCH_ORACLE_ABORT]');

                return [
                    'exitCode' => $exitCode,
                    'output' => $stdout . $stderr,
                    'oracleVerified' => $oracleVerified,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 15,
                    'sandboxId' => 'sb-controlled-sub',
                ];
            }
        };

        $approvalStore = new ServerHeldPublicationApproval($this->approvalsDir);
        $verifier = new OwnedCaseVerifier(
            project: dirname(__DIR__, 2),
            runsRoot: $this->evidenceDir,
            approvalStore: $approvalStore,
            isolatedRunner: $controlledRunner
        );

        // Test with the valid candidate: must pass all 5 gates and be VERIFIED
        $validCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    \$total = 0;\n    foreach (\$items as \$item) {\n        \$total += \$item['unit_price'] * \$item['quantity'];\n    }\n    return \$total;\n}\n";
        $reportValid = $verifier->verify($validCandidate);
        self::assertSame('VERIFIED', $reportValid['decision']);
        self::assertTrue($reportValid['gates']['candidatePassed']);
        self::assertTrue($reportValid['gates']['candidateStaticSafetyPassed']);
        self::assertTrue($reportValid['gates']['baselineReproduced']);
        self::assertTrue($reportValid['gates']['negativeControlCaught']);
        self::assertArrayHasKey('publicationAuthorizationToken', $reportValid);

        // Test with wrong calculation: must trigger [PROOFPATCH_ORACLE_ABORT], exit non-zero, and be FAILED
        $wrongCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 0;\n}\n";
        $reportWrong = $verifier->verify($wrongCandidate);
        self::assertSame('FAILED', $reportWrong['decision']);
        self::assertFalse($reportWrong['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $reportWrong);
    }

    /**
     * Vector 11: Candidate manipulating $GLOBALS['failed'] = -999999 fails closed under supervisor boundary.
     * Demonstrates that the supervisor process memory is isolated from worker $GLOBALS pollution.
     */
    public function testGlobalFailureCounterManipulationFailsClosed(): void
    {
        $oracle = new \ProofPatch\Verifier\SeparateProcessOracle();

        // Adversarial candidate attempting in-process $GLOBALS pollution
        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    \$GLOBALS['failed'] = -999999;\n    return 0;\n}\n";

        $res = $oracle->runIsolated($adversarialCandidate, $this->testHarness);

        self::assertSame(1, $res['exitCode'], 'Process supervisor must detect failed assertions despite worker $GLOBALS manipulation');
        self::assertFalse($res['oracleVerified']);
        self::assertStringContainsString('multiple items: expected 330, got 0', $res['output']);
        self::assertStringContainsString('zero quantity: expected 250, got 0', $res['output']);

        // When run through OwnedCaseVerifier with this simulated runner:
        $verifier = new OwnedCaseVerifier(
            project: dirname(__DIR__, 2),
            runsRoot: $this->evidenceDir,
            approvalStore: new ServerHeldPublicationApproval($this->approvalsDir),
            isolatedRunner: $oracle
        );

        $report = $verifier->verify($adversarialCandidate);
        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 12: Candidate manipulating $GLOBALS['failed'] = false against dedicated test harness fails closed.
     */
    public function testDedicatedHarnessGlobalCounterManipulationFailsClosed(): void
    {
        $dedicatedHarness = (string) file_get_contents(dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case/tests/order_total.php');
        $oracle = new \ProofPatch\Verifier\SeparateProcessOracle();

        $adversarialCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    \$GLOBALS['failed'] = false;\n    return 0;\n}\n";

        $res = $oracle->runIsolated($adversarialCandidate, $dedicatedHarness);

        self::assertSame(1, $res['exitCode']);
        self::assertFalse($res['oracleVerified']);

        $verifier = new OwnedCaseVerifier(
            project: dirname(__DIR__, 2),
            runsRoot: $this->evidenceDir,
            approvalStore: new ServerHeldPublicationApproval($this->approvalsDir),
            isolatedRunner: $oracle
        );

        $report = $verifier->verify($adversarialCandidate);
        self::assertSame('FAILED', $report['decision']);
        self::assertFalse($report['gates']['candidatePassed']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $report);
    }

    /**
     * Vector 13: SeparateProcessOracle attributes correctly label it as simulated, unisolated, and network-unrestricted.
     */
    public function testSeparateProcessOracleLabelsItselfAsSimulatedAndUnisolated(): void
    {
        $oracle = new \ProofPatch\Verifier\SeparateProcessOracle();
        $status = $oracle->isAvailable();

        self::assertTrue($status['available']);
        self::assertSame('simulated-unisolated-oracle', $status['runner']);
        self::assertFalse($status['isGenuineProvider'], 'Local test double must not claim genuine provider status');
        self::assertStringContainsString('unisolated', $status['reason']);

        $validCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    \$total = 0;\n    foreach (\$items as \$item) {\n        \$total += \$item['unit_price'] * \$item['quantity'];\n    }\n    return \$total;\n}\n";

        $res = $oracle->runIsolated($validCandidate, $this->testHarness);
        self::assertFalse($res['isolated'], 'Host process runner must NOT claim to be isolated');
        self::assertFalse($res['networkBlocked'], 'Host process runner must NOT claim network is blocked');
        self::assertFalse($res['genuineProviderEvidence'], 'Host process runner must NOT claim genuine provider evidence');
        self::assertSame('simulated-unisolated-oracle', $res['runnerType']);
    }

    /**
     * Vector 14: Handcrafted benign repair candidate passes all assertions under SeparateProcessOracle supervisor.
     */
    public function testBenignRepairCandidatePassesSupervisorProtocol(): void
    {
        $oracle = new \ProofPatch\Verifier\SeparateProcessOracle();

        $validCandidate = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    \$total = 0;\n    foreach (\$items as \$item) {\n        \$total += \$item['unit_price'] * \$item['quantity'];\n    }\n    return \$total;\n}\n";

        $res = $oracle->runIsolated($validCandidate, $this->testHarness);
        self::assertSame(0, $res['exitCode']);
        self::assertTrue($res['oracleVerified']);
        self::assertSame("All order total cases passed.\n", $res['output']);

        $approvalStore = new ServerHeldPublicationApproval($this->approvalsDir);
        $verifier = new OwnedCaseVerifier(
            project: dirname(__DIR__, 2),
            runsRoot: $this->evidenceDir,
            approvalStore: $approvalStore,
            isolatedRunner: $oracle
        );

        $report = $verifier->verify($validCandidate);
        self::assertSame('VERIFIED', $report['decision']);
        self::assertTrue($report['gates']['candidatePassed']);
        self::assertTrue($report['gates']['baselineReproduced']);
        self::assertTrue($report['gates']['negativeControlCaught']);
    }

    /**
     * Vector 15: Fully-qualified function names (e.g. \file_get_contents, \system, \exec) cannot bypass AST safety check.
     */
    public function testFullyQualifiedFunctionBypassesAreRejected(): void
    {
        $fqnPayloads = [
            '\\file_get_contents' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    \$x = \\file_get_contents('/etc/passwd');\n    return 0;\n}\n",
            '\\system' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    \\system('whoami');\n    return 0;\n}\n",
            '\\exec' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    \\exec('id');\n    return 0;\n}\n",
            '\\passthru' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    \\passthru('ls');\n    return 0;\n}\n",
            '\\unlink' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    \\unlink('test.txt');\n    return 0;\n}\n",
            '\\shell_exec' => "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int {\n    \$y = \\shell_exec('uname -a');\n    return 0;\n}\n",
        ];

        foreach ($fqnPayloads as $fn => $candidate) {
            $safety = OwnedCaseVerifier::checkCandidateSafety($candidate);
            self::assertFalse(
                $safety['safe'],
                "Candidate using {$fn} must be rejected by checkCandidateSafety"
            );
            self::assertStringContainsString(
                'disallowed function',
                strtolower($safety['reason']),
                "Rejection reason for {$fn} must indicate disallowed function"
            );
        }
    }
}
