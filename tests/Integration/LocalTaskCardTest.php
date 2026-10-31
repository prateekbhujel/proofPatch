<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\GitHubAppClient;
use ProofPatch\GitHub\DedicatedTestRepoFetcher;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Http\Controllers\LocalTaskCardController;
use ProofPatch\Http\Middleware\AuthorizeGithubTasks;
use ProofPatch\Models\LocalTaskCard;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class LocalTaskCardTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();
    }

    protected function tearDown(): void
    {
        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function request(string $method, string $path, array $data = [], ?int $user = 1): Request
    {
        $session = app('session')->driver('array');
        if ($user !== null) {
            $session->put('github_auth', ['token' => 'fake-token', 'user' => ['id' => $user]]);
        }
        app('redirect')->setSession($session);
        $request = Request::create($path, $method, $data);
        $request->setLaravelSession($session);
        return $request;
    }

    private function middleware(int $user, bool $grant): AuthorizeGithubTasks
    {
        $responses = [
            new MockResponse(json_encode(['id' => $user, 'login' => 'user'.$user])),
            new MockResponse(json_encode(['installations' => $grant ? [['id' => 101]] : []])),
        ];
        if ($grant) {
            $responses[] = new MockResponse(json_encode(['repositories' => [[
                'id' => 5, 'name' => 'private-repo', 'full_name' => 'owner/private-repo',
                'owner' => ['login' => 'owner'], 'private' => true,
            ]]]));
        }
        return new AuthorizeGithubTasks(new GitHubAppClient(new MockHttpClient($responses)));
    }

    public function testOnlyVerifiedOwnerWithCurrentGrantCanCreateAndSeeCards(): void
    {
        $request = $this->request('POST', '/issues/tasks', [
            'title' => 'Fix invoice', 'description' => "Expected total\nActual total", 'repository' => 'Owner/Private-Repo',
        ]);
        $response = $this->middleware(1, true)->handle($request, fn (Request $req) => (new LocalTaskCardController())->store($req));
        self::assertTrue($response->isRedirection());
        $card = LocalTaskCard::firstOrFail();
        self::assertSame(1, (int) $card->github_user_id);
        self::assertSame('owner/private-repo', $card->repository);
        self::assertSame('queued', $card->status);

        foreach ([[1, true, true], [1, false, false], [2, true, false]] as [$user, $grant, $visible]) {
            $show = $this->request('GET', '/issues', user: $user);
            $this->middleware($user, $grant)->handle($show, static fn () => new Response());
            $props = (new IssueWorkbenchController())->show($show)->toResponse($show)->getOriginalContent()->getData()['page']['props'];
            self::assertSame($visible ? [$card->id] : [], array_column($props['localTasks'], 'id'));
            if ($visible) {
                self::assertSame('Fix invoice', $props['localTasks'][0]['title']);
                self::assertSame("Expected total\nActual total", $props['localTasks'][0]['description']);
                self::assertArrayNotHasKey('github_user_id', $props['localTasks'][0]);
            } else {
                self::assertStringNotContainsString('Expected total', json_encode($props['localTasks'], JSON_THROW_ON_ERROR));
            }
        }
    }

    public function testAnonymousUnverifiedOrUngrantedRequestsCannotCreateCards(): void
    {
        $input = ['title' => 'Private task', 'description' => 'Private details', 'repository' => 'owner/private-repo'];
        $anonymous = $this->request('POST', '/issues/tasks', $input, null);
        $this->middleware(1, false)->handle($anonymous, fn (Request $req) => (new LocalTaskCardController())->store($req));
        self::assertSame('Connect GitHub to create a task.', $anonymous->session()->get('error'));

        $revoked = $this->request('POST', '/issues/tasks', $input);
        $this->middleware(1, false)->handle($revoked, fn (Request $req) => (new LocalTaskCardController())->store($req));
        self::assertSame('Grant the GitHub app access to this repository.', $revoked->session()->get('error'));

        $unverified = $this->request('POST', '/issues/tasks', $input);
        (new LocalTaskCardController())->store($unverified);
        self::assertSame('Connect GitHub to create a task.', $unverified->session()->get('error'));
        self::assertSame(0, LocalTaskCard::count());
    }

    public function testRealAnonymousIssuesRouteDoesNotExposePrivateCards(): void
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'owner/private-repo';
        $card->title = 'Internal task';
        $card->description = 'Private card content';
        $card->status = 'queued';
        $card->save();

        $request = Request::create('/issues', 'GET', [], [], [], [
            'HTTP_X_INERTIA' => 'true', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_INERTIA_VERSION' => hash_file('xxh128', public_path('build/manifest.json')),
        ]);
        $kernel = app(\Illuminate\Contracts\Http\Kernel::class);
        $response = $kernel->handle($request);
        try {
            self::assertSame(200, $response->getStatusCode());
            $page = json_decode((string) $response->getContent(), true, 64, JSON_THROW_ON_ERROR);
            self::assertSame([], $page['props']['localTasks']);
            self::assertStringNotContainsString('Private card content', (string) $response->getContent());
        } finally {
            $kernel->terminate($request, $response);
        }
    }

    public function testInvalidAndOverlongInputDoesNotCreateCards(): void
    {
        foreach ([
            ['title' => '', 'description' => 'details', 'repository' => 'owner/private-repo'],
            ['title' => str_repeat('x', 181), 'description' => 'details', 'repository' => 'owner/private-repo'],
            ['title' => 'Valid', 'description' => str_repeat('x', 10001), 'repository' => 'owner/private-repo'],
            ['title' => 'Valid', 'description' => 'details', 'repository' => 'owner/../private-repo'],
        ] as $input) {
            $request = $this->request('POST', '/issues/tasks', $input);
            $this->middleware(1, true)->handle($request, fn (Request $req) => (new LocalTaskCardController())->store($req));
            self::assertSame('Check the task title, description and repository.', $request->session()->get('error'));
        }
        self::assertSame(0, LocalTaskCard::count());
    }

    public function testAssignTaskToMuseFailsClosedOnArbitraryPrivateRepo(): void
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'owner/private-repo';
        $card->title = 'Fix proprietary payment logic';
        $card->description = 'Secret customer payment credentials and logic details';
        $card->status = 'queued';
        $card->save();

        $request = $this->request('POST', "/issues/tasks/{$card->id}/assign");
        $request->session()->put('github_auth', [
            'token' => 'fake-token',
            'user' => ['id' => 1],
            'repositories' => [['fullName' => 'owner/private-repo', 'isPrivate' => true]],
        ]);

        $response = $this->middleware(1, true)->handle($request, fn (Request $req) => (new LocalTaskCardController())->assign($req, (int) $card->id));
        self::assertTrue($response->isRedirection());
        self::assertStringContainsString('Task assignment is not available yet', (string) $request->session()->get('error'));

        // Verify card remains queued and unassigned
        $card->refresh();
        self::assertSame('queued', $card->status);
        self::assertNull($card->workbench_task_id);
    }

    public function testAssignUnrelatedTaskFailsClosedAndNeverSubstitutesSampleFixture(): void
    {
        $previousRepo = getenv('PROOFPATCH_TEST_REPO');
        $previousBaseCommit = getenv('PROOFPATCH_TEST_BASE_COMMIT');
        $dedicatedRepo = 'owner/dedicated-test';
        putenv('PROOFPATCH_TEST_REPO=' . $dedicatedRepo);
        putenv('PROOFPATCH_TEST_BASE_COMMIT=' . str_repeat('c', 40));

        try {
            // Case 1: Unrelated task on dedicated test repo
            $unrelatedCard = new LocalTaskCard();
            $unrelatedCard->github_user_id = 1;
            $unrelatedCard->repository = $dedicatedRepo;
            $unrelatedCard->title = 'Add dark mode toggle and refine navigation';
            $unrelatedCard->description = 'Change navbar styling and add CSS theme tokens.';
            $unrelatedCard->status = 'queued';
            $unrelatedCard->save();

            $request = $this->request('POST', "/issues/tasks/{$unrelatedCard->id}/assign");
            $request->session()->put('github_auth', [
                'token' => 'fake-token',
                'user' => ['id' => 1],
                'repositories' => [['fullName' => $dedicatedRepo, 'isPrivate' => false]],
            ]);

            $middleware = new AuthorizeGithubTasks(new GitHubAppClient(new MockHttpClient([
                new MockResponse(json_encode(['id' => 1, 'login' => 'user1'])),
                new MockResponse(json_encode(['installations' => [['id' => 101]]])),
                new MockResponse(json_encode(['repositories' => [[
                    'id' => 5, 'name' => 'dedicated-test', 'full_name' => $dedicatedRepo,
                    'owner' => ['login' => 'owner'], 'private' => false,
                ]]])),
            ])));

            $response = $middleware->handle($request, fn (Request $req) => (new LocalTaskCardController())->assign($req, (int) $unrelatedCard->id));
            self::assertTrue($response->isRedirection());
            self::assertStringContainsString('Task assignment is not available yet', (string) $request->session()->get('error'));

            $unrelatedCard->refresh();
            self::assertSame('queued', $unrelatedCard->status);
            self::assertNull($unrelatedCard->workbench_task_id);
            self::assertNull($request->session()->get('issue_context'));

            // Case 2: Unrelated public repository
            $publicCard = new LocalTaskCard();
            $publicCard->github_user_id = 1;
            $publicCard->repository = 'owner/unrelated-public-repo';
            $publicCard->title = 'Fix header styling';
            $publicCard->description = 'Navbar padding is too small.';
            $publicCard->status = 'queued';
            $publicCard->save();

            $request2 = $this->request('POST', "/issues/tasks/{$publicCard->id}/assign");
            $request2->session()->put('github_auth', [
                'token' => 'fake-token',
                'user' => ['id' => 1],
                'repositories' => [['fullName' => 'owner/unrelated-public-repo', 'isPrivate' => false]],
            ]);

            $middleware2 = new AuthorizeGithubTasks(new GitHubAppClient(new MockHttpClient([
                new MockResponse(json_encode(['id' => 1, 'login' => 'user1'])),
                new MockResponse(json_encode(['installations' => [['id' => 101]]])),
                new MockResponse(json_encode(['repositories' => [[
                    'id' => 7, 'name' => 'unrelated-public-repo', 'full_name' => 'owner/unrelated-public-repo',
                    'owner' => ['login' => 'owner'], 'private' => false,
                ]]])),
            ])));

            $response2 = $middleware2->handle($request2, fn (Request $req) => (new LocalTaskCardController())->assign($req, (int) $publicCard->id));
            self::assertTrue($response2->isRedirection());
            self::assertStringContainsString('Task assignment is not available yet', (string) $request2->session()->get('error'));

            $publicCard->refresh();
            self::assertSame('queued', $publicCard->status);
            self::assertNull($publicCard->workbench_task_id);
            self::assertNull($request2->session()->get('issue_context'));
        } finally {
            $previousRepo === false ? putenv('PROOFPATCH_TEST_REPO') : putenv('PROOFPATCH_TEST_REPO=' . $previousRepo);
            $previousBaseCommit === false ? putenv('PROOFPATCH_TEST_BASE_COMMIT') : putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $previousBaseCommit);
        }
    }

    public function testPreviouslyLinkedCardTracksWorkbenchLifecycle(): void
    {
        $previousRepo = getenv('PROOFPATCH_TEST_REPO');
        $previousBaseCommit = getenv('PROOFPATCH_TEST_BASE_COMMIT');
        $dedicatedRepo = 'owner/dedicated-test';
        putenv('PROOFPATCH_TEST_REPO=' . $dedicatedRepo);
        putenv('PROOFPATCH_TEST_BASE_COMMIT=' . str_repeat('c', 40));

        try {
            $card = new LocalTaskCard();
            $card->github_user_id = 1;
            $card->repository = $dedicatedRepo;
            $card->title = 'Fix order total calculation for zero quantity';
            $card->description = 'Private user reproduction notes: customer entered 0 quantity and was charged.';
            $card->status = 'queued';
            $card->save();

            // Exercise lifecycle behavior for an explicitly constructed test record,
            // without treating the fixed fixture as a real card assignment.
            $source = (string) file_get_contents(base_path('tests/Fixtures/owned-review-case/src/OrderTotal.php'));
            $context = [
                'repository' => $dedicatedRepo,
                'issueNumber' => 1,
                'path' => 'src/OrderTotal.php',
                'commit' => str_repeat('c', 40),
                'source' => $source,
                'sourceSha256' => hash('sha256', $source),
            ];
            $task = \ProofPatch\Models\WorkbenchTask::recordIntake($context, true, githubUserId: 1);
            $task->status = 'in_progress';
            $task->metadata = ['local_task_card_id' => $card->id];
            $task->save();
            $card->status = 'in_progress';
            $card->workbench_task_id = $task->id;
            $card->save();

            // 1. Propose proposal -> card stays in_progress
            $suggestion = [
                'status' => 'offline_reference_example',
                'isOfflineExample' => true,
                'model' => null,
                'path' => 'src/OrderTotal.php',
                'find' => "max(1, \$item['quantity'])",
                'replace' => "\$item['quantity']",
                'candidate' => [
                    'source' => str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $context['source']),
                    'sha256' => hash('sha256', str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $context['source'])),
                ],
            ];
            $task->recordProposal($suggestion);
            $card->refresh();
            self::assertSame('in_progress', $card->status);

            // 2. Verify candidate -> card becomes needs_review
            $report = [
                'id' => 'run-test-123',
                'decision' => 'VERIFIED',
                'isSimulated' => false,
            ];
            $task->recordVerification($report, (int) $task->version, $suggestion['candidate']['sha256']);
            $card->refresh();
            self::assertSame('needs_review', $card->status);

            // 3. Publish PR -> card becomes completed
            $prResult = [
                'prNumber' => 42,
                'prUrl' => 'https://github.com/' . $dedicatedRepo . '/pull/42',
                'branch' => 'proofpatch/fix-run-test-123',
                'receiptSha256' => str_repeat('e', 64),
            ];
            $task->claimPublication((int) $task->version, $suggestion['candidate']['sha256'], 'run-test-123');
            $task->recordPublication($prResult, (int) $task->version, 'run-test-123', $suggestion['candidate']['sha256']);
            $card->refresh();
            self::assertSame('completed', $card->status);
        } finally {
            $previousRepo === false ? putenv('PROOFPATCH_TEST_REPO') : putenv('PROOFPATCH_TEST_REPO=' . $previousRepo);
            $previousBaseCommit === false ? putenv('PROOFPATCH_TEST_BASE_COMMIT') : putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $previousBaseCommit);
        }
    }

    public function testKeywordMatchedSyntheticCardDoesNotLoadOrAssignFixture(): void
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'synthetic-fixture/order-total';
        $card->title = 'Fix order total synthetic bug';
        $card->description = 'Private description text';
        $card->status = 'queued';
        $card->save();

        $request = $this->request('POST', "/issues/tasks/{$card->id}/assign");
        $request->session()->put('github_auth', [
            'token' => 'fake-token',
            'user' => ['id' => 1],
            'repositories' => [['fullName' => 'synthetic-fixture/order-total', 'isPrivate' => false]],
        ]);

        $middleware = new AuthorizeGithubTasks(new GitHubAppClient(new MockHttpClient([
            new MockResponse(json_encode(['id' => 1, 'login' => 'user1'])),
            new MockResponse(json_encode(['installations' => [['id' => 101]]])),
            new MockResponse(json_encode(['repositories' => [[
                'id' => 9, 'name' => 'order-total', 'full_name' => 'synthetic-fixture/order-total',
                'owner' => ['login' => 'synthetic-fixture'], 'private' => false,
            ]]])),
        ])));

        $response = $middleware->handle($request, fn (Request $req) => (new LocalTaskCardController())->assign($req, (int) $card->id));
        self::assertTrue($response->isRedirection());
        self::assertStringContainsString('Task assignment is not available yet', (string) $request->session()->get('error'));
        $card->refresh();
        self::assertSame('queued', $card->status);
        self::assertNull($card->workbench_task_id);
        self::assertNull($request->session()->get('issue_context'));
        self::assertSame(0, \ProofPatch\Models\WorkbenchTask::count());
    }

    public function testAssignmentDoesNotReplaceKeywordMatchingCardOrExistingContext(): void
    {
        $card = new LocalTaskCard();
        $card->github_user_id = 1;
        $card->repository = 'owner/dedicated-test';
        $card->title = 'Improve warehouse quantity chart';
        $card->description = 'Use the attached screenshot to fix the colors.';
        $card->status = 'queued';
        $card->save();

        $request = $this->request('POST', "/issues/tasks/{$card->id}/assign");
        $request->attributes->set('proofpatch_github_access', [
            'userId' => 1,
            'repositories' => ['owner/dedicated-test' => true],
        ]);
        $request->session()->put('issue_context', ['sentinel' => 'previous context']);
        $response = (new LocalTaskCardController())->assign($request, (int) $card->id);

        self::assertTrue($response->isRedirection());
        self::assertStringContainsString('Task assignment is not available yet', $request->session()->get('error'));
        self::assertSame(['sentinel' => 'previous context'], $request->session()->get('issue_context'));
        self::assertSame(0, \ProofPatch\Models\WorkbenchTask::count());
        $card->refresh();
        self::assertSame('queued', $card->status);
        self::assertNull($card->workbench_task_id);
        self::assertSame('Use the attached screenshot to fix the colors.', $card->description);
    }

    public function testFailedDedicatedFetchDoesNotSubstituteLocalFixture(): void
    {
        $previousRepo = getenv('PROOFPATCH_TEST_REPO');
        $previousBase = getenv('PROOFPATCH_TEST_BASE_COMMIT');
        putenv('PROOFPATCH_TEST_REPO=owner/dedicated-test');
        putenv('PROOFPATCH_TEST_BASE_COMMIT=' . str_repeat('c', 40));
        try {
            $card = new LocalTaskCard();
            $card->github_user_id = 1;
            $card->repository = 'owner/dedicated-test';
            $card->title = 'Fix order total for zero quantity';
            $card->description = 'Zero quantity should not be charged.';
            $card->status = 'queued';
            $card->save();
            $request = $this->request('POST', "/issues/tasks/{$card->id}/assign");
            $request->attributes->set('proofpatch_github_access', [
                'userId' => 1, 'repositories' => ['owner/dedicated-test' => true],
            ]);
            $request->session()->put('issue_context', ['sentinel' => 'previous context']);
            $fetcher = new DedicatedTestRepoFetcher(new MockHttpClient(new MockResponse('', ['http_code' => 404])));

            (new LocalTaskCardController($fetcher))->assign($request, (int) $card->id);

            self::assertStringContainsString('Failed to assign task', (string) $request->session()->get('error'));
            self::assertSame(['sentinel' => 'previous context'], $request->session()->get('issue_context'));
            self::assertSame(0, \ProofPatch\Models\WorkbenchTask::count());
            $card->refresh();
            self::assertSame('queued', $card->status);
            self::assertNull($card->workbench_task_id);
        } finally {
            $previousRepo === false ? putenv('PROOFPATCH_TEST_REPO') : putenv('PROOFPATCH_TEST_REPO=' . $previousRepo);
            $previousBase === false ? putenv('PROOFPATCH_TEST_BASE_COMMIT') : putenv('PROOFPATCH_TEST_BASE_COMMIT=' . $previousBase);
        }
    }

    public function testMigrationRollbackOnlyRemovesLocalCardsInIsolatedDatabase(): void
    {
        $migration = require dirname(__DIR__, 2).'/database/migrations/2026_10_30_000001_create_local_task_cards.php';
        self::assertTrue(\Illuminate\Support\Facades\Schema::hasTable('workbench_tasks'));
        self::assertTrue(\Illuminate\Support\Facades\Schema::hasTable('local_task_cards'));
        $migration->down();
        self::assertFalse(\Illuminate\Support\Facades\Schema::hasTable('local_task_cards'));
        self::assertTrue(\Illuminate\Support\Facades\Schema::hasTable('workbench_tasks'));
        $migration->up();
        self::assertTrue(\Illuminate\Support\Facades\Schema::hasTable('local_task_cards'));
    }
}
