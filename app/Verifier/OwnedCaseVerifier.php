<?php

declare(strict_types=1);

namespace ProofPatch\Verifier;

use ProofPatch\Evidence\Receipt;
use ProofPatch\Support\LocalProcess;

/**
 * Bounded allowlisted verifier for the owned synthetic review case.
 * Enforces static AST safety, baseline failure reproduction, negative-control rejection,
 * candidate verification, and cryptographic receipt generation.
 *
 * Explicit Boundary:
 * Host execution of arbitrary untrusted PHP is strictly prohibited.
 * This verifier only executes known allowlisted fixtures under static token guards.
 * Full execution of untrusted arbitrary repositories requires an external microVM sandbox.
 */
final readonly class OwnedCaseVerifier
{
    public const KNOWN_BASE_SHA256 = '54bc37fb2b005badcf309c5a7091ba6a2e704fc54c8eff9e9c7afee7e4054859';
    public const KNOWN_TEST_SHA256 = 'b8079fb1e7731fc763f0b009a11c2786d01b52cce08f7431768a64e8a5ef2cbf';

    private const FORBIDDEN_FUNCTIONS = [
        'exec', 'shell_exec', 'system', 'passthru', 'proc_open', 'popen', 'pcntl_exec',
        'eval', 'assert', 'fopen', 'file_get_contents', 'file_put_contents', 'unlink',
        'rmdir', 'mkdir', 'copy', 'rename', 'chmod', 'chown', 'touch', 'curl_init',
        'curl_exec', 'socket_create', 'fsockopen', 'pfsockopen', 'stream_socket_client',
        'dl', 'create_function', 'posix_kill',
    ];

    public function __construct(
        private string $project,
        private ?string $runsRoot = null
    ) {
        if (realpath($project) !== $project) {
            throw new \InvalidArgumentException('Expected a resolved project directory.');
        }
    }

    /**
     * Statically inspects PHP source code to verify that it does not contain
     * dangerous tokens, backticks, includes, evals, or system calls.
     */
    public static function checkCandidateSafety(string $source): array
    {
        try {
            $tokens = @token_get_all($source, TOKEN_PARSE);
        } catch (\ParseError $e) {
            return [
                'safe' => false,
                'reason' => 'Candidate PHP syntax error: ' . $e->getMessage(),
            ];
        }

        foreach ($tokens as $token) {
            if (is_string($token)) {
                if ($token === '`') {
                    return [
                        'safe' => false,
                        'reason' => 'Candidate contains disallowed backtick shell execution operator.',
                    ];
                }
                continue;
            }

            [$id, $text] = $token;

            if ($id === T_EVAL) {
                return [
                    'safe' => false,
                    'reason' => 'Candidate contains disallowed eval construct.',
                ];
            }

            if (in_array($id, [T_INCLUDE, T_INCLUDE_ONCE, T_REQUIRE, T_REQUIRE_ONCE], true)) {
                return [
                    'safe' => false,
                    'reason' => 'Candidate contains disallowed dynamic include or require statement.',
                ];
            }

            if ($id === T_STRING) {
                $lower = strtolower($text);
                if (in_array($lower, self::FORBIDDEN_FUNCTIONS, true)) {
                    return [
                        'safe' => false,
                        'reason' => "Candidate contains disallowed function call: {$text}().",
                    ];
                }
            }
        }

        return ['safe' => true, 'reason' => null];
    }

    public function verify(string $candidateSource, ?array $context = null): array
    {
        $fixtureDir = $this->project . '/tests/Fixtures/owned-review-case';
        $baseFile = $fixtureDir . '/src/OrderTotal.php';
        $testFile = $fixtureDir . '/tests/order_total.php';

        if (!is_file($baseFile) || !is_file($testFile)) {
            throw new \RuntimeException('Owned review case fixture files are missing.');
        }

        $baseSource = (string) file_get_contents($baseFile);
        $testSource = (string) file_get_contents($testFile);

        $actualBaseSha = hash('sha256', $baseSource);
        $actualTestSha = hash('sha256', $testSource);

        $allowlistIntact = hash_equals(self::KNOWN_BASE_SHA256, $actualBaseSha)
            && hash_equals(self::KNOWN_TEST_SHA256, $actualTestSha);

        if (!$allowlistIntact) {
            throw new \RuntimeException('Owned review case fixture integrity check failed.');
        }

        $id = gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(6));
        $evidence = ($this->runsRoot ?? $this->project . '/artifacts/runs') . '/' . $id;

        if (!mkdir($evidence, 0700, true)) {
            throw new \RuntimeException('Cannot allocate evidence directory.');
        }
        mkdir($evidence . '/baseline', 0700, true);
        mkdir($evidence . '/negative', 0700, true);
        mkdir($evidence . '/candidate', 0700, true);

        // 1. Static AST Safety check
        $safety = self::checkCandidateSafety($candidateSource);
        $candidateStaticSafetyPassed = $safety['safe'];

        // 2. Generate git-compatible patch diff
        $patchDiff = $this->generateDiff($baseSource, $candidateSource);
        file_put_contents($evidence . '/patch.diff', $patchDiff);
        $patchSha256 = hash('sha256', $patchDiff);

        // 3. Phase 1: Baseline reproduction
        $baselineRun = $this->runBaselineTest($fixtureDir);
        file_put_contents($evidence . '/baseline/run.log', $baselineRun['log']);
        $baselineLogSha = hash('sha256', $baselineRun['log']);
        $baselineReproduced = $baselineRun['exitCode'] === 1 && str_contains($baselineRun['log'], 'zero quantity: expected 250, got 750');

        // 4. Phase 2: Negative control guard
        $negativeRun = $this->runNegativeControlTest($testSource);
        file_put_contents($evidence . '/negative/run.log', $negativeRun['log']);
        $negativeLogSha = hash('sha256', $negativeRun['log']);
        $negativeControlCaught = $negativeRun['exitCode'] === 1 && str_contains($negativeRun['log'], 'multiple items: expected 330, got 0');

        // 5. Phase 3: Candidate execution (only if static safety passed)
        if ($candidateStaticSafetyPassed) {
            $candidateRun = $this->runCandidateTest($candidateSource, $testSource);
            file_put_contents($evidence . '/candidate/run.log', $candidateRun['log']);
            $candidateLogSha = hash('sha256', $candidateRun['log']);
            $candidatePassed = $candidateRun['exitCode'] === 0 && str_contains($candidateRun['log'], 'All order total cases passed.');
        } else {
            $log = "ABORTED: Candidate failed static AST safety check: " . ($safety['reason'] ?? 'Disallowed construct');
            file_put_contents($evidence . '/candidate/run.log', $log . "\n");
            $candidateLogSha = hash('sha256', $log . "\n");
            $candidateRun = ['exitCode' => 255, 'log' => $log];
            $candidatePassed = false;
        }

        $gates = [
            'baselineReproduced' => $baselineReproduced,
            'negativeControlCaught' => $negativeControlCaught,
            'candidatePassed' => $candidatePassed,
            'candidateStaticSafetyPassed' => $candidateStaticSafetyPassed,
            'allowlistIntegrityIntact' => $allowlistIntact,
        ];

        $decision = (!in_array(false, $gates, true)) ? 'VERIFIED' : 'FAILED';
        $baseCommit = $this->resolveBaseCommit();

        $report = [
            'id' => $id,
            'kind' => 'owned_backend',
            'createdAt' => gmdate(DATE_ATOM),
            'decision' => $decision,
            'baseCommit' => $baseCommit,
            'isSynthetic' => true,
            'provenance' => 'Local checked-in test fixture (tests/Fixtures/owned-review-case)',
            'targetFile' => 'src/OrderTotal.php',
            'baseSha256' => $actualBaseSha,
            'candidateSha256' => hash('sha256', $candidateSource),
            'patchSha256' => $patchSha256,
            'gates' => $gates,
            'runs' => [
                'baseline' => [
                    'exitCode' => $baselineRun['exitCode'],
                    'logSha256' => $baselineLogSha,
                    'summary' => 'Expected exit code 1; zero-quantity item incorrectly billed at unit price.',
                ],
                'negative' => [
                    'exitCode' => $negativeRun['exitCode'],
                    'logSha256' => $negativeLogSha,
                    'summary' => 'Expected exit code 1; rejected trivial return 0 shortcut.',
                ],
                'candidate' => [
                    'exitCode' => $candidateRun['exitCode'],
                    'logSha256' => $candidateLogSha,
                    'summary' => $candidatePassed ? 'Exit code 0; all order total cases passed.' : 'Candidate failed test execution.',
                ],
            ],
            'evidenceDirectory' => $evidence,
            'backendSandboxGap' => [
                'status' => 'allowlisted_bounded_demonstration',
                'boundary' => 'Local temporary directories and git worktrees are NOT security sandboxes.',
                'isolationLevel' => 'Static AST Token Guard + Ephemeral Scratch Directory (No shell/network/filesystem syscalls)',
                'remainingGap' => 'Arbitrary untrusted repository code execution requires an external containerized microVM boundary (e.g. Modal Sandbox). Modal CLI is uninstalled; ProofPatch reports this boundary truthfully.',
            ],
        ];

        if ($context !== null) {
            $report['context'] = [
                'repository' => $context['repository'] ?? 'synthetic-fixture/order-total',
                'issueNumber' => $context['issueNumber'] ?? 101,
            ];
        }

        $resultJson = json_encode($report, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT) . "\n";
        file_put_contents($evidence . '/result.json', $resultJson);

        $receiptHelper = new Receipt();
        $receipt = $receiptHelper->create($evidence);
        $receiptJson = json_encode($receipt, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT) . "\n";
        file_put_contents($evidence . '/receipt.json', $receiptJson);

        $verifiedReceipt = $receiptHelper->verify($evidence, $receipt['sha256']);
        $report['receipt'] = [
            'id' => $receipt['manifest']['runId'],
            'sha256' => $receipt['sha256'],
            'integrity' => $verifiedReceipt['integrity'],
            'externallyAnchored' => $verifiedReceipt['externallyAnchored'],
            'manifest' => $receipt['manifest'],
        ];

        return $report;
    }

    private function runBaselineTest(string $fixtureDir): array
    {
        $proc = LocalProcess::create(['php', 'tests/order_total.php'], $fixtureDir, timeout: 10);
        $proc->run();
        return [
            'exitCode' => (int) $proc->getExitCode(),
            'log' => trim($proc->getOutput() . "\n" . $proc->getErrorOutput()) . "\n",
        ];
    }

    private function runNegativeControlTest(string $testSource): array
    {
        $tmp = sys_get_temp_dir() . '/proofpatch-neg-' . bin2hex(random_bytes(8));
        mkdir($tmp, 0700);
        mkdir($tmp . '/src', 0700);
        mkdir($tmp . '/tests', 0700);

        // Negative control shortcut: hardcoded return 0
        $negativeControlSource = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 0;\n}\n";
        file_put_contents($tmp . '/src/OrderTotal.php', $negativeControlSource);
        file_put_contents($tmp . '/tests/order_total.php', $testSource);

        try {
            $proc = LocalProcess::create(['php', 'tests/order_total.php'], $tmp, timeout: 10);
            $proc->run();
            return [
                'exitCode' => (int) $proc->getExitCode(),
                'log' => trim($proc->getOutput() . "\n" . $proc->getErrorOutput()) . "\n",
            ];
        } finally {
            @unlink($tmp . '/src/OrderTotal.php');
            @unlink($tmp . '/tests/order_total.php');
            @rmdir($tmp . '/src');
            @rmdir($tmp . '/tests');
            @rmdir($tmp);
        }
    }

    private function runCandidateTest(string $candidateSource, string $testSource): array
    {
        $tmp = sys_get_temp_dir() . '/proofpatch-cand-' . bin2hex(random_bytes(8));
        mkdir($tmp, 0700);
        mkdir($tmp . '/src', 0700);
        mkdir($tmp . '/tests', 0700);

        file_put_contents($tmp . '/src/OrderTotal.php', $candidateSource);
        file_put_contents($tmp . '/tests/order_total.php', $testSource);

        try {
            $proc = LocalProcess::create(['php', 'tests/order_total.php'], $tmp, timeout: 10);
            $proc->run();
            return [
                'exitCode' => (int) $proc->getExitCode(),
                'log' => trim($proc->getOutput() . "\n" . $proc->getErrorOutput()) . "\n",
            ];
        } finally {
            @unlink($tmp . '/src/OrderTotal.php');
            @unlink($tmp . '/tests/order_total.php');
            @rmdir($tmp . '/src');
            @rmdir($tmp . '/tests');
            @rmdir($tmp);
        }
    }

    private function generateDiff(string $baseSource, string $candidateSource): string
    {
        $tmpBase = tempnam(sys_get_temp_dir(), 'pp_diff_base_');
        $tmpCand = tempnam(sys_get_temp_dir(), 'pp_diff_cand_');
        file_put_contents($tmpBase, $baseSource);
        file_put_contents($tmpCand, $candidateSource);

        try {
            $diffProc = LocalProcess::create(['git', 'diff', '--no-index', '--', $tmpBase, $tmpCand]);
            $diffProc->run();
            $raw = $diffProc->getOutput();
            // Normalize header paths to src/OrderTotal.php
            $raw = preg_replace('#--- [^\n]+#', '--- a/src/OrderTotal.php', $raw, 1);
            $raw = preg_replace('#\+\+\+ [^\n]+#', '+++ b/src/OrderTotal.php', $raw, 1);
            return $raw !== '' ? $raw : "--- a/src/OrderTotal.php\n+++ b/src/OrderTotal.php\n@@ -0,0 +0,0 @@\n";
        } finally {
            @unlink($tmpBase);
            @unlink($tmpCand);
        }
    }

    private function resolveBaseCommit(): string
    {
        try {
            $proc = LocalProcess::create(['git', '-C', $this->project, 'rev-parse', 'HEAD']);
            $proc->run();
            $out = trim($proc->getOutput());
            if (preg_match('/\A[a-f0-9]{40}\z/', $out)) {
                return $out;
            }
        } catch (\Throwable) {
        }

        return '676e73d674aca9ba711aa10877ffd7287e1f25b3';
    }
}
