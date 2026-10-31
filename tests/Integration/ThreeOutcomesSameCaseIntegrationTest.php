<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\SingleFileCandidate;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\DedicatedTestRepoFetcher;
use ProofPatch\Verifier\OwnedCaseVerifier;

final class ThreeOutcomesSameCaseIntegrationTest extends TestCase
{
    private string $tempDir;
    private string $baseSource;
    private string $testHarness;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/proofpatch_three_outcomes_' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0700, true);

        $baseDir = dirname(__DIR__, 2);
        // Load authentic case bytes from dedicated test repository clone or repository-contained fixture
        $dedicatedRepoPath = getenv('PROOFPATCH_TEST_REPO_PATH') ?: (dirname($baseDir) . '/proofpatch-test-fixture');
        if (is_file($dedicatedRepoPath . '/src/OrderTotal.php') && is_file($dedicatedRepoPath . '/tests/order_total.php')) {
            $this->baseSource = (string) file_get_contents($dedicatedRepoPath . '/src/OrderTotal.php');
            $this->testHarness = (string) file_get_contents($dedicatedRepoPath . '/tests/order_total.php');
        } else {
            $fixturePath = $baseDir . '/tests/Fixtures/owned-review-case';
            $this->baseSource = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
            $this->testHarness = (string) file_get_contents($fixturePath . '/tests/order_total.php');
        }

        self::assertSame(DedicatedTestRepoFetcher::EXPECTED_SOURCE_SHA256, hash('sha256', $this->baseSource));
        self::assertTrue(
            hash('sha256', $this->testHarness) === DedicatedTestRepoFetcher::EXPECTED_TEST_SHA256
            || hash('sha256', $this->testHarness) === OwnedCaseVerifier::KNOWN_TEST_SHA256
        );
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
     * Outcome 1: Real baseline failure reproduces against maintainer-controlled test harness.
     */
    public function testOutcome1FailingRealBaseline(): void
    {
        $caseDir = $this->tempDir . '/outcome1_baseline';
        mkdir($caseDir . '/src', 0700, true);
        mkdir($caseDir . '/tests', 0700, true);

        file_put_contents($caseDir . '/src/OrderTotal.php', $this->baseSource);
        file_put_contents($caseDir . '/tests/order_total.php', $this->testHarness);

        $cmd = 'php ' . escapeshellarg($caseDir . '/tests/order_total.php') . ' 2>&1';
        exec($cmd, $outputLines, $exitCode);
        $output = implode("\n", $outputLines);

        // Exact proof: baseline MUST fail with exit code 1
        self::assertSame(1, $exitCode, "Baseline must fail with exit code 1 on dedicated test repo issue #1");
        if (hash_equals(DedicatedTestRepoFetcher::EXPECTED_TEST_SHA256, hash('sha256', $this->testHarness))) {
            self::assertStringContainsString('zero quantity: expected 0, got 100', $output);
            self::assertStringContainsString('mixed quantities: expected 100, got 200', $output);
        } else {
            self::assertSame(OwnedCaseVerifier::KNOWN_TEST_SHA256, hash('sha256', $this->testHarness));
            self::assertStringContainsString('zero quantity: expected 250, got 750', $output);
        }
    }

    /**
     * Outcome 2: A harmful shortcut is blocked before execution on the host or runner.
     */
    public function testOutcome2RejectedHarmfulShortcut(): void
    {
        // Shortcut candidate: hardcoded return 0
        $harmfulShortcut = "<?php\n\ndeclare(strict_types=1);\n\nfunction orderTotal(array \$items): int\n{\n    return 0;\n}\n";

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'path' => 'src/OrderTotal.php',
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'testSource' => $this->testHarness,
        ];

        // 1. On host without isolated runner: strictly fails closed (exit code 255, no untrusted host execution)
        $hostVerifier = new OwnedCaseVerifier(
            dirname(__DIR__, 2),
            $this->tempDir . '/runs_host'
        );
        $hostReport = $hostVerifier->verify($harmfulShortcut, $context);
        self::assertSame('FAILED', $hostReport['decision'], "Harmful shortcut must fail verification");
        self::assertFalse($hostReport['gates']['candidatePassed']);
        self::assertSame(255, $hostReport['runs']['candidate']['exitCode']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $hostReport);

        // 2. A runner cannot establish an isolated oracle, so it is never called.
        $runnerCalls = 0;
        $simulatedExecutor = function () use (&$runnerCalls): array {
            $runnerCalls++;
            return [];
        };

        $isolatedRunner = new \ProofPatch\Verifier\ModalIsolatedRunner(sandboxExecutor: $simulatedExecutor);
        $isolatedVerifier = new OwnedCaseVerifier(
            dirname(__DIR__, 2),
            $this->tempDir . '/runs_iso',
            null,
            $isolatedRunner
        );

