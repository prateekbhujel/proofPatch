<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Http\Controllers\DashboardController;
use ProofPatch\GitHub\PullRequestSnapshot;

final class PrivateRepositoryStorageIsolationTest extends TestCase
{
    private string $tempSnapshotsDir;

    protected function setUp(): void
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        $this->tempSnapshotsDir = sys_get_temp_dir().'/proofpatch_test_snapshots_'.bin2hex(random_bytes(6));
        @mkdir($this->tempSnapshotsDir, 0755, true);
        putenv('PROOFPATCH_SNAPSHOT_DIR='.$this->tempSnapshotsDir);
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        putenv('PROOFPATCH_SNAPSHOT_DIR');
        if (is_dir($this->tempSnapshotsDir)) {
            foreach (glob($this->tempSnapshotsDir.'/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($this->tempSnapshotsDir);
        }
        $_SESSION = [];
        @restore_error_handler();
        @restore_exception_handler();
    }

    public function testCaptureInstalledPullRequestRejectsPrivateRepository(): void
    {
        $session = app('session')->driver('array');
        $session->put('github_auth', [
            'token' => 'test_token',
            'user' => ['login' => 'pratikbhujel'],
            'repositories' => [
                [
                    'id' => 1,
                    'name' => 'secret-repo',
                    'fullName' => 'pratikbhujel/secret-repo',
                    'isPrivate' => true,
                ],
            ],
        ]);
        $session->save();

        $controller = new DashboardController();
        $request = Request::create('/github/pulls/capture', 'POST', [
            'repository' => 'pratikbhujel/secret-repo',
            'number' => 12,
        ]);
        $request->setLaravelSession($session);

        $response = $controller->captureInstalledPullRequest($request);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertStringContainsString('Private repository capture is disabled', $session->get('github_error') ?? '');

        // Verify zero snapshots or preview diff files were written to disk
        $files = glob($this->tempSnapshotsDir.'/*');
        $this->assertEmpty($files);
    }

    public function testOverviewExcludesPrivateSnapshotsFromListing(): void
    {
        $store = new PullRequestSnapshot($this->tempSnapshotsDir);

        // Capture a public PR
        $publicPr = [
            'repository' => 'pratikbhujel/public-tool',
            'number' => 1,
            'title' => 'Public PR Title',
            'state' => 'open',
            'headSha' => str_repeat('a', 40),
            'baseSha' => str_repeat('b', 40),
            'isPrivate' => false,
        ];
        $store->capture($publicPr);

        // Capture a private PR directly in store (as if historical)
        $privatePr = [
            'repository' => 'pratikbhujel/private-billing',
            'number' => 99,
            'title' => 'Proprietary Billing Code',
            'state' => 'open',
            'headSha' => str_repeat('c', 40),
            'baseSha' => str_repeat('d', 40),
            'isPrivate' => true,
        ];
        $store->capture($privatePr);

        $controller = new DashboardController();
        $response = $controller->overview();
        $this->assertInstanceOf(\Inertia\Response::class, $response);

        $props = $response->toResponse(Request::create('/'))->getOriginalContent()->getData()['page']['props'];

        $this->assertSame(1, $props['totalSnapshots']);
        $this->assertCount(1, $props['recent']);
        $this->assertSame('pratikbhujel/public-tool', $props['recent'][0]['pull']['repository']);
        $this->assertSame('Public PR Title', $props['recent'][0]['pull']['title']);

        // Verify private repository metadata is NEVER present in overview props
        $json = json_encode($props);
        $this->assertStringNotContainsString('pratikbhujel/private-billing', $json);
        $this->assertStringNotContainsString('Proprietary Billing Code', $json);
    }

    public function testSavedPrivateSnapshotRejectsUnauthorizedViewer(): void
    {
        $store = new PullRequestSnapshot($this->tempSnapshotsDir);
        $privatePr = [
            'repository' => 'pratikbhujel/classified-infra',
            'number' => 5,
            'title' => 'Secret Keys Rotation',
            'state' => 'open',
            'headSha' => str_repeat('e', 40),
            'baseSha' => str_repeat('f', 40),
            'isPrivate' => true,
        ];
        $snapshot = $store->capture($privatePr);

        $session = app('session')->driver('array');
        // Unauthenticated session (no github_auth)
        $session->save();

        $controller = new DashboardController();
        $request = Request::create('/repositories?snapshot='.$snapshot['id'], 'GET');
        $request->setLaravelSession($session);

        $inertiaResponse = $controller->repositories($request);
        $props = $inertiaResponse->toResponse($request)->getOriginalContent()->getData()['page']['props'];

        // Fails closed: pull is null and error is reported
        $this->assertNull($props['pull']);
        $this->assertNull($props['snapshot']);
        $this->assertStringContainsString('Access denied', (string) ($props['error'] ?? ''));
        $this->assertStringContainsString('verified public repositories', (string) ($props['error'] ?? ''));
    }

    public function testSavedPrivateSnapshotFailsClosedEvenWithCachedRepositoryPermissions(): void
    {
        $store = new PullRequestSnapshot($this->tempSnapshotsDir);
        $privatePr = [
            'repository' => 'pratikbhujel/classified-infra',
            'number' => 5,
            'title' => 'Secret Keys Rotation',
            'state' => 'open',
            'headSha' => str_repeat('e', 40),
            'baseSha' => str_repeat('f', 40),
            'isPrivate' => true,
        ];
        $snapshot = $store->capture($privatePr);
        $snapshotFilePath = $this->tempSnapshotsDir.'/'.$snapshot['id'].'.json';
        $this->assertFileExists($snapshotFilePath);

        $session = app('session')->driver('array');
        $session->put('github_auth', [
            'token' => 'authorized_token',
            'user' => ['login' => 'pratikbhujel'],
            'repositories' => [
                ['fullName' => 'pratikbhujel/classified-infra'],
            ],
        ]);
        $session->save();

        $controller = new DashboardController();
        $request = Request::create('/repositories?snapshot='.$snapshot['id'], 'GET');
        $request->setLaravelSession($session);

        $inertiaResponse = $controller->repositories($request);
        $props = $inertiaResponse->toResponse($request)->getOriginalContent()->getData()['page']['props'];

        // Fails closed: private snapshots must never be loaded, preventing stale access after remote revocation
        $this->assertNull($props['pull']);
        $this->assertNull($props['snapshot']);
        $this->assertStringContainsString('Access denied', (string) ($props['error'] ?? ''));
        $this->assertStringContainsString('verified public repositories', (string) ($props['error'] ?? ''));

        // Crucial invariant: historical file on disk is preserved (never deleted)
        $this->assertFileExists($snapshotFilePath);
    }

    public function testDisconnectPurgesPrivatePullFromSession(): void
    {
        $session = app('session')->driver('array');
        $session->put('github_auth', ['token' => 'valid_token']);
        $session->put('pullRequest', [
            'repository' => 'pratikbhujel/confidential',
            'number' => 3,
            'isPrivate' => true,
        ]);
        $session->put('pullRequestSnapshot', ['id' => 'snap_123']);
        $session->put('patch_preview', ['files' => []]);
        $session->put('review_drafts', ['draft1' => ['comment' => 'classified note']]);
        $session->save();

        $controller = new DashboardController();
        $disconnectRequest = Request::create('/github/device/disconnect', 'POST');
        $disconnectRequest->setLaravelSession($session);

        $response = $controller->disconnectDeviceFlow($disconnectRequest);

        $this->assertSame(302, $response->getStatusCode());
        // Verify all private PR data was wiped from session
        $this->assertNull($session->get('pullRequest'));
        $this->assertNull($session->get('pullRequestSnapshot'));
        $this->assertNull($session->get('patch_preview'));
        $this->assertNull($session->get('review_drafts'));
    }
}
