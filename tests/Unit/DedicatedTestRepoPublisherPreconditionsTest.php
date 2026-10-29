<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\ServerHeldPublicationApproval;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class DedicatedTestRepoPublisherPreconditionsTest extends TestCase
{
    private string $tempDir;
    private string $approvalsDir;
    private string $evidenceDir;
    private ServerHeldPublicationApproval $approvalStore;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/proofpatch_pub_preconditions_' . bin2hex(random_bytes(6));
        $this->approvalsDir = $this->tempDir . '/approvals';
        $this->evidenceDir = $this->tempDir . '/runs/run-123';

        mkdir($this->tempDir, 0700, true);
        mkdir($this->approvalsDir, 0700, true);
        mkdir($this->evidenceDir, 0700, true);

        $this->approvalStore = new ServerHeldPublicationApproval($this->approvalsDir);
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

    private function trustedCandidate(): string
    {
        $baseFile = dirname(__DIR__, 2) . '/tests/Fixtures/owned-review-case/src/OrderTotal.php';
        $baseSource = (string) file_get_contents($baseFile);
        return (string) str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $baseSource);
    }

    private function createValidEvidenceDirectory(?string $candidateSource = null): array
    {
        $candidateSource = $candidateSource ?? $this->trustedCandidate();
        $projectRoot = dirname(__DIR__, 2);
        $runner = new \ProofPatch\Verifier\ModalIsolatedRunner(
            pythonPath: null,
            grantVerified: true,
            sandboxExecutor: function ($src, $test, $path) {
                if (str_contains($src, 'return 0')) {
                    return [
                        'exitCode' => 1,
                        'output' => "single item: expected 200, got 0\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-test-neg',
                    ];
                }
                if (str_contains($src, 'max(1,')) {
                    return [
                        'exitCode' => 1,
                        'output' => "zero quantity: expected 0, got 100\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-test-base',
                    ];
                }
                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'sandboxId' => 'sb-test-cand',
                ];
            }
        );

        $verifier = new \ProofPatch\Verifier\OwnedCaseVerifier(
            project: $projectRoot,
            runsRoot: $this->tempDir . '/runs',
            approvalStore: $this->approvalStore,
            isolatedRunner: $runner
        );

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
        ];

        $report = $verifier->verify($candidateSource, $context);

        // Issue non-simulated approval token for testing publishing preconditions
        $token = $this->approvalStore->issue(
            runId: $report['id'],
            evidenceDirectory: $report['evidenceDirectory'],
            receiptSha256: $report['receipt']['sha256'],
            baseCommit: \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            repository: \ProofPatch\GitHub\DedicatedTestRepo::name(),
            issueNumber: DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER,
            filePath: DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            baseSha256: $report['baseSha256'],
            candidateSha256: $report['candidateSha256'],
            testSha256: $report['testSha256'],
            isSimulated: false
        );

        return [
            'report' => $report,
            'evidenceDir' => $report['evidenceDirectory'],
            'token' => $token,
            'candidateSha' => $report['candidateSha256'],
        ];
    }

    /**
     * Test: Disconnected publisher must fail BEFORE consuming approval token.
     */
    public function testDisconnectedPublisherThrowsBeforeConsumingApprovalToken(): void
    {
        $candidate = $this->trustedCandidate();
        $evidence = $this->createValidEvidenceDirectory($candidate);
        $token = $evidence['token'];
        self::assertNotNull($token);

        $publisher = new DedicatedTestRepoPublisher(
            approvalStore: $this->approvalStore,
            http: new MockHttpClient(),
            disconnected: true
        );

        self::assertTrue($publisher->isDisconnected());

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER,
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
        ];

        try {
            $publisher->publishDraftPr(
                $context,
                $evidence['evidenceDir'],
                $candidate,
                $token,
                'ghp_' . str_repeat('x', 36)
            );
            self::fail('Expected RuntimeException for disconnected safety mode');
        } catch (\RuntimeException $e) {
            self::assertStringContainsString('disconnected safety mode', $e->getMessage());
        }

        // Verify that the approval token was NOT consumed and can still be read
        $approvalFile = $this->approvalsDir . '/' . $token . '.json';
        self::assertFileExists($approvalFile, 'Single-use approval token must not be consumed on disconnected mode check.');
    }

    /**
     * Test: Remote main branch drifted / stale head throws before creating branch or PR.
     */
    public function testStaleRemoteHeadThrowsWithoutMutating(): void
    {
        $candidate = $this->trustedCandidate();
        $evidence = $this->createValidEvidenceDirectory($candidate);
        $token = $evidence['token'];
        self::assertNotNull($token);

        // Mock GitHub returns a different commit SHA on main (drifted HEAD)
        $driftedSha = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
        $mockHttp = new MockHttpClient([
            new MockResponse(json_encode([
                'ref' => 'refs/heads/main',
                'object' => ['sha' => $driftedSha, 'type' => 'commit'],
            ])),
        ]);

        $publisher = new DedicatedTestRepoPublisher(
            approvalStore: $this->approvalStore,
            http: $mockHttp,
            disconnected: false
        );

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER,
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
        ];

        try {
            $publisher->publishDraftPr(
                $context,
                $evidence['evidenceDir'],
                $candidate,
                $token,
                'ghp_' . str_repeat('x', 36)
            );
            self::fail('Expected RuntimeException for drifted base commit');
        } catch (\RuntimeException $e) {
            self::assertStringContainsString('stale or drifted base commit', $e->getMessage());
        }
    }

    /**
     * Test: Mismatched candidate SHA throws before consuming approval.
     */
    public function testMismatchedCandidateShaThrowsWithoutMutating(): void
    {
        $candidate = $this->trustedCandidate();
        $evidence = $this->createValidEvidenceDirectory($candidate);
        $token = $evidence['token'];
        self::assertNotNull($token);

        $publisher = new DedicatedTestRepoPublisher(
            approvalStore: $this->approvalStore,
            http: new MockHttpClient(),
            disconnected: false
        );

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER,
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
        ];

        // Pass tampered candidate bytes that don't match the evidence directory
        $tamperedCandidate = "<?php\n// Tampered\n";

        try {
            $publisher->publishDraftPr(
                $context,
                $evidence['evidenceDir'],
                $tamperedCandidate,
                $token,
                'ghp_' . str_repeat('x', 36)
            );
            self::fail('Expected InvalidArgumentException for mismatched candidate digest');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('Candidate source hash does not match', $e->getMessage());
        }

        // Token must still be intact
        $approvalFile = $this->approvalsDir . '/' . $token . '.json';
        self::assertFileExists($approvalFile);
    }
}
