<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\DedicatedTestRepoPublisher;
use ProofPatch\GitHub\ServerHeldPublicationApproval;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Models\WorkbenchTask;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class WorkbenchTaskPersistenceIntegrationTest extends TestCase
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

        $this->tempStorageDir = sys_get_temp_dir() . '/proofpatch-tasks-' . bin2hex(random_bytes(6));
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

    public function testMultipleTasksPersistAndTransitionInSqlite(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $srcFile = $fixturePath . '/src/OrderTotal.php';
        $source = (string) file_get_contents($srcFile);

        // 1. Intake task 1 (owned fixture)
        $context1 = [
            'isSynthetic' => true,
            'provenance' => 'Local checked-in test fixture',
            'repository' => 'synthetic-fixture/order-total',
            'issueNumber' => 101,
            'path' => 'src/OrderTotal.php',
            'title' => 'Synthetic OrderTotal Issue',
            'body' => 'Synthetic body',
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];
        $task1 = WorkbenchTask::recordIntake($context1, false);
        self::assertSame('queued', $task1->status);
        self::assertSame('synthetic-fixture/order-total#101:src/OrderTotal.php', $task1->key);

        // 2. Intake task 2 (dedicated repo)
        $context2 = [
            'isSynthetic' => false,
            'provenance' => 'Dedicated test repository',
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => DedicatedTestRepoPublisher::AUTHORIZED_ISSUE_NUMBER,
            'path' => 'src/OrderTotal.php',
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Dedicated Workflow Issue #1',
            'body' => 'Dedicated body',
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];
        $task2 = WorkbenchTask::recordIntake($context2, true);
        self::assertSame('queued', $task2->status);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::name() . '#1:src/OrderTotal.php@' . substr(\ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(), 0, 12), $task2->key);

        // Verify both tasks exist concurrently in SQLite
        $allTasks = WorkbenchTask::orderByDesc('updated_at')->get();
        self::assertGreaterThanOrEqual(2, $allTasks->count());

        // 3. Propose on task 2
        $suggestion2 = [
            'requestDigest' => hash('sha256', 'proposal-digest-2'),
            'isOfflineExample' => false,
            'candidate' => [
                'source' => $source,
                'sha256' => hash('sha256', $source),
            ],
        ];
        $task2->recordProposal($suggestion2);
        self::assertSame('in_progress', $task2->status);

        // 4. Verify on task 2
        $report2 = [
            'id' => 'run-task-2-verified',
            'decision' => 'VERIFIED',
            'publicationAuthorizationToken' => bin2hex(random_bytes(32)),
            'backendSandboxGap' => ['status' => 'genuine_isolated_execution'],
            'runs' => ['candidate' => ['isolated' => true]],
        ];
        $task2->recordVerification($report2);
        self::assertSame('needs_review', $task2->status);
        self::assertFalse($task2->is_simulated);

        // 5. Verify simulated task on task 1
        $report1 = [
            'id' => 'run-task-1-simulated',
            'decision' => 'VERIFIED',
            'backendSandboxGap' => ['status' => 'allowlisted_bounded_demonstration'],
            'runs' => ['candidate' => ['isolated' => false]],
        ];
        $task1->recordVerification($report1);
        self::assertSame('needs_review', $task1->status);
        self::assertTrue($task1->is_simulated, 'Task 1 must be marked as simulated');

        // 6. Publication on task 2
        $pubResult2 = [
            'prNumber' => 42,
            'prUrl' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/42',
            'branch' => 'proofpatch/issue-1-run-task-2-verified',
            'receiptSha256' => hash('sha256', 'receipt-bytes'),
        ];
        $task2->recordPublication($pubResult2);
        self::assertSame('completed', $task2->status);
        self::assertSame(42, $task2->published_pr_number);

        // Board representation check
        $boardArray2 = $task2->toBoardArray();
        self::assertSame('completed', $boardArray2['status']);
        self::assertSame(42, $boardArray2['publishedPrNumber']);
        self::assertTrue($boardArray2['isDedicated']);
    }

    public function testSwitchTaskRestoresSessionStateAcrossTickets(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');

        $contextDedicated = [
            'isSynthetic' => false,
            'provenance' => 'Dedicated test repository',
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'path' => 'src/OrderTotal.php',
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Dedicated Workflow Issue #1',
            'body' => 'Dedicated body',
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];
        $dedicatedTask = WorkbenchTask::recordIntake($contextDedicated, true);
        $dedicatedTask->recordProposal([
            'requestDigest' => 'dedicated-digest',
            'isOfflineExample' => false,
            'candidate' => ['source' => $source, 'sha256' => hash('sha256', $source)],
        ]);

        $controller = new IssueWorkbenchController();
        $unauthorized = $this->createSessionRequest('POST', ['task_id' => $dedicatedTask->id]);
        $controller->switchTask($unauthorized);
        self::assertNull($unauthorized->session()->get('issue_context'));
        $boardRequest = $this->createSessionRequest('GET');
        $board = $controller->show($boardRequest)->toResponse($boardRequest)->getOriginalContent()->getData()['page']['props'];
        self::assertNotContains($dedicatedTask->id, array_column($board['tasks'], 'id'));
        $switchReq = $this->createSessionRequest('POST', ['task_id' => $dedicatedTask->id], [
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
        ]);
        $response = $controller->switchTask($switchReq);

        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $response);
        self::assertStringEndsWith('/issues', $response->getTargetUrl());

        $session = $switchReq->session();
        $restoredContext = $session->get('issue_context');
        self::assertIsArray($restoredContext);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::name(), $restoredContext['repository']);
        self::assertSame(1, $restoredContext['issueNumber']);
        self::assertTrue($session->get('issue_is_dedicated_test_repo'));
        self::assertTrue($session->get('issue_is_owned_fixture'));
        self::assertIsArray($session->get('issue_suggestion'));
    }

    public function testPublishDraftPrRejectsSimulatedApproval(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];

        // Verification executed without microVM runner produces simulated run; publishDraftPr MUST fail closed.
        $controllerSimulated = new IssueWorkbenchController();
        $simulatedTask = WorkbenchTask::recordIntake($context, true);
        $simulatedSessionReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $simulatedTask->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => hash('sha256', $validCandidate),
                ],
            ],
        ]);
        $simulatedTask->recordProposal($simulatedSessionReq->session()->get('issue_suggestion'));

        $controllerSimulated->verifyCandidate($simulatedSessionReq);
        $simulatedReport = $simulatedSessionReq->session()->get('issue_verification_report');
        self::assertIsArray($simulatedReport);
        self::assertSame('VERIFIED', $simulatedReport['decision']);

        $publishSimulatedReq = $this->createSessionRequest('POST', [], $simulatedSessionReq->session()->all());
        $simulatedRes = $controllerSimulated->publishDraftPr($publishSimulatedReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $simulatedRes);
        $errorMsg = $publishSimulatedReq->session()->get('error');
        self::assertNotNull($errorMsg);
        self::assertStringContainsString('Verification was executed using a mock/simulated runner', (string) $errorMsg);
    }

    public function testPublishDraftPrConnectsWithGenuineApprovalAndPublishesDraftPr(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
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
                        'sandboxId' => 'sb-genuine-base',
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
                        'sandboxId' => 'sb-genuine-neg',
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
                    'sandboxId' => 'sb-genuine-cand',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $mockHttpConnected = new MockHttpClient([
            // 1. Get base branch commit SHA
            new MockResponse(json_encode(['object' => ['sha' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit()]]), ['http_code' => 200]),
            // 2. Get tree SHA of base commit
            new MockResponse(json_encode(['tree' => ['sha' => '1111222233334444555566667777888899990000']]), ['http_code' => 200]),
            // 3. Create blob for candidate file
            new MockResponse(json_encode(['sha' => '2222333344445555666677778888999900001111']), ['http_code' => 201]),
            // 4. Create new tree referencing the blob
            new MockResponse(json_encode(['sha' => '3333444455556666777788889999000011112222']), ['http_code' => 201]),
            // 5. Create commit
            new MockResponse(json_encode(['sha' => '4444555566667777888899990000111122223333']), ['http_code' => 201]),
            // 6. Create ref (branch)
            new MockResponse(json_encode(['ref' => 'refs/heads/proofpatch/issue-1-run-test-branch']), ['http_code' => 201]),
            // 7. Create Draft Pull Request via POST
            new MockResponse(json_encode([
                'number' => 88,
                'html_url' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88',
                'draft' => true,
                'state' => 'open',
            ]), ['http_code' => 201]),
        ]);

        $controllerGenuine = new IssueWorkbenchController(
            http: $mockHttpConnected,
            customRunner: $genuineRunner
        );

        $intakeTask = WorkbenchTask::recordIntake($context, true);
        self::assertSame('queued', $intakeTask->status);

        $genuineSessionReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $intakeTask->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => hash('sha256', $validCandidate),
                ],
            ],
        ]);
        $intakeTask->recordProposal($genuineSessionReq->session()->get('issue_suggestion'));

        $controllerGenuine->verifyCandidate($genuineSessionReq);
        $genuineReport = $genuineSessionReq->session()->get('issue_verification_report');
        self::assertIsArray($genuineReport);
        self::assertSame('VERIFIED', $genuineReport['decision']);
        self::assertNotEmpty($genuineSessionReq->session()->get('issue_publication_token'));

        // Publish via explicit user action
        $publishGenuineReq = $this->createSessionRequest('POST', [], $genuineSessionReq->session()->all());
        $genuineRes = $controllerGenuine->publishDraftPr($publishGenuineReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $genuineRes);
        self::assertNull($publishGenuineReq->session()->get('error'));

        $publishedPr = $publishGenuineReq->session()->get('issue_published_pr');
        self::assertIsArray($publishedPr);
        self::assertSame(88, $publishedPr['prNumber']);
        self::assertSame('https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88', $publishedPr['prUrl']);

        // Verify task updated to completed in SQLite
        $intakeTask->refresh();
        self::assertSame('completed', $intakeTask->status);
        self::assertSame(88, $intakeTask->published_pr_number);
    }

    public function testSwitchTaskRestoresModelProvenanceReportAndPublicationToken(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
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
                        'sandboxId' => 'sb-switch-base',
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
                        'sandboxId' => 'sb-switch-neg',
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
                    'sandboxId' => 'sb-switch-cand',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $controller = new IssueWorkbenchController(customRunner: $genuineRunner);

        // 1. Intake task
        $task = WorkbenchTask::recordIntake($context, true);

        // 2. Proposal with model provenance
        $initialSessionReq = $this->createSessionRequest('POST', [], [
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'issue_suggestion' => [
                'status' => 'ready',
                'model' => 'muse-spark-open',
                'explanation' => 'Fix OrderTotal calculation.',
                'find' => "max(1, \$item['quantity'])",
                'replace' => "\$item['quantity']",
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => hash('sha256', $validCandidate),
                ],
            ],
        ]);
        $task->recordProposal($initialSessionReq->session()->get('issue_suggestion'));

        // 3. Genuine verification
        $controller->verifyCandidate($initialSessionReq);
        $verifiedReport = $initialSessionReq->session()->get('issue_verification_report');
        $pubToken = $initialSessionReq->session()->get('issue_publication_token');
        self::assertIsArray($verifiedReport);
        self::assertSame('VERIFIED', $verifiedReport['decision']);
        self::assertNotEmpty($pubToken);

        $task->refresh();
        self::assertSame('needs_review', $task->status);
        self::assertFalse($task->is_simulated);

        // 4. Simulate user navigating away or switching to another task (clearing session)
        $switchReq = $this->createSessionRequest('POST', ['task_id' => $task->id], [
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
        ]);
        $switchRes = $controller->switchTask($switchReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $switchRes);

        // 5. Assert that switchTask faithfully restored model provenance, verified report, and active publication token
        $session = $switchReq->session();
        $restoredContext = $session->get('issue_context');
        self::assertIsArray($restoredContext);
        self::assertSame(\ProofPatch\GitHub\DedicatedTestRepo::name(), $restoredContext['repository']);

        $restoredSuggestion = $session->get('issue_suggestion');
        self::assertIsArray($restoredSuggestion);
        self::assertSame('muse-spark-open', $restoredSuggestion['model']);
        self::assertSame('Fix OrderTotal calculation.', $restoredSuggestion['explanation']);

        $restoredReport = $session->get('issue_verification_report');
        self::assertIsArray($restoredReport);
        self::assertSame($verifiedReport['id'], $restoredReport['id']);
        self::assertSame('VERIFIED', $restoredReport['decision']);
        self::assertArrayHasKey('receipt', $restoredReport);
        self::assertSame('VALID', $restoredReport['receipt']['integrity']);
        self::assertNotEmpty($restoredReport['receipt']['sha256']);

        // Assert rendered response through show() controller method renders without crash
        $issuesReq = $this->createSessionRequest('GET', [], $session->all());
        $issuesRes = $controller->show($issuesReq);
        $props = $issuesRes->toResponse($issuesReq)->getOriginalContent()->getData()['page']['props'];
        self::assertIsArray($props['verificationReport']);
        self::assertSame('VALID', $props['verificationReport']['receipt']['integrity']);
        self::assertSame($restoredReport['receipt']['sha256'], $props['verificationReport']['receipt']['sha256']);

        $restoredToken = $session->get('issue_publication_token');
        self::assertSame($pubToken, $restoredToken);

        // Clean up artifacts from verification run
        $evidenceDir = $verifiedReport['evidenceDirectory'] ?? null;
        if (is_string($evidenceDir) && is_dir($evidenceDir)) {
            foreach (glob($evidenceDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($evidenceDir);
        }
    }

    public function testRecordIntakeClearsDownstreamArtifactsToPreventEvidenceBleed(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');

        $context = [
            'isSynthetic' => false,
            'provenance' => 'Dedicated test repository',
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'path' => 'src/OrderTotal.php',
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Dedicated Workflow Issue #1',
            'body' => 'Dedicated body',
            'source' => $source,
            'sourceSha256' => hash('sha256', $source),
        ];

        // 1. Initial intake
        $task = WorkbenchTask::recordIntake($context, true);
        self::assertSame('queued', $task->status);

        // 2. Proposal
        $task->recordProposal([
            'requestDigest' => 'digest-v1',
            'candidate' => ['source' => $source, 'sha256' => hash('sha256', $source)],
            'model' => 'muse-spark-open',
        ]);
        self::assertSame('in_progress', $task->status);

        // 3. Verification
        $task->recordVerification([
            'id' => 'run-v1',
            'decision' => 'VERIFIED',
            'isSimulated' => false,
            'publicationAuthorizationToken' => 'token-v1',
            'backendSandboxGap' => ['status' => 'genuine_isolated_execution'],
        ]);
        self::assertSame('needs_review', $task->status);

        // 4. Publication
        $task->recordPublication([
            'prNumber' => 99,
            'prUrl' => 'https://github.com/test/repo/pull/99',
            'branch' => 'proofpatch/issue-1-run-v1',
            'receiptSha256' => hash('sha256', 'receipt-1'),
        ]);
        self::assertSame('completed', $task->status);

        // 5. Re-intake identical case preserves prior candidate, verification, and completed state
        $identicalTask = WorkbenchTask::recordIntake($context, true);
        self::assertSame($task->id, $identicalTask->id);
        self::assertSame('completed', $identicalTask->status);
        self::assertSame(99, $identicalTask->published_pr_number);
        self::assertSame('https://github.com/test/repo/pull/99', $identicalTask->published_pr_url);

        // 6. Reject changed source for the same revision and preserve existing evidence.
        $modifiedSource = $source . "\n// modified\n";
        $context['source'] = $modifiedSource;
        $context['sourceSha256'] = hash('sha256', $modifiedSource);
        try {
            WorkbenchTask::recordIntake($context, true);
            self::fail('Changed source for the same revision must be rejected.');
        } catch (\InvalidArgumentException $error) {
            self::assertStringContainsString('existing evidence was preserved', $error->getMessage());
        }
        $updatedTask = WorkbenchTask::findOrFail($task->id);
        self::assertSame('completed', $updatedTask->status);
        self::assertSame(99, $updatedTask->published_pr_number);
        self::assertSame('https://github.com/test/repo/pull/99', $updatedTask->published_pr_url);

        // 7. Intake with different path on the same issue binds separate task without deleting existing task
        $diffPathContext = $context;
        $diffPathContext['path'] = 'src/Invoice.php';
        $diffPathTask = WorkbenchTask::recordIntake($diffPathContext, true);
        self::assertNotSame($task->id, $diffPathTask->id);
        self::assertSame('queued', $diffPathTask->status);
        self::assertNotNull(WorkbenchTask::find($task->id));
        self::assertNotNull(WorkbenchTask::find($diffPathTask->id));

        // 8. Intake with different revision (commit) on the same issue binds separate task without deleting existing task
        $diffRevContext = $context;
        $diffRevContext['commit'] = '2222222222222222222222222222222222222222';
        $diffRevTask = WorkbenchTask::recordIntake($diffRevContext, true);
        self::assertNotSame($task->id, $diffRevTask->id);
        self::assertNotSame($diffPathTask->id, $diffRevTask->id);
        self::assertSame('queued', $diffRevTask->status);
        self::assertNotNull(WorkbenchTask::find($task->id));
        self::assertNotNull(WorkbenchTask::find($diffRevTask->id));
    }

    public function testMissingRevisionAndLegacyDifferentPathDoNotOverwriteExistingTasks(): void
    {
        $context = [
            'repository' => 'example/project', 'issueNumber' => 12,
            'path' => 'src/one.php', 'commit' => str_repeat('a', 40),
            'sourceSha256' => hash('sha256', 'first'),
        ];
        $revisionTask = WorkbenchTask::recordIntake($context);
        $revisionTask->recordPublication(['prNumber' => 17, 'prUrl' => 'https://example.test/pr/17']);

        $withoutRevision = $context;
        $withoutRevision['commit'] = null;
        $unversionedTask = WorkbenchTask::recordIntake($withoutRevision);
        self::assertNotSame($revisionTask->id, $unversionedTask->id);
        self::assertSame(17, $revisionTask->fresh()->published_pr_number);

        $revisionTask->key = 'example/project#12';
        $revisionTask->save();
        $differentPath = $context;
        $differentPath['path'] = 'src/two.php';
        $differentTask = WorkbenchTask::recordIntake($differentPath);
        self::assertNotSame($revisionTask->id, $differentTask->id);
        self::assertSame('src/one.php', $revisionTask->fresh()->path);
        self::assertSame(17, $revisionTask->fresh()->published_pr_number);
    }

    public function testRecordProposalInvalidatesStaleVerificationAndPublication(): void
    {
        $context = [
            'repository' => 'test/repo',
            'issueNumber' => 456,
            'path' => 'src/OrderTotal.php',
            'title' => 'Test',
        ];
        $task = WorkbenchTask::recordIntake($context, false);
        $task->recordProposal(['candidate' => ['source' => 'code1', 'sha256' => hash('sha256', 'code1')]]);
        $task->recordVerification(['id' => 'run-1', 'decision' => 'VERIFIED', 'isSimulated' => true]);
        $task->recordPublication(['prNumber' => 12]);
        self::assertSame('completed', $task->status);

        // Record a new proposal
        $task->recordProposal([
            'requestDigest' => 'new-digest',
            'candidate' => ['source' => 'code2', 'sha256' => hash('sha256', 'code2')],
            'model' => 'muse-spark-open',
        ]);

        self::assertSame('in_progress', $task->status);
        self::assertNull($task->verification_report_id);
        self::assertNull($task->verification_decision);
        self::assertFalse($task->is_simulated);
        self::assertNull($task->published_pr_number);
        self::assertSame('muse-spark-open', $task->metadata['model']);
    }

    public function testDbFailureInControllerSurfacesExplicitError(): void
    {
        \Illuminate\Support\Facades\Schema::dropIfExists('workbench_tasks');

        $controller = new IssueWorkbenchController();
        $req = $this->createSessionRequest('POST');
        $res = $controller->loadOwnedCase($req);

        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $res);
        $error = $req->session()->get('error');
        self::assertNotNull($error, 'Database failure MUST NOT be silently swallowed!');
        self::assertStringContainsString('Failed to load owned review case:', (string) $error);
    }

    public function testOneUseApprovalNeverPersistedInDatabase(): void
    {
        $columns = \Illuminate\Support\Facades\Schema::getColumnListing('workbench_tasks');
        $disallowed = [
            'token',
            'approval_token',
            'publication_token',
            'publicationAuthorizationToken',
            'github_token',
            'bearer',
            'secret',
        ];

        foreach ($disallowed as $column) {
            self::assertNotContains($column, $columns, "Database schema must never persist secret/token column: '{$column}'");
        }
    }

    public function testStaleSessionWritesFailClosedOnContextMismatch(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
            'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
            'commit' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit(),
            'title' => 'Test Issue #1',
            'body' => 'Body',
            'source' => $source,
            'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
        ];
        $task = WorkbenchTask::recordIntake($context, true);

        $controller = new IssueWorkbenchController();

        // 1. Propose with mismatched path must fail closed
        $mismatchedPathContext = $context;
        $mismatchedPathContext['path'] = 'src/DifferentFile.php';
        $propReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $mismatchedPathContext,
            'issue_draft' => 'Draft',
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
        ]);
        $propRes = $controller->propose($propReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $propRes);
        $error = $propReq->session()->get('error');
        self::assertNotNull($error);
        self::assertStringContainsString('Stale session write rejected', (string) $error);

        // 2. Propose with mismatched base revision must fail closed
        $mismatchedCommitContext = $context;
        $mismatchedCommitContext['commit'] = '9999999999999999999999999999999999999999';
        $propReq2 = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $mismatchedCommitContext,
            'issue_draft' => 'Draft',
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
        ]);
        $propRes2 = $controller->propose($propReq2);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $propRes2);
        $error2 = $propReq2->session()->get('error');
        self::assertNotNull($error2);
        self::assertStringContainsString('Stale session write rejected: Base revision mismatch', (string) $error2);

        // 3. Verify with mismatched sourceSha256 must fail closed
        $mismatchedSourceContext = $context;
        $mismatchedSourceContext['sourceSha256'] = hash('sha256', 'mismatched-content');
        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $mismatchedSourceContext,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => 'src/OrderTotal.php',
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => hash('sha256', $validCandidate),
                ],
            ],
        ]);
        $verifyRes = $controller->verifyCandidate($verifyReq);
        self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $verifyRes);
        $verifyError = $verifyReq->session()->get('error');
        self::assertNotNull($verifyError);
        self::assertStringContainsString('Stale session write rejected: Source file digest mismatch', (string) $verifyError);

        // 4. Publish with mismatched candidateSha or runId must fail closed
        $task->recordProposal([
            'candidate' => ['source' => $validCandidate, 'sha256' => hash('sha256', $validCandidate)],
        ]);
        $task->recordVerification([
            'id' => 'run-legitimate-id',
            'decision' => 'VERIFIED',
        ]);
        $publishReqMismatchedCandidate = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_publication_token' => 'dummy-token',
            'github_auth' => ['token' => 'gho_token'],
            'issue_verification_report' => [
                'id' => 'run-legitimate-id',
                'evidenceDirectory' => $this->tempStorageDir,
            ],
            'issue_suggestion' => [
                'candidate' => [
                    'source' => 'mismatched candidate source',
                ],
            ],
        ]);
        $controller->publishDraftPr($publishReqMismatchedCandidate);
        $pubError = $publishReqMismatchedCandidate->session()->get('error');
        self::assertNotNull($pubError);
        self::assertStringContainsString('Stale session write rejected: Candidate digest mismatch', (string) $pubError);
    }

    public function testPostPublicationDbFailurePreservesRealPrUrlAndNeverClaimsPublicationBlocked(): void
    {
        $fixturePath = base_path('tests/Fixtures/owned-review-case');
        $source = (string) file_get_contents($fixturePath . '/src/OrderTotal.php');
        $validCandidate = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $source);

        $context = [
            'repository' => \ProofPatch\GitHub\DedicatedTestRepo::name(),
            'issueNumber' => 1,
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
                        'sandboxId' => 'sb-genuine-base',
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
                        'sandboxId' => 'sb-genuine-neg',
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
                    'sandboxId' => 'sb-genuine-cand',
                    'runnerType' => 'modal-microvm',
                    'genuineProviderEvidence' => true,
                    'networkBlocked' => true,
                    'credentialsMounted' => false,
                    'isolated' => true,
                ];
            }
        };

        $mockHttp = new MockHttpClient([
            new MockResponse(json_encode(['object' => ['sha' => \ProofPatch\GitHub\DedicatedTestRepo::requireBaseCommit()]]), ['http_code' => 200]),
            new MockResponse(json_encode(['tree' => ['sha' => '1111222233334444555566667777888899990000']]), ['http_code' => 200]),
            new MockResponse(json_encode(['sha' => '2222333344445555666677778888999900001111']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '3333444455556666777788889999000011112222']), ['http_code' => 201]),
            new MockResponse(json_encode(['sha' => '4444555566667777888899990000111122223333']), ['http_code' => 201]),
            new MockResponse(json_encode(['ref' => 'refs/heads/proofpatch/issue-1-run-test-branch']), ['http_code' => 201]),
            function () use (&$task) {
                // Simulate another request modifying the task while GitHub PR creation is in flight
                \Illuminate\Support\Facades\DB::table('workbench_tasks')
                    ->where('id', $task->id)
                    ->update(['version' => 9999]);

                return new MockResponse(json_encode([
                    'number' => 88,
                    'html_url' => 'https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88',
                    'draft' => true,
                    'state' => 'open',
                ]), ['http_code' => 201]);
            },
        ]);

        $controller = new IssueWorkbenchController(http: $mockHttp, customRunner: $genuineRunner);
        $task = WorkbenchTask::recordIntake($context, true);

        $verifyReq = $this->createSessionRequest('POST', [], [
            'issue_task_id' => $task->id,
            'issue_context' => $context,
            'issue_is_dedicated_test_repo' => true,
            'issue_is_owned_fixture' => true,
            'github_auth' => ['token' => 'gho_dummy_token_for_tests_1234567890'],
            'issue_suggestion' => [
                'status' => 'ready',
                'path' => DedicatedTestRepoPublisher::AUTHORIZED_FILE_PATH,
                'sourceSha256' => DedicatedTestRepoPublisher::KNOWN_BASE_SHA256,
                'candidate' => [
                    'source' => $validCandidate,
                    'sha256' => hash('sha256', $validCandidate),
                ],
            ],
        ]);
        $task->recordProposal($verifyReq->session()->get('issue_suggestion'));
        $controller->verifyCandidate($verifyReq);

        $sessionAll = $verifyReq->session()->all();
        $pubToken = $sessionAll['issue_publication_token'] ?? null;
        self::assertNotEmpty($pubToken);

        try {
            $publishReq = $this->createSessionRequest('POST', [], $sessionAll);
            $res = $controller->publishDraftPr($publishReq);

            self::assertInstanceOf(\Illuminate\Http\RedirectResponse::class, $res);
            $pubSession = $publishReq->session();

            // 1. Publication token must be forgotten immediately to prevent retries
            self::assertNull($pubSession->get('issue_publication_token'));

            // 2. Real published PR MUST be preserved and displayed in session
            $publishedPr = $pubSession->get('issue_published_pr');
            self::assertIsArray($publishedPr);
            self::assertSame(88, $publishedPr['prNumber']);
            self::assertSame('https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88', $publishedPr['prUrl']);

            // 3. Must NEVER claim publication was blocked when external action succeeded
            $error = (string) $pubSession->get('error');
            self::assertStringNotContainsString('PR Publication blocked', $error);
            self::assertStringContainsString('published successfully to https://github.com/' . \ProofPatch\GitHub\DedicatedTestRepo::name() . '/pull/88', $error);
            self::assertStringContainsString('Do not retry publication', $error);
        } finally {
            WorkbenchTask::flushEventListeners();
        }

        // Clean up evidence
        $evidenceDir = $sessionAll['issue_verification_report']['evidenceDirectory'] ?? null;
        if (is_string($evidenceDir) && is_dir($evidenceDir)) {
            foreach (glob($evidenceDir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($evidenceDir);
        }
    }
}
