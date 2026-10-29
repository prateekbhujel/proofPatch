<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\SingleFileCandidate;
use ProofPatch\Exceptions\AmbiguousPublicationException;
use ProofPatch\Exceptions\StaleTaskConcurrencyException;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\ServerHeldPublicationApproval;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Models\WorkbenchTask;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class TaskConcurrencyRaceConditionIntegrationTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    private string $tempStorageDir;
    private ?string $originalHome;
    private ?string $originalGithubToken;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();

        $this->originalHome = getenv('HOME') !== false ? (string) getenv('HOME') : null;
        $this->originalGithubToken = getenv('GITHUB_TOKEN') !== false ? (string) getenv('GITHUB_TOKEN') : null;

        putenv('GITHUB_TOKEN');

        $this->tempStorageDir = sys_get_temp_dir() . '/proofpatch-race-' . bin2hex(random_bytes(6));
        mkdir($this->tempStorageDir, 0700, true);
        putenv('HOME=' . $this->tempStorageDir);

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
        WorkbenchTask::query()->delete();

        foreach (glob(storage_path('app/publication_recovery/*.json')) ?: [] as $f) {
            @unlink($f);
        }
    }

    protected function tearDown(): void
    {
        foreach (glob(storage_path('app/publication_recovery/*.json')) ?: [] as $f) {
            @unlink($f);
        }

        $this->teardownIsolatedDatabase();

        if ($this->originalHome !== null) {
            putenv('HOME=' . $this->originalHome);
        } else {
            putenv('HOME');
        }

        if ($this->originalGithubToken !== null) {
            putenv('GITHUB_TOKEN=' . $this->originalGithubToken);
        } else {
            putenv('GITHUB_TOKEN');
        }

        if (is_dir($this->tempStorageDir)) {
            $it = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->tempStorageDir, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($it as $item) {
                $item->isDir() && !$item->isLink() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
            }
            @rmdir($this->tempStorageDir);
        }

        $_SESSION = [];
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function createSessionRequest(string $method = 'GET', array $params = [], array $initialSession = []): Request
    {
        $session = app('session')->driver('array');
        app('redirect')->setSession($session);

        foreach ($initialSession as $key => $value) {
            $session->put($key, $value);
        }

        $req = Request::create('/issues', $method, $params);
        $req->setLaravelSession($session);
        return $req;
    }

    public function testCompetingProposalDuringVerificationIsRejectedWithoutClobberingNewCandidateOrAuthorizingPr(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');

        // Candidate A: valid fix
        $candidateSourceA = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateShaA = hash('sha256', $candidateSourceA);

        // Candidate B: competing proposal
        $candidateSourceB = str_replace("max(1, \$item['quantity'])", "\$item['quantity'] /* candidate B */", $source);
        $candidateShaB = hash('sha256', $candidateSourceB);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        // 1. Initial intake
        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-proposal-a',
            'model' => 'muse-spark-open',
            'candidate' => [
                'source' => $candidateSourceA,
                'sha256' => $candidateShaA,
            ],
        ]);
        self::assertSame('in_progress', $task->status);
        self::assertSame($candidateShaA, $task->candidate_sha256);
        $initialVersion = $task->version;

        // 2. Set up runner that injects a competing proposal for Candidate B DURING verification of Candidate A
        $runnerWithCompetingRace = new class($task, $candidateSourceB, $candidateShaB) implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function __construct(
                private readonly WorkbenchTask $targetTask,
                private readonly string $competingSource,
                private readonly string $competingSha
            ) {}

            public function isAvailable(): array {
                return ['available' => true, 'runner' => 'modal', 'isGenuineProvider' => true];
            }

            public function runIsolated(string $src, string $harness, string $path = 'src/OrderTotal.php', int $timeout = 30): array {
                // While verification of Candidate A is running, a competing proposal B arrives in DB:
                $freshTask = WorkbenchTask::findOrFail($this->targetTask->id);
                $freshTask->recordProposal([
                    'requestDigest' => 'digest-competing-proposal-b',
                    'model' => 'competing-model',
                    'candidate' => [
                        'source' => $this->competingSource,
                        'sha256' => $this->competingSha,
                    ],
                ]);

                // Candidate A verification returns VERIFIED
                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 50,
                    'sandboxId' => 'sb-genuine-race-a',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $controller = new IssueWorkbenchController(customRunner: $runnerWithCompetingRace);

        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_12345'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $candidateSourceA,
                    'sha256' => $candidateShaA,
                ],
            ],
        ]);

        $res = $controller->verifyCandidate($verifyReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $res);

        $verifySession = $verifyReq->session();

        // 3. Assert stale verification was rejected:
        $errorMessage = (string) $verifySession->get('error');
        self::assertNotEmpty($errorMessage);
        self::assertStringContainsString('Stale verification rejected', $errorMessage);

        // 4. Assert NO publication token or verified report is granted in session:
        self::assertNull($verifySession->get('issue_publication_token'));
        self::assertNull($verifySession->get('issue_verification_report'));

        // 5. Assert database task state was NOT clobbered by Candidate A's verification:
        $persistedTask = WorkbenchTask::findOrFail($task->id);
        self::assertSame($candidateShaB, $persistedTask->candidate_sha256, 'Task in DB must retain competing Candidate B!');
        self::assertSame('in_progress', $persistedTask->status, 'Task in DB must remain in_progress for Candidate B!');
        self::assertNull($persistedTask->verification_report_id, 'Candidate A verification report must NOT be attached to Candidate B!');
        self::assertNull($persistedTask->verification_decision);
        self::assertGreaterThan($initialVersion, $persistedTask->version);

        // 6. Assert publication authorization token file was revoked/destroyed from disk
        $approvalStore = new ServerHeldPublicationApproval(storage_path('app/publication_approvals'));
        $activeToken = $approvalStore->findActiveTokenForRun('any-run-id', $candidateShaA);
        self::assertNull($activeToken, 'Publication authorization for stale candidate must be revoked from server storage.');
    }

    public function testCompetingProposalDuringSlowModelProposalIsRejected(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $task = WorkbenchTask::recordIntake($context, true);
        self::assertSame('queued', $task->status);
        $v1 = $task->version;

        // Directly update task to simulate competing request while slow proposal is in flight
        $task->recordProposal([
            'requestDigest' => 'competing-digest',
            'candidate' => ['source' => $source, 'sha256' => hash('sha256', $source)],
            'model' => 'first-finishing-model',
        ]);
        self::assertSame('in_progress', $task->fresh()->status);
        self::assertGreaterThan($v1, $task->fresh()->version);

        // Now attempt to record a stale proposal using the old version ($v1)
        $this->expectException(StaleTaskConcurrencyException::class);
        $this->expectExceptionMessage('Stale proposal rejected');

        $task->recordProposal(
            [
                'requestDigest' => 'stale-slow-digest',
                'candidate' => ['source' => $source . ' // slow', 'sha256' => hash('sha256', $source . ' // slow')],
                'model' => 'slow-model',
            ],
            expectedVersion: $v1
        );
    }

    public function testCompetingTaskModificationDuringDraftPrPublicationPreservesPrAndReportsLocalDbFailure(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $genuineRunner = new class implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function isAvailable(): array {
                return ['available' => true, 'runner' => 'modal', 'isGenuineProvider' => true];
            }
            public function runIsolated(string $src, string $harness, string $path = 'src/OrderTotal.php', int $timeout = 30): array {
                if (str_contains($src, 'max(1,')) {
                    return [
                        'exitCode' => 1,
                        'output' => "zero quantity: expected 250, got 750\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-genuine-race-base',
                        'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true,
                        'networkBlocked' => true,
                        'credentialsMounted' => false,
                        'isolated' => true,
                    ];
                }
                if (str_contains($src, 'return 0;')) {
                    return [
                        'exitCode' => 1,
                        'output' => "multiple items: expected 330, got 0\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-genuine-race-neg',
                        'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true,
                        'networkBlocked' => true,
                        'credentialsMounted' => false,
                        'isolated' => true,
                    ];
                }
                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 45,
                    'sandboxId' => 'sb-genuine-race-pr',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $task = null;
        $mockHttp = new MockHttpClient([
            new MockResponse(json_encode(['object' => ['sha' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit()]]), ['http_code' => 200]),
            new MockResponse(json_encode(['tree' => ['sha' => '1111222233334444555566667777888899990000']]), ['http_code' => 200]),
            new MockResponse(json_encode(['sha' => '2222333344445555666677778888999900001111']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '3333444455556666777788889999000011112222']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '4444555566667777888899990000111122223333']), ['http_code' => 201]),
            new MockResponse(json_encode(['ref' => 'refs/heads/proofpatch/issue-1-run-test-branch']), ['http_code' => 201]),
            function () use (&$task) {
                // Concurrently increment version in DB while external GitHub PR creation call is executing:
                \Illuminate\Support\Facades\DB::table('workbench_tasks')
                    ->where('id', $task->id)
                    ->update([
                        'version' => 9999,
                        'status' => 'in_progress',
                        'candidate_source' => 'newer concurrent proposal candidate source',
                    ]);

                return new MockResponse(json_encode([
                    'number' => 77,
                    'html_url' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/77',
                    'draft' => true,
                    'state' => 'open',
                ]), ['http_code' => 201]);
            },
        ]);

        $controller = new IssueWorkbenchController(http: $mockHttp, customRunner: $genuineRunner);

        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-valid-cand',
            'candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha],
        ]);

        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_12345'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => $candidateSha,
                ],
            ],
        ]);
        $controller->verifyCandidate($verifyReq);

        $sessionAll = $verifyReq->session()->all();
        $pubToken = $sessionAll['issue_publication_token'] ?? null;
        self::assertNotEmpty($pubToken);

        $publishReq = $this->createSessionRequest('POST', [], $sessionAll);
        $res = $controller->publishDraftPr($publishReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $res);

        $pubSession = $publishReq->session();

        // 1. Publication token must be immediately forgotten (single use, cannot retry)
        self::assertNull($pubSession->get('issue_publication_token'));

        // 2. Real external PR MUST be preserved and displayed in session
        $publishedPr = $pubSession->get('issue_published_pr');
        self::assertIsArray($publishedPr);
        self::assertSame(77, $publishedPr['prNumber']);
        self::assertSame('https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/77', $publishedPr['prUrl']);

        // 3. User is notified of external success and local persistence failure; never claims PR publication blocked
        $error = (string) $pubSession->get('error');
        self::assertStringNotContainsString('PR Publication blocked', $error);
        self::assertStringContainsString('Draft PR #77 was published successfully to https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/77', $error);
        self::assertStringContainsString('Do not retry publication', $error);

        // 4. Assert all newer DB fields remain intact, not overwritten by stale publication
        $persistedTask = WorkbenchTask::findOrFail($task->id);
        self::assertSame(9999, $persistedTask->version);
        self::assertSame('in_progress', $persistedTask->status);
        self::assertSame('newer concurrent proposal candidate source', $persistedTask->candidate_source);
        self::assertNull($persistedTask->published_pr_url);
        self::assertNull($persistedTask->published_pr_number);

        // 5. Assert durable recovery evidence file was created with the real PR URL
        $runId = (string) ($sessionAll['issue_verification_report']['id'] ?? '');
        $sanitizedRunId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $runId);
        $expectedRecoveryFile = storage_path("app/publication_recovery/task_{$task->id}_{$sanitizedRunId}.json");
        self::assertFileExists($expectedRecoveryFile, 'Durable recovery evidence file must be created on DB finalization failure');
        $recoveryJson = json_decode((string) file_get_contents($expectedRecoveryFile), true);
        self::assertSame('https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/77', $recoveryJson['prResult']['prUrl'] ?? null);
        self::assertSame(77, $recoveryJson['prResult']['prNumber'] ?? null);

        // Clean up recovery files
        @unlink($expectedRecoveryFile);

        // Clean up evidence
        $evidenceDir = $sessionAll['issue_verification_report']['evidenceDirectory'] ?? null;
        if (is_string($evidenceDir) && is_dir($evidenceDir)) {
            foreach (glob($evidenceDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($evidenceDir);
        }
    }

    public function testAtomicPublicationClaimBlocksConcurrentPublicationAttemptsBeforeNetworkRequest(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-claim-test',
            'candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha],
        ]);
        $task->recordVerification([
            'id' => 'run-claim-test-1',
            'decision' => 'VERIFIED',
            'isSimulated' => false,
        ]);

        self::assertSame('needs_review', $task->status);
        $vBeforeClaim = $task->version;

        // 1. Claim publication atomically
        $task->claimPublication($vBeforeClaim, $candidateSha, 'run-claim-test-1');
        self::assertSame('publishing', $task->fresh()->status);
        self::assertSame($vBeforeClaim + 1, $task->fresh()->version);

        // 2. Competing publication claim attempt MUST be rejected
        $competingBlocked = false;
        try {
            $task->claimPublication($vBeforeClaim, $candidateSha, 'run-claim-test-1');
        } catch (StaleTaskConcurrencyException $e) {
            $competingBlocked = true;
            self::assertStringContainsString('Publication claim rejected', $e->getMessage());
        }
        self::assertTrue($competingBlocked, 'Concurrent claim with stale version must be blocked');

        // 3. Even with updated version, claim is rejected because status is already publishing
        $competingBlockedStatus = false;
        try {
            $task->claimPublication($task->fresh()->version, $candidateSha, 'run-claim-test-1');
        } catch (StaleTaskConcurrencyException $e) {
            $competingBlockedStatus = true;
            self::assertStringContainsString('Publication claim rejected', $e->getMessage());
        }
        self::assertTrue($competingBlockedStatus, 'Concurrent claim while already publishing must be blocked');

        // 4. Competing proposal while task is publishing MUST be rejected
        $proposalBlocked = false;
        try {
            $task->recordProposal([
                'requestDigest' => 'competing-digest-while-publishing',
                'candidate' => ['source' => $source, 'sha256' => hash('sha256', $source)],
            ], expectedVersion: $task->fresh()->version);
        } catch (StaleTaskConcurrencyException $e) {
            $proposalBlocked = true;
        }
        self::assertTrue($proposalBlocked, 'Proposals must be blocked while task is publishing');

        // 5. Competing verification while task is publishing MUST be rejected
        $verifyBlocked = false;
        try {
            $task->recordVerification([
                'id' => 'competing-run',
                'decision' => 'VERIFIED',
                'isSimulated' => false,
            ], expectedVersion: $task->fresh()->version);
        } catch (StaleTaskConcurrencyException $e) {
            $verifyBlocked = true;
        }
        self::assertTrue($verifyBlocked, 'Verifications must be blocked while task is publishing');

        // 6. When external network fails, releasing the claim returns task to needs_review
        $claimedVersion = $task->fresh()->version;
        $task->releasePublicationClaim($claimedVersion);
        self::assertSame('needs_review', $task->fresh()->status);
        self::assertGreaterThan($claimedVersion, $task->fresh()->version);

        // 7. Now a subsequent publication can claim again and complete
        $newVersion = $task->fresh()->version;
        $task->claimPublication($newVersion, $candidateSha, 'run-claim-test-1');
        self::assertSame('publishing', $task->fresh()->status);
        $task->recordPublication([
            'prNumber' => 99,
            'prUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/99',
            'branch' => 'proofpatch/issue-1-run-claim-test-1',
            'receiptSha256' => hash('sha256', 'receipt-bytes'),
        ], expectedVersion: $task->fresh()->version, expectedRunId: 'run-claim-test-1', expectedCandidateSha: $candidateSha);

        self::assertSame('completed', $task->fresh()->status);
        self::assertSame(99, $task->fresh()->published_pr_number);
    }

    public function testVerificationCasConflictRevokesApprovalTokenAndPreventsRevivalByFindActiveTokenForRun(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-cand-a',
            'candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha],
        ]);

        $runner = new class($task) implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function __construct(private readonly WorkbenchTask $task) {}

            public function isAvailable(): array {
                return ['available' => true, 'runner' => 'modal', 'isGenuineProvider' => true];
            }

            public function runIsolated(string $src, string $harness, string $path = 'src/OrderTotal.php', int $timeout = 30): array {
                // While verification runs, simulate concurrent modification bumping the version:
                \Illuminate\Support\Facades\DB::table('workbench_tasks')
                    ->where('id', $this->task->id)
                    ->update(['version' => 8888]);

                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 40,
                    'sandboxId' => 'sb-cas-revoke-test',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $controller = new IssueWorkbenchController(customRunner: $runner);

        $initialFiles = glob(storage_path('app/publication_approvals/*.json')) ?: [];

        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_12345'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => $candidateSha,
                ],
            ],
        ]);

        $res = $controller->verifyCandidate($verifyReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $res);

        $session = $verifyReq->session();
        self::assertNull($session->get('issue_publication_token'), 'Session must not expose publication token on CAS conflict');
        self::assertNull($session->get('issue_verification_report'), 'Session must not expose verification report on CAS conflict');
        self::assertStringContainsString('Stale verification rejected', (string) $session->get('error'));

        // Assert approval store on disk: any new token file created during this verification was revoked and deleted
        $finalFiles = glob(storage_path('app/publication_approvals/*.json')) ?: [];
        $newFiles = array_diff($finalFiles, $initialFiles);
        self::assertEmpty($newFiles, 'Any newly issued publication authorization file must be deleted on CAS conflict');

        // Test ServerHeldPublicationApproval::revoke and revokeForRun directly
        $approvalStore = new ServerHeldPublicationApproval(storage_path('app/publication_approvals'));
        $testRunId = 'test-cas-run-' . bin2hex(random_bytes(4));
        $issuedToken = $approvalStore->issue(
            $testRunId,
            sys_get_temp_dir(),
            hash('sha256', 'receipt'),
            'base-commit-hash',
            \ProofPatch\GitHub\DedicatedTestRepo::name(),
            1,
            DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
            $candidateSha,
            hash('sha256', 'test'),
            false
        );
        self::assertSame($issuedToken, $approvalStore->findActiveTokenForRun($testRunId, $candidateSha));
        $approvalStore->revoke($issuedToken);
        self::assertNull($approvalStore->findActiveTokenForRun($testRunId, $candidateSha), 'findActiveTokenForRun must return null after token is revoked');

        // Test revokeForRun
        $testRunId2 = 'test-cas-run-2-' . bin2hex(random_bytes(4));
        $issuedToken2 = $approvalStore->issue(
            $testRunId2,
            sys_get_temp_dir(),
            hash('sha256', 'receipt2'),
            'base-commit-hash',
            \ProofPatch\GitHub\DedicatedTestRepo::name(),
            1,
            DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
            $candidateSha,
            hash('sha256', 'test2'),
            false
        );
        self::assertSame($issuedToken2, $approvalStore->findActiveTokenForRun($testRunId2, $candidateSha));
        $approvalStore->revokeForRun($testRunId2, $candidateSha);
        self::assertNull($approvalStore->findActiveTokenForRun($testRunId2, $candidateSha), 'findActiveTokenForRun must return null after revokeForRun');
    }

    public function testProposalCasConflictPreventsStaleSessionExposure(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $task = WorkbenchTask::recordIntake($context, true);

        // Simulate a winning proposal that already updated the task
        $winningCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity'] /* winning */", $source);
        $task->recordProposal([
            'requestDigest' => 'winning-digest',
            'candidate' => ['source' => $winningCandidate, 'sha256' => hash('sha256', $winningCandidate)],
            'model' => 'fast-model',
        ]);
        self::assertSame('in_progress', $task->fresh()->status);

        $service = new \ProofPatch\Agent\IssueSuggestion(new MockHttpClient(), \ProofPatch\Agent\RequestBudget::forRuntime());
        $previewDigest = $service->preview($context)['digest'];

        // While propose runs, hook into DB or version to simulate slow proposal race
        WorkbenchTask::retrieved(function ($retrievedTask) use ($task) {
            if ($retrievedTask->id === $task->id) {
                \Illuminate\Support\Facades\DB::table('workbench_tasks')
                    ->where('id', $task->id)
                    ->update(['version' => 7777]);
            }
        });

        $controller = new IssueWorkbenchController();
        $proposeReq = $this->createSessionRequest('POST', [
            'approved' => true,
            'digest' => $previewDigest,
        ], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => false,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
            'issue_preview' => [
                'digest' => $previewDigest,
                'context' => $context,
            ],
        ]);

        $res = $controller->propose($proposeReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $res);

        $session = $proposeReq->session();
        self::assertStringContainsString('Stale proposal rejected', (string) $session->get('error'));
        self::assertNull($session->get('issue_suggestion'), 'Session must not expose stale proposal when CAS conflict occurs');

        // Clean up retrieved listeners
        WorkbenchTask::flushEventListeners();

        // Persisted task in DB still holds winning proposal
        $persistedTask = WorkbenchTask::findOrFail($task->id);
        self::assertStringContainsString('winning', (string) $persistedTask->candidate_source);
        self::assertSame(hash('sha256', $winningCandidate), $persistedTask->candidate_sha256);
    }

    public function testRecordIntakeRejectsConcurrentModificationOrActivePublicationClaim(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-cand-intake',
            'candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha],
        ]);
        $task->recordVerification([
            'id' => 'run-intake-test',
            'decision' => 'VERIFIED',
            'isSimulated' => false,
        ]);

        // 1. When task is in 'publishing' state, recordIntake must fail closed
        $task->claimPublication($task->version, $candidateSha, 'run-intake-test');
        self::assertSame('publishing', $task->fresh()->status);

        $blockedPublishing = false;
        try {
            WorkbenchTask::recordIntake($context, true);
        } catch (StaleTaskConcurrencyException $e) {
            $blockedPublishing = true;
            self::assertStringContainsString("active publication claim in progress", $e->getMessage());
        }
        self::assertTrue($blockedPublishing, 'recordIntake must be rejected while task is in publishing status');

        // Verify task and candidate are intact
        $fresh = $task->fresh();
        self::assertSame('publishing', $fresh->status);
        self::assertSame($candidateSha, $fresh->candidate_sha256);

        // 2. Release publication claim
        $task->releasePublicationClaim($fresh->version);
        self::assertSame('needs_review', $task->fresh()->status);

        // 3. Stale version during dirty intake update must fail closed
        $dirtyContext = $context;
        $dirtyContext['title'] = 'Updated Title Concurrently';

        // Simulate concurrent process changing the DB version behind our back
        \Illuminate\Support\Facades\DB::table('workbench_tasks')
            ->where('id', $task->id)
            ->update(['version' => 9999]);

        $blockedStale = false;
        try {
            WorkbenchTask::recordIntake($dirtyContext, true, expectedVersion: $fresh->version);
        } catch (StaleTaskConcurrencyException $e) {
            $blockedStale = true;
            self::assertStringContainsString('Stale intake rejected', $e->getMessage());
        }
        self::assertTrue($blockedStale, 'Dirty recordIntake with version conflict must fail closed');

        // Prior evidence and candidate still intact
        $persisted = WorkbenchTask::findOrFail($task->id);
        self::assertSame($candidateSha, $persisted->candidate_sha256);
        self::assertSame('Test Issue #1', $persisted->title); // not overwritten by dirtyContext
    }

    public function testResolveAndValidateTaskRequiresExactNonNullIdentityAndRejectsNullMatches(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $task = WorkbenchTask::recordIntake($context, true);

        $controller = new IssueWorkbenchController();
        $reflector = new \ReflectionClass($controller);
        $resolveMethod = $reflector->getMethod('resolveAndValidateTask');
        $resolveMethod->setAccessible(true);

        $req = $this->createSessionRequest('GET', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
        ]);

        // 1. Task in DB has candidate_sha256 == null. Passing expectedCandidateSha MUST throw, never matching NULL
        $nullCandidateBlocked = false;
        try {
            $resolveMethod->invoke($controller, $req, $context, $candidateSha, null);
        } catch (\RuntimeException $e) {
            $nullCandidateBlocked = true;
            self::assertStringContainsString('Candidate digest mismatch or candidate not established', $e->getMessage());
        }
        self::assertTrue($nullCandidateBlocked, 'Expected candidate SHA must reject task with null candidate_sha256');

        // 2. Task in DB has verification_report_id == null. Passing expectedRunId MUST throw, never matching NULL
        $nullRunBlocked = false;
        try {
            $resolveMethod->invoke($controller, $req, $context, null, 'run-id-12345');
        } catch (\RuntimeException $e) {
            $nullRunBlocked = true;
            self::assertStringContainsString('Verification run ID mismatch or verification not established', $e->getMessage());
        }
        self::assertTrue($nullRunBlocked, 'Expected run ID must reject task with null verification_report_id');

        // 3. Context has sourceSha256 missing or null. MUST throw
        $badContext = $context;
        $badContext['sourceSha256'] = null;
        $nullSourceShaBlocked = false;
        try {
            $resolveMethod->invoke($controller, $req, $badContext, null, null);
        } catch (\RuntimeException $e) {
            $nullSourceShaBlocked = true;
            self::assertStringContainsString('Source file digest mismatch or missing', $e->getMessage());
        }
        self::assertTrue($nullSourceShaBlocked, 'Null context source SHA must be rejected');
    }

    public function testAmbiguousGitHubErrorAfterWritesBeginFailsClosedWithOutcomeUnknownAndAllowsReadOnlyReconciliation(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        $genuineRunner = new class implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function isAvailable(): array {
                return ['available' => true, 'runner' => 'modal', 'isGenuineProvider' => true];
            }
            public function runIsolated(string $src, string $harness, string $path = 'src/OrderTotal.php', int $timeout = 30): array {
                if (str_contains($src, 'max(1,')) {
                    return [
                        'exitCode' => 1,
                        'output' => "zero quantity: expected 250, got 750\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-ambig-base',
                        'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true,
                        'networkBlocked' => true,
                        'credentialsMounted' => false,
                        'isolated' => true,
                    ];
                }
                if (str_contains($src, 'return 0;')) {
                    return [
                        'exitCode' => 1,
                        'output' => "multiple items: expected 330, got 0\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-ambig-neg',
                        'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true,
                        'networkBlocked' => true,
                        'credentialsMounted' => false,
                        'isolated' => true,
                    ];
                }
                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 45,
                    'sandboxId' => 'sb-ambig-pr',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        // GitHub mock responses: steps 1-5 succeed, step 7 (PR create) fails with 500 error after ref was created:
        $mockHttp = new MockHttpClient([
            new MockResponse(json_encode(['object' => ['sha' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit()]]), ['http_code' => 200]),
            new MockResponse(json_encode(['tree' => ['sha' => '1111222233334444555566667777888899990000']]), ['http_code' => 200]),
            new MockResponse(json_encode(['sha' => '2222333344445555666677778888999900001111']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '3333444455556666777788889999000011112222']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '4444555566667777888899990000111122223333']), ['http_code' => 201]),
            new MockResponse(json_encode(['ref' => 'refs/heads/proofpatch/issue-1-run-ambig-test']), ['http_code' => 201]),
            // Step 7: PR creation returns 500 (ambiguous network error after writes have started!)
            new MockResponse('{"message":"Internal GitHub Server Error"}', ['http_code' => 500]),
            // Read-only reconciliation query (in catch block of publishDraftPr) returns empty list []
            new MockResponse('[]', ['http_code' => 200]),
        ]);

        $controller = new IssueWorkbenchController(http: $mockHttp, customRunner: $genuineRunner);

        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-valid-cand',
            'candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha],
        ]);

        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_12345'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => $candidateSha,
                ],
            ],
        ]);
        $controller->verifyCandidate($verifyReq);

        $sessionAll = $verifyReq->session()->all();
        $publishReq = $this->createSessionRequest('POST', [], $sessionAll);
        $publishRes = $controller->publishDraftPr($publishReq);

        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $publishRes);
        $pubSession = $publishReq->session();

        // 1. Flash error identifies outcome unknown and blocks automatic retry
        $flashError = (string) $pubSession->get('error');
        self::assertStringContainsString('PR publication outcome unknown', $flashError);
        self::assertStringContainsString('Automatic retries are blocked', $flashError);

        // 2. Task in DB is marked outcome_unknown, preserving branch and run id
        $taskFresh = $task->fresh();
        self::assertSame('outcome_unknown', $taskFresh->status);
        self::assertNotNull($taskFresh->published_branch);
        self::assertStringStartsWith('proofpatch/issue-1-', $taskFresh->published_branch);
        self::assertSame('outcome_unknown', $pubSession->get('issue_publication_reconciliation')['status'] ?? null);

        // Failed reconciliation and an empty response are not proof that retry is safe.
        foreach ([
            new MockResponse('{}', ['http_code' => 403]),
            new MockResponse('[]', ['http_code' => 200]),
            new MockResponse('{"unexpected":true}', ['http_code' => 200]),
            new MockResponse(json_encode([[
                'number' => 88,
                'html_url' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88',
                'draft' => true,
                'head' => ['ref' => 'wrong-branch', 'repo' => ['full_name' => \ProofPatch\GitHub\DedicatedTestRepo::name()]],
            ]]), ['http_code' => 200]),
        ] as $response) {
            $check = new IssueWorkbenchController(http: new MockHttpClient([$response]));
            $checkRequest = $this->createSessionRequest('POST', [], $pubSession->all());
            $check->reconcilePr($checkRequest);
            self::assertSame('outcome_unknown', $task->fresh()->status);
        }
        try {
            $taskFresh->claimPublication((int) $taskFresh->version, $candidateSha, $taskFresh->verification_report_id);
            self::fail('An uncertain publication must not be claimed again.');
        } catch (\ProofPatch\Exceptions\StaleTaskConcurrencyException) {
            self::assertSame('outcome_unknown', $task->fresh()->status);
        }
        try {
            $task->fresh()->recordProposal(['candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha]]);
            self::fail('An uncertain publication must not be replaced by a new proposal.');
        } catch (\ProofPatch\Exceptions\StaleTaskConcurrencyException) {
            self::assertSame('outcome_unknown', $task->fresh()->status);
        }

        // 3. Reconcile PR: Scenario A: GitHub actually had the PR created
        $owner = explode('/', \ProofPatch\GitHub\DedicatedTestRepo::name())[0];
        $reconciledMockHttpA = new MockHttpClient([
            new MockResponse(json_encode([
                [
                    'number' => 88,
                    'html_url' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88',
                    'draft' => true,
                    'head' => ['sha' => '4444555566667777888899990000111122223333',
                        'ref' => $taskFresh->published_branch,
                        'repo' => ['full_name' => \ProofPatch\GitHub\DedicatedTestRepo::name()]],
                ]
            ]), ['http_code' => 200]),
        ]);

        $controllerA = new IssueWorkbenchController(http: $reconciledMockHttpA);
        $reconcileReqA = $this->createSessionRequest('POST', [], $pubSession->all());
        $reconcileResA = $controllerA->reconcilePr($reconcileReqA);

        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $reconcileResA);
        $taskReconciledA = $task->fresh();
        self::assertSame('completed', $taskReconciledA->status);
        self::assertSame(88, $taskReconciledA->published_pr_number);
        self::assertSame('https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88', $taskReconciledA->published_pr_url);

        // Clean up evidence
        $evidenceDir = $sessionAll['issue_verification_report']['evidenceDirectory'] ?? null;
        if (is_string($evidenceDir) && is_dir($evidenceDir)) {
            foreach (glob($evidenceDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($evidenceDir);
        }
    }

    public function testMalformedPrCreateResponseDoesNotReturnFabricatedPullZero(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);
        $candidateSha = hash('sha256', $validCandidate);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/issues/1',
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        // Malformed responses: PR number is 0
        $mockHttp = new MockHttpClient([
            new MockResponse(json_encode(['object' => ['sha' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit()]]), ['http_code' => 200]),
            new MockResponse(json_encode(['tree' => ['sha' => '1111222233334444555566667777888899990000']]), ['http_code' => 200]),
            new MockResponse(json_encode(['sha' => '2222333344445555666677778888999900001111']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '3333444455556666777788889999000011112222']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '4444555566667777888899990000111122223333']), ['http_code' => 201]),
            new MockResponse(json_encode(['ref' => 'refs/heads/proofpatch/issue-1-run-malformed-test']), ['http_code' => 201]),
            // Malformed PR response with number 0 and fabricated url
            new MockResponse(json_encode([
                'number' => 0,
                'html_url' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/0',
                'draft' => true,
            ]), ['http_code' => 201]),
        ]);

        $genuineRunner = new class implements \ProofPatch\Verifier\IsolatedRunnerInterface {
            public function isAvailable(): array {
                return ['available' => true, 'runner' => 'modal', 'isGenuineProvider' => true];
            }
            public function runIsolated(string $src, string $harness, string $path = 'src/OrderTotal.php', int $timeout = 30): array {
                if (str_contains($src, 'max(1,')) {
                    return [
                        'exitCode' => 1,
                        'output' => "zero quantity: expected 250, got 750\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-malformed-base',
                        'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true,
                        'networkBlocked' => true,
                        'credentialsMounted' => false,
                        'isolated' => true,
                    ];
                }
                if (str_contains($src, 'return 0;')) {
                    return [
                        'exitCode' => 1,
                        'output' => "multiple items: expected 330, got 0\n",
                        'oracleVerified' => false,
                        'sandboxId' => 'sb-malformed-neg',
                        'runnerType' => 'modal-microvm',
                        'genuineProviderEvidence' => true,
                        'networkBlocked' => true,
                        'credentialsMounted' => false,
                        'isolated' => true,
                    ];
                }
                return [
                    'exitCode' => 0,
                    'output' => "All order total cases passed.\n",
                    'oracleVerified' => true,
                    'truncated' => false,
                    'timedOut' => false,
                    'durationMs' => 45,
                    'sandboxId' => 'sb-malformed-pr',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $task = WorkbenchTask::recordIntake($context, true);
        $task->recordProposal([
            'requestDigest' => 'digest-malformed-cand',
            'candidate' => ['source' => $validCandidate, 'sha256' => $candidateSha],
        ]);

        $controller = new IssueWorkbenchController(customRunner: $genuineRunner);
        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_12345'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => $candidateSha,
                ],
            ],
        ]);
        $controller->verifyCandidate($verifyReq);

        $sessionAll = $verifyReq->session()->all();
        $authToken = $sessionAll['issue_publication_token'];
        $evidenceDir = $sessionAll['issue_verification_report']['evidenceDirectory'];

        $publisher = new DedicatedTestRepoPublisher(
            new ServerHeldPublicationApproval(storage_path('app/publication_approvals')),
            $mockHttp,
            disconnected: false
        );

        $thrown = false;
        try {
            $publisher->publishDraftPr(
                $context,
                $evidenceDir,
                $validCandidate,
                $authToken,
                'gho_valid_dummy_token_12345'
            );
        } catch (AmbiguousPublicationException $e) {
            $thrown = true;
            self::assertStringContainsString('positive number, draft status, and authorized repo URL required', $e->getMessage());
        }

        self::assertTrue($thrown, 'DedicatedTestRepoPublisher must throw AmbiguousPublicationException on pull number 0');

        // Clean up
        if (is_string($evidenceDir) && is_dir($evidenceDir)) {
            foreach (glob($evidenceDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($evidenceDir);
        }
    }
}
