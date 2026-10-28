<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Application\DashboardController;

final class GitHubDeviceFlowIntegrationTest extends TestCase
{
    private string $tempSnapshots;

    protected function setUp(): void
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        $this->tempSnapshots = sys_get_temp_dir().'/proofpatch_deviceflow_int_'.bin2hex(random_bytes(6));
        putenv('PROOFPATCH_SNAPSHOT_DIR='.$this->tempSnapshots);
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        putenv('PROOFPATCH_SNAPSHOT_DIR');
        foreach (glob($this->tempSnapshots.'/*') ?: [] as $f) {
            @unlink($f);
        }
        if (is_dir($this->tempSnapshots)) {
            @rmdir($this->tempSnapshots);
        }
        $_SESSION = [];

        @restore_error_handler();
        @restore_exception_handler();
    }

    public function testInitiateFailsWhenNoClientIdProvided(): void
    {
        putenv('PROOFPATCH_GITHUB_CLIENT_ID');
        putenv('GITHUB_APP_CLIENT_ID');

        $controller = new DashboardController();
        $request = Request::create('/github/device/initiate', 'POST', []);

        $response = $controller->initiateDeviceFlow($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertNull($_SESSION['github_device_flow'] ?? null);
        $this->assertStringContainsString('Client ID is required', $_SESSION['github_error'] ?? (session('github_error') ?? ''));
    }

    public function testPollFailsWhenNoDeviceFlowActive(): void
    {
        $controller = new DashboardController();
        $request = Request::create('/github/device/poll', 'POST', []);

        $response = $controller->pollDeviceFlow($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertStringContainsString('No active device flow session', $_SESSION['github_error'] ?? (session('github_error') ?? ''));
    }

    public function testPollFailsWhenCodeExpired(): void
    {
        $_SESSION['github_device_flow'] = [
            'clientId' => 'Iv1.test',
            'deviceCode' => 'expired_code',
            'userCode' => 'ABCD-1234',
            'verificationUri' => 'https://github.com/login/device',
            'expiresAt' => time() - 100, // Expired in past
            'interval' => 5,
        ];

        $controller = new DashboardController();
        $request = Request::create('/github/device/poll', 'POST', []);

        $response = $controller->pollDeviceFlow($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertNull($_SESSION['github_device_flow'] ?? null);
        $this->assertStringContainsString('expired', $_SESSION['github_error'] ?? (session('github_error') ?? ''));
    }

    public function testDisconnectClearsAllGitHubSessionState(): void
    {
        $_SESSION['github_auth'] = ['token' => 'tok', 'user' => ['login' => 'testuser']];
        $_SESSION['github_device_flow'] = ['deviceCode' => 'abc'];
        $_SESSION['selected_github_repo'] = 'testuser/repo';
        $_SESSION['github_repo_pulls'] = [['number' => 1]];

        $controller = new DashboardController();
        $response = $controller->disconnectDeviceFlow();

        $this->assertSame(302, $response->getStatusCode());
        $this->assertArrayNotHasKey('github_auth', $_SESSION);
        $this->assertArrayNotHasKey('github_device_flow', $_SESSION);
        $this->assertArrayNotHasKey('selected_github_repo', $_SESSION);
        $this->assertArrayNotHasKey('github_repo_pulls', $_SESSION);
    }

    public function testSelectInstalledRepositoryFailsWhenUnauthenticated(): void
    {
        $controller = new DashboardController();
        $request = Request::create('/github/repositories/select', 'POST', ['repository' => 'owner/repo']);

        $response = $controller->selectInstalledRepository($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertStringContainsString('not connected', $_SESSION['github_error'] ?? (session('github_error') ?? ''));
    }

    public function testSelectInstalledRepositoryFailsWhenRepoNotAuthorized(): void
    {
        $_SESSION['github_auth'] = [
            'token' => 'mock_token',
            'repositories' => [
                ['fullName' => 'authorized/repo'],
            ],
        ];

        $controller = new DashboardController();
        $request = Request::create('/github/repositories/select', 'POST', ['repository' => 'unauthorized/repo']);

        $response = $controller->selectInstalledRepository($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertStringContainsString('not authorized for this installation', $_SESSION['github_error'] ?? (session('github_error') ?? ''));
    }

    public function testCaptureInstalledPullRequestFailsWhenInvalidNumber(): void
    {
        $_SESSION['github_auth'] = [
            'token' => 'mock_token',
            'repositories' => [
                ['fullName' => 'authorized/repo'],
            ],
        ];

        $controller = new DashboardController();
        $request = Request::create('/github/pulls/capture', 'POST', [
            'repository' => 'authorized/repo',
            'number' => 0,
        ]);

        $response = $controller->captureInstalledPullRequest($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertStringContainsString('valid pull request number', $_SESSION['github_error'] ?? (session('github_error') ?? ''));
    }

    public function testLaravelSessionPersistenceAcrossLifecycle(): void
    {
        $session = app('session')->driver('array');
        $controller = new DashboardController();

        // Store connected GitHub auth into Laravel session
        $session->put('github_auth', [
            'token' => 'ghu_super_secret_access_token_12345',
            'user' => [
                'login' => 'pratikbhujel',
                'name' => 'Pratik Bhujel',
                'avatarUrl' => null,
                'htmlUrl' => 'https://github.com/pratikbhujel',
            ],
            'repositories' => [
                [
                    'id' => 1,
                    'name' => 'my-repo',
                    'fullName' => 'pratikbhujel/my-repo',
                    'owner' => 'pratikbhujel',
                    'isPrivate' => true,
                    'defaultBranch' => 'main',
                    'htmlUrl' => 'https://github.com/pratikbhujel/my-repo',
                ],
            ],
            'connectedAt' => gmdate(DATE_ATOM),
        ]);
        $session->save();

        // Subsequent request using the same Laravel session to view repositories
        $viewRequest = Request::create('/repositories', 'GET');
        $viewRequest->setLaravelSession($session);

        $inertiaResponse = $controller->repositories($viewRequest);
        $this->assertInstanceOf(\Inertia\Response::class, $inertiaResponse);

        $props = $inertiaResponse->toResponse($viewRequest)->getOriginalContent()->getData()['page']['props'];

        // Verify connected state is correctly read from Laravel session
        $this->assertTrue($props['githubConnection']['isConnected']);
        $this->assertSame('pratikbhujel', $props['githubConnection']['user']['login']);
        $this->assertCount(1, $props['githubConnection']['repositories']);
        $this->assertTrue($props['githubConnection']['repositories'][0]['isPrivate']);

        // CRITICAL: Verify secret token is NEVER exposed to client-side props
        $serializedProps = json_encode($props);
        $this->assertStringNotContainsString('ghu_super_secret_access_token_12345', $serializedProps);
        $this->assertArrayNotHasKey('token', $props['githubConnection']);

        // Disconnect request using same Laravel session
        $disconnectRequest = Request::create('/github/device/disconnect', 'POST');
        $disconnectRequest->setLaravelSession($session);

        $disconnectResponse = $controller->disconnectDeviceFlow($disconnectRequest);
        $this->assertSame(302, $disconnectResponse->getStatusCode());

        // Verify session was cleared in Laravel session store
        $this->assertNull($session->get('github_auth'));
        $this->assertNull($session->get('github_device_flow'));
    }
}