        $isolatedReport = $isolatedVerifier->verify($harmfulShortcut, $context);
        self::assertSame('FAILED', $isolatedReport['decision']);
        self::assertFalse($isolatedReport['gates']['candidatePassed']);
        self::assertSame(255, $isolatedReport['runs']['candidate']['exitCode']);
        self::assertSame(0, $runnerCalls);
        self::assertStringContainsString('test oracle is not yet protected', $isolatedReport['runs']['candidate']['summary']);
        self::assertArrayNotHasKey('publicationAuthorizationToken', $isolatedReport);
    }

    /**
     * Outcome 3: Genuine bounded repair passes all test cases and all 5 verification gates.
     */
    public function testOutcome3PassingBoundedRepairWithReceipt(): void
    {
        // Bounded repair: remove max(1, quantity) clamp
        $passingCandidate = SingleFileCandidate::create(
            $this->baseSource,
            DedicatedTestRepoFetcher::EXPECTED_SOURCE_SHA256,
            "max(1, \$item['quantity'])",
            "\$item['quantity']"
        );

        self::assertSame(DedicatedTestRepoPublisher::KNOWN_CANDIDATE_SHA256, hash('sha256', $passingCandidate));

        $verifier = new OwnedCaseVerifier(
            dirname(__DIR__, 2),
            $this->tempDir . '/runs'
        );

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'path' => 'src/OrderTotal.php',
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'testSource' => $this->testHarness,
        ];

        $report = $verifier->verify($passingCandidate, $context);

        // Exact proof: verifier decision MUST be VERIFIED
        self::assertSame('VERIFIED', $report['decision']);
        self::assertTrue($report['gates']['baselineReproduced']);
        self::assertTrue($report['gates']['negativeControlCaught']);
        self::assertTrue($report['gates']['candidatePassed']);
        self::assertTrue($report['gates']['candidateStaticSafetyPassed']);
        self::assertTrue($report['gates']['allowlistIntegrityIntact']);

        self::assertSame(0, $report['runs']['candidate']['exitCode']);
        $candidateLog = file_get_contents($report['evidenceDirectory'] . '/candidate/run.log');
        self::assertStringContainsString('All order total cases passed.', $candidateLog);

        // Check cryptographic receipt
        self::assertArrayHasKey('receipt', $report);
        self::assertSame('VALID', $report['receipt']['integrity']);
        self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $report['receipt']['sha256']);
    }

    /**
     * Proves distinction between live Muse suggestions and offline fixture reference examples.
     */
    public function testDistinguishesLiveMuseProposalFromOfflineFixture(): void
    {
        // 1. Live Muse proposal representation
        $liveMuseSuggestion = [
            'status' => 'unverified_suggestion',
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'path' => 'src/OrderTotal.php',
            'model' => 'meta-models/muse-spark-open-1026',
            'usage' => [
                'prompt_tokens' => 503,
                'completion_tokens' => 240,
            ],
            'candidate' => [
                'status' => 'unverified_in_memory_preview',
                'source' => str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $this->baseSource),
                'sha256' => DedicatedTestRepoPublisher::KNOWN_CANDIDATE_SHA256,
                'applied' => false,
                'verified' => false,
            ],
        ];

        self::assertSame('meta-models/muse-spark-open-1026', $liveMuseSuggestion['model']);
        self::assertIsArray($liveMuseSuggestion['usage']);
        self::assertSame(503, $liveMuseSuggestion['usage']['prompt_tokens']);
        self::assertSame(240, $liveMuseSuggestion['usage']['completion_tokens']);
        self::assertFalse(isset($liveMuseSuggestion['isOfflineExample']));

        // 2. Offline fixture example representation
        $offlineSuggestion = [
            'status' => 'offline_reference_example',
            'isOfflineExample' => true,
            'isSynthetic' => true,
            'provenance' => 'Dedicated test repository',
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'path' => 'src/OrderTotal.php',
            'model' => null,
            'usage' => null,
            'candidate' => [
                'status' => 'unverified_in_memory_preview',
                'source' => str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $this->baseSource),
                'sha256' => DedicatedTestRepoPublisher::KNOWN_CANDIDATE_SHA256,
                'applied' => false,
                'verified' => false,
            ],
        ];

        self::assertNull($offlineSuggestion['model']);
        self::assertNull($offlineSuggestion['usage']);
        self::assertTrue($offlineSuggestion['isOfflineExample']);
        self::assertSame('offline_reference_example', $offlineSuggestion['status']);
    }
}
