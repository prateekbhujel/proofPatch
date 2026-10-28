<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\SingleUseReviewApproval;
use ProofPatch\Http\Controllers\DashboardController;
use ProofPatch\GitHub\PullRequestSnapshot;

final class ReviewReplayAndConcurrencyIntegrationTest extends TestCase
{
    private string $tempDir;
    private string $approvalsDir;
    private string $snapshotsDir;

    protected function setUp(): void
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        $this->tempDir = sys_get_temp_dir().'/proofpatch_replay_test_'.bin2hex(random_bytes(6));
        $this->approvalsDir = $this->tempDir.'/approvals';
        $this->snapshotsDir = $this->tempDir.'/snapshots';
        @mkdir($this->approvalsDir, 0755, true);
        @mkdir($this->snapshotsDir, 0755, true);

        putenv('PROOFPATCH_APPROVALS_DIR='.$this->approvalsDir);
        putenv('PROOFPATCH_SNAPSHOT_DIR='.$this->snapshotsDir);

        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        putenv('PROOFPATCH_APPROVALS_DIR');
        putenv('PROOFPATCH_SNAPSHOT_DIR');

        if (is_dir($this->tempDir)) {
            foreach (glob($this->tempDir.'/*/*') ?: [] as $file) {
                @unlink($file);
            }
            foreach (glob($this->tempDir.'/*') ?: [] as $dir) {
                @rmdir($dir);
            }
            @rmdir($this->tempDir);
        }
        $_SESSION = [];

