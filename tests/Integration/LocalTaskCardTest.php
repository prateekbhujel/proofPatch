<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\GitHubAppClient;
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
}
