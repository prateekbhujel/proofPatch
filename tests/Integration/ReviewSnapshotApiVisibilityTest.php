<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PullRequestSnapshot;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;

final class ReviewSnapshotApiVisibilityTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    private string $tempSnapshotsDir;
    private ?string $priorSnapshotDir;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();

        $this->tempSnapshotsDir = sys_get_temp_dir() . '/proofpatch_snap_vis_' . bin2hex(random_bytes(6));
        mkdir($this->tempSnapshotsDir, 0700, true);

        $this->priorSnapshotDir = getenv('PROOFPATCH_SNAPSHOT_DIR') ?: null;
        putenv('PROOFPATCH_SNAPSHOT_DIR=' . $this->tempSnapshotsDir);
    }

    protected function tearDown(): void
    {
        if ($this->priorSnapshotDir !== null) {
            putenv('PROOFPATCH_SNAPSHOT_DIR=' . $this->priorSnapshotDir);
        } else {
            putenv('PROOFPATCH_SNAPSHOT_DIR');
        }

        if (is_dir($this->tempSnapshotsDir)) {
            foreach (glob($this->tempSnapshotsDir . '/*') ?: [] as $file) {
                @unlink($file);
            }
            @rmdir($this->tempSnapshotsDir);
        }

        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    public function testPrivateAndUnknownSnapshotsFailClosedOverApi(): void
    {
        $store = new PullRequestSnapshot($this->tempSnapshotsDir);

        // 1. Private repository snapshot
        $privatePull = [
            'repository' => 'secret-corp/private-project',
            'number' => 42,
            'title' => 'Top Secret Algorithm',
            'state' => 'open',
            'headSha' => str_repeat('a', 40),
            'baseSha' => str_repeat('b', 40),
            'user' => 'alice',
            'isPrivate' => true,
            'visibility' => 'private',
            'files' => [['name' => 'secret.php', 'additions' => 10, 'deletions' => 0]],
        ];
        $privateSnap = $store->capture($privatePull);
        $privateReviewId = DB::table('review_jobs')->insertGetId([
            'repository' => 'secret-corp/private-project',
            'pull_number' => 42,
            'head_sha' => str_repeat('a', 40),
            'status' => 'not_verified',
            'snapshot_id' => $privateSnap['id'],
            'snapshot_sha256' => $privateSnap['sha256'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Unknown-visibility legacy snapshot (omitted isPrivate)
        $unknownPullA = [
            'repository' => 'legacy-corp/ambiguous-project',
            'number' => 100,
            'title' => 'Ambiguous PR',
            'state' => 'open',
            'headSha' => str_repeat('c', 40),
            'baseSha' => str_repeat('d', 40),
            'user' => 'bob',
            'files' => [['name' => 'app.php', 'additions' => 5, 'deletions' => 2]],
        ];
        $unknownSnapA = $store->capture($unknownPullA);
        $unknownReviewIdA = DB::table('review_jobs')->insertGetId([
            'repository' => 'legacy-corp/ambiguous-project',
            'pull_number' => 100,
            'head_sha' => str_repeat('c', 40),
            'status' => 'not_verified',
            'snapshot_id' => $unknownSnapA['id'],
            'snapshot_sha256' => $unknownSnapA['sha256'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Unknown-visibility snapshot with non-public visibility
        $unknownPullB = [
            'repository' => 'internal-corp/internal-project',
            'number' => 101,
            'title' => 'Internal PR',
            'state' => 'open',
            'headSha' => str_repeat('e', 40),
            'baseSha' => str_repeat('f', 40),
            'user' => 'charlie',
            'isPrivate' => false,
            'visibility' => 'internal',
            'files' => [['name' => 'main.php', 'additions' => 1, 'deletions' => 1]],
        ];
        $unknownSnapB = $store->capture($unknownPullB);
        $unknownReviewIdB = DB::table('review_jobs')->insertGetId([
            'repository' => 'internal-corp/internal-project',
            'pull_number' => 101,
            'head_sha' => str_repeat('e', 40),
            'status' => 'not_verified',
            'snapshot_id' => $unknownSnapB['id'],
            'snapshot_sha256' => $unknownSnapB['sha256'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4. Explicitly public snapshot
        $publicPull = [
            'repository' => 'public-org/open-project',
            'number' => 1,
            'title' => 'Public Contribution',
            'state' => 'open',
            'headSha' => str_repeat('1', 40),
            'baseSha' => str_repeat('2', 40),
            'user' => 'dan',
            'isPrivate' => false,
            'visibility' => 'public',
            'files' => [['name' => 'README.md', 'additions' => 3, 'deletions' => 0]],
        ];
        $publicSnap = $store->capture($publicPull);
        $publicReviewId = DB::table('review_jobs')->insertGetId([
            'repository' => 'public-org/open-project',
            'pull_number' => 1,
            'head_sha' => str_repeat('1', 40),
            'status' => 'not_verified',
            'snapshot_id' => $publicSnap['id'],
            'snapshot_sha256' => $publicSnap['sha256'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $kernel = app(\Illuminate\Contracts\Http\Kernel::class);

        // Verify private review fails closed (404)
        $reqPrivate = Request::create('/reviews/' . $privateReviewId, 'GET');
        $resPrivate = $kernel->handle($reqPrivate);
        self::assertSame(404, $resPrivate->getStatusCode());
        self::assertStringContainsString('Review not found.', (string) $resPrivate->getContent());
        self::assertStringNotContainsString('secret-corp', (string) $resPrivate->getContent());
        $kernel->terminate($reqPrivate, $resPrivate);

        // Verify unknown visibility review A fails closed (404)
        $reqUnknownA = Request::create('/reviews/' . $unknownReviewIdA, 'GET');
        $resUnknownA = $kernel->handle($reqUnknownA);
        self::assertSame(404, $resUnknownA->getStatusCode());
        self::assertStringContainsString('Review not found.', (string) $resUnknownA->getContent());
        self::assertStringNotContainsString('legacy-corp', (string) $resUnknownA->getContent());
        $kernel->terminate($reqUnknownA, $resUnknownA);

        // Verify unknown visibility review B fails closed (404)
        $reqUnknownB = Request::create('/reviews/' . $unknownReviewIdB, 'GET');
        $resUnknownB = $kernel->handle($reqUnknownB);
        self::assertSame(404, $resUnknownB->getStatusCode());
        self::assertStringContainsString('Review not found.', (string) $resUnknownB->getContent());
        self::assertStringNotContainsString('internal-corp', (string) $resUnknownB->getContent());
        $kernel->terminate($reqUnknownB, $resUnknownB);

        // Verify public review succeeds (200)
        $reqPublic = Request::create('/reviews/' . $publicReviewId, 'GET');
        $resPublic = $kernel->handle($reqPublic);
        self::assertSame(200, $resPublic->getStatusCode());
        $data = json_decode((string) $resPublic->getContent(), true, 64, JSON_THROW_ON_ERROR);
        self::assertSame('public-org/open-project', $data['repository']);
        self::assertSame(1, $data['pull_number']);
        self::assertSame(str_repeat('1', 40), $data['head_sha']);
        self::assertSame('matches_saved_digest', $data['snapshot_integrity']);
        $kernel->terminate($reqPublic, $resPublic);
    }
}