        @restore_error_handler();
        @restore_exception_handler();
    }

    private function loadPortableReviewSnapshot(): array
    {
        $headSha = str_repeat('a', 40);
        $baseSha = str_repeat('b', 40);
        $pull = [
            'repository' => 'prateekbhujel/proofpatch-sandbox',
            'number' => 1,
            'title' => 'feat: improve checkout state synchronization',
            'state' => 'open',
            'base' => 'main',
            'head' => 'feat/state-sync',
            'headSha' => $headSha,
            'baseSha' => $baseSha,
            'isPrivate' => false,
            'changedFiles' => 2,
            'files' => [
                ['name' => 'src/ComponentHook.php', 'status' => 'modified', 'additions' => 1, 'deletions' => 1],
                ['name' => 'src/Features/SupportLifecycleHooks/SupportLifecycleHooks.php', 'status' => 'added', 'additions' => 2, 'deletions' => 0],
            ],
            'url' => 'https://github.com/prateekbhujel/proofpatch-sandbox/pull/1',
        ];

        $store = new PullRequestSnapshot($this->snapshotsDir);
        $snapshot = $store->capture($pull);

        $patchPreview = [
            'repository' => $pull['repository'],
            'number' => $pull['number'],
            'headSha' => $pull['headSha'],
            'baseSha' => $pull['baseSha'],
            'isPrivate' => false,
            'changedFiles' => 2,
            'filesTruncated' => false,
            'files' => [
                [
                    'name' => 'src/ComponentHook.php',
                    'status' => 'available',
                    'patch' => "@@ -24,3 +24,3 @@\n     function callHydrate(...params) {}\n     function callUpdate() {\n-        \$callbacks = null;\n+        \$callbacks = [];\n",
                ],
                [
                    'name' => 'src/Features/SupportLifecycleHooks/SupportLifecycleHooks.php',
                    'status' => 'available',
                    'patch' => "@@ -10,1 +10,2 @@\n     protected \$ready = true;\n+    protected \$hookCache = [];\n",
                ],
            ],
        ];

        @file_put_contents($this->snapshotsDir.'/'.$snapshot['id'].'-preview.json', json_encode($patchPreview, JSON_PRETTY_PRINT));

        $_SESSION['pullRequest'] = $pull;
        $_SESSION['pullRequestSnapshot'] = $snapshot;
        $_SESSION['patch_preview'] = $patchPreview;

        return [$pull, $snapshot];
    }

    public function testReviewControllerRejectsReplayOfConsumedApprovalToken(): void
    {
        [$pull, $snapshot] = $this->loadPortableReviewSnapshot();

        // 1. Visit repositories with preview=1 to generate preview and issue server-held approval
        $controller = new DashboardController();
        $previewRequest = Request::create('/repositories', 'GET', ['snapshot' => $snapshot['id'], 'preview' => '1']);
        $controller->repositories($previewRequest);

        $approvalToken = $_SESSION['review_approval_token'] ?? null;
        self::assertNotNull($approvalToken, 'Server must issue an approval token upon preview.');
        self::assertSame(64, strlen($approvalToken));

        // 2. Consume the token manually to simulate the first request having consumed it
        $approvalStore = new SingleUseReviewApproval($this->approvalsDir);
        // Find the record to get digest
        $tokenFile = $this->approvalsDir.'/'.$approvalToken.'.json';
        self::assertFileExists($tokenFile);
        $record = json_decode((string) file_get_contents($tokenFile), true);
        $digest = $record['digest'];

        // Request 1 consumes the token
        $approvalStore->consume($approvalToken, $pull['repository'], $pull['number'], $pull['headSha'], $digest);

        // 3. Request 2 (Replay / Duplicate POST): Send POST /repositories/review with the already-consumed token
        $replayRequest = Request::create('/repositories/review', 'POST', [
            'confirm' => '1',
            'digest' => $digest,
            'approval_token' => $approvalToken,
        ]);

        $response = $controller->reviewPullRequest($replayRequest);

        // Must redirect back with review_error indicating replay rejection
        self::assertSame(302, $response->getStatusCode());
        self::assertStringContainsString('/repositories?preview=1', $response->headers->get('Location') ?? '');

        $reviewError = session('review_error');
        self::assertNotNull($reviewError, 'Replayed review request must produce a review_error session message.');
        self::assertStringContainsString('already been consumed', $reviewError);
    }

    public function testReviewControllerRejectsMissingOrTamperedApprovalToken(): void
    {
        [$pull, $snapshot] = $this->loadPortableReviewSnapshot();
        $controller = new DashboardController();

        // 1. Missing approval token
        $missingTokenRequest = Request::create('/repositories/review', 'POST', [
            'confirm' => '1',
            'digest' => '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c',
        ]);
        $controller->reviewPullRequest($missingTokenRequest);
        self::assertStringContainsString('valid server-held approval token is required', session('review_error') ?? '');

        // 2. Tampered / non-existent approval token
        $fakeTokenRequest = Request::create('/repositories/review', 'POST', [
            'confirm' => '1',
            'digest' => '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c',
            'approval_token' => '0000000000000000000000000000000000000000000000000000000000000000',
        ]);
        $controller->reviewPullRequest($fakeTokenRequest);
        self::assertStringContainsString('invalid, expired, or not found', session('review_error') ?? '');
    }

    public function testDraftCommentRejectsPositiveLineNumberOutsideDiffHunk(): void
    {
        [$pull, $snapshot] = $this->loadPortableReviewSnapshot();
        $controller = new DashboardController();

        // Line 999 is positive, but outside the captured hunks of ComponentHook.php
        $invalidDraftRequest = Request::create('/repositories/review/draft', 'POST', [
            'path' => 'src/ComponentHook.php',
            'line' => 999,
            'side' => 'RIGHT',
            'headSha' => $pull['headSha'],
            'comment' => 'This is a comment on a line not in the diff.',
        ]);

        $response = $controller->saveDraftComment($invalidDraftRequest);
        self::assertSame(302, $response->getStatusCode());

        $error = session('review_error');
        self::assertNotNull($error);
        self::assertStringContainsString('Line 999 is not commentable on RIGHT side', $error);
        self::assertStringContainsString('outside the captured diff hunks', $error);

        // Draft must NOT have been saved
        self::assertEmpty($_SESSION['review_drafts'] ?? []);
    }

    public function testDraftCommentAcceptsValidLineAnchorWithinDiffHunk(): void
    {
        [$pull, $snapshot] = $this->loadPortableReviewSnapshot();
        $controller = new DashboardController();

        // In ComponentHook.php patch: @@ -24,63 +24,43 @@
        // Line 26 is an added line: $callbacks = [];
        $validDraftRequest = Request::create('/repositories/review/draft', 'POST', [
            'path' => 'src/ComponentHook.php',
            'line' => 26,
            'side' => 'RIGHT',
            'headSha' => $pull['headSha'],
            'comment' => 'Ensure callbacks array is initialized properly.',
        ]);

        $response = $controller->saveDraftComment($validDraftRequest);
        self::assertSame(302, $response->getStatusCode());
        self::assertNull(session('review_error'));

        // Draft MUST be saved with valid commentable metadata
        self::assertNotEmpty($_SESSION['review_drafts'] ?? []);
        $savedDraft = array_values($_SESSION['review_drafts'])[0];
        self::assertSame('src/ComponentHook.php', $savedDraft['path']);
        self::assertSame(26, $savedDraft['line']);
        self::assertSame('RIGHT', $savedDraft['side']);
        self::assertTrue($savedDraft['commentable']);
        self::assertSame('anchored', $savedDraft['status']);
        self::assertSame('addition', $savedDraft['lineType']);
    }

    public function testDraftCommentRejectsStaleHeadCommit(): void
    {
        [$pull, $snapshot] = $this->loadPortableReviewSnapshot();
        $controller = new DashboardController();

        $staleHeadRequest = Request::create('/repositories/review/draft', 'POST', [
            'path' => 'src/ComponentHook.php',
            'line' => 27,
            'side' => 'RIGHT',
            'headSha' => 'ffffffffffffffffffffffffffffffffffffffff', // Stale head SHA
            'comment' => 'Comment on an outdated revision.',
        ]);

        $response = $controller->saveDraftComment($staleHeadRequest);
        self::assertSame(302, $response->getStatusCode());

        $error = session('review_error');
        self::assertNotNull($error);
        self::assertStringContainsString('draft head SHA does not match current captured head SHA', $error);
    }
}
