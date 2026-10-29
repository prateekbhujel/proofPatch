<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\GitHubAppClient;
use ProofPatch\Http\Controllers\IssueWorkbenchController;
use ProofPatch\Http\Middleware\AuthorizeGithubTasks;
use ProofPatch\Models\WorkbenchTask;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class IssueCaptureOwnershipAndReloadTest extends TestCase
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

    public function testAuthenticatedCaptureBindsUserAndPreservesTaskAcrossRedirectAndReload(): void
    {
        $commitSha = str_repeat('a', 40);
        $sourceCode = "<?php\ndeclare(strict_types=1);\nfunction orderTotal(array \$items): int { return 100; }\n";

        // GitHub API responses for PublicIssueContext::fetch()
        $apiResponses = [
            // 1. Initial repo check
            new MockResponse(json_encode([
                'default_branch' => 'main',
                'private' => false,
                'visibility' => 'public',
                'full_name' => 'test-owner/public-test-repo',
            ])),
            // 2. Commit check
            new MockResponse(json_encode([
                'sha' => $commitSha,
            ])),
            // 3. Issue metadata
            new MockResponse(json_encode([
                'number' => 7,
                'title' => 'Calculation Bug in Order Total',
                'body' => 'Zero-quantity items should not contribute to the total.',
            ])),
            // 4. File content
            new MockResponse(json_encode([
                'type' => 'file',
                'path' => 'src/OrderTotal.php',
                'encoding' => 'base64',
                'size' => strlen($sourceCode),
                'content' => base64_encode($sourceCode),
            ])),
            // 5. Re-check repo
            new MockResponse(json_encode([
                'default_branch' => 'main',
                'private' => false,
                'visibility' => 'public',
                'full_name' => 'test-owner/public-test-repo',
            ])),
            // 6. Re-check commit
            new MockResponse(json_encode([
                'sha' => $commitSha,
            ])),
        ];

        $http = new MockHttpClient($apiResponses);
        $controller = new IssueWorkbenchController($http);

        // 1. Start authenticated session for user 1
        $session = app('session')->driver('array');
        $session->put('github_auth', [
            'token' => 'verified-pat-token-user1',
            'user' => ['id' => 1, 'login' => 'user1'],
            'repositories' => [
                ['fullName' => 'test-owner/public-test-repo', 'isPrivate' => false],
            ],
        ]);
        app('redirect')->setSession($session);

        // Middleware for user 1
        $user1Client = new GitHubAppClient(new MockHttpClient(function (string $method, string $url) {
            $path = (string) parse_url($url, PHP_URL_PATH);
            if (str_ends_with($path, '/user')) {
                return new MockResponse(json_encode(['id' => 1, 'login' => 'user1']));
            }
            if (str_ends_with($path, '/user/installations')) {
                return new MockResponse(json_encode(['installations' => [['id' => 10]]]));
            }
            return new MockResponse(json_encode(['repositories' => [
                ['id' => 101, 'name' => 'public-test-repo', 'full_name' => 'test-owner/public-test-repo', 'private' => false],
            ]]));
        }));
        $middleware1 = new AuthorizeGithubTasks($user1Client);

        // 2. POST /issues/capture
        $captureRequest = Request::create('/issues/capture', 'POST', [
            'issue_url' => 'https://github.com/test-owner/public-test-repo/issues/7',
            'path' => 'src/OrderTotal.php',
        ]);
        $captureRequest->setLaravelSession($session);

        $captureResponse = $middleware1->handle($captureRequest, fn ($req) => $controller->capture($req));

        self::assertTrue($captureResponse->isRedirection(), 'Capture must redirect back to workbench');
        self::assertTrue(str_ends_with((string) $captureResponse->headers->get('Location'), '/issues'));

        // Verify task was recorded and bound to authenticated user 1
        $taskId = $session->get('issue_task_id');
        self::assertNotNull($taskId, 'Capture must set issue_task_id in session');
        $task = WorkbenchTask::findOrFail($taskId);
        self::assertSame(1, $task->github_user_id, 'Task must be bound to the authenticated GitHub user ID');
        self::assertTrue($task->metadata['is_confirmed_public'] ?? false, 'Task must be recorded as confirmed public');

        // 3. Follow redirect: GET /issues
        $redirectGetRequest = Request::create('/issues', 'GET', [], [], [], [
            'HTTP_X_INERTIA' => 'true',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_INERTIA_VERSION' => hash_file('xxh128', public_path('build/manifest.json')),
        ]);
        $redirectGetRequest->setLaravelSession($session);

        $getResponse = $middleware1->handle($redirectGetRequest, fn ($req) => $controller->show($req)->toResponse($req));
        self::assertSame(200, $getResponse->getStatusCode());

        // Assert session still has context and task ID intact
        self::assertSame($taskId, $session->get('issue_task_id'), 'Redirected GET must preserve issue_task_id in session');
        self::assertNotNull($session->get('issue_context'), 'Redirected GET must preserve issue_context in session');

        $page = json_decode((string) $getResponse->getContent(), true, 64, JSON_THROW_ON_ERROR);
        $taskIdsOnBoard = array_column($page['props']['tasks'] ?? [], 'id');
        self::assertContains($taskId, $taskIdsOnBoard, 'Task must appear on workbench board after redirect');

        // 4. Reload: subsequent GET /issues with the same session
        $reloadRequest = Request::create('/issues', 'GET', [], [], [], [
            'HTTP_X_INERTIA' => 'true',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_INERTIA_VERSION' => hash_file('xxh128', public_path('build/manifest.json')),
        ]);
        $reloadRequest->setLaravelSession($session);

        $reloadResponse = $middleware1->handle($reloadRequest, fn ($req) => $controller->show($req)->toResponse($req));
        self::assertSame(200, $reloadResponse->getStatusCode());

        self::assertSame($taskId, $session->get('issue_task_id'), 'Subsequent reload must NOT clear issue_task_id');
        self::assertNotNull($session->get('issue_context'), 'Subsequent reload must NOT clear issue_context');

        $reloadPage = json_decode((string) $reloadResponse->getContent(), true, 64, JSON_THROW_ON_ERROR);
        $reloadTaskIds = array_column($reloadPage['props']['tasks'] ?? [], 'id');
        self::assertContains($taskId, $reloadTaskIds, 'Task must still appear on workbench board after page reload');

        // 5. Verify that User 2 cannot access User 1's captured task
        $user2Session = app('session')->driver('array');
        $user2Session->put('github_auth', [
            'token' => 'token-user2',
            'user' => ['id' => 2, 'login' => 'user2'],
        ]);
        $user2Session->put('issue_task_id', $taskId);
        $user2Session->put('issue_context', $session->get('issue_context'));

        $user2Client = new GitHubAppClient(new MockHttpClient([
            new MockResponse(json_encode(['id' => 2, 'login' => 'user2'])),
            new MockResponse(json_encode(['installations' => []])),
        ]));
        $middleware2 = new AuthorizeGithubTasks($user2Client);

        $user2Request = Request::create('/issues', 'GET');
        $user2Request->setLaravelSession($user2Session);

        $middleware2->handle($user2Request, fn ($req) => $controller->show($req)->toResponse($req));
        self::assertNull($user2Session->get('issue_task_id'), 'User 2 session must have User 1 task ID cleared');
        self::assertNull($user2Session->get('issue_context'), 'User 2 session must have User 1 context cleared');
    }
}
