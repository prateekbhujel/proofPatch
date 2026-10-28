<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\SingleUseReviewApproval;

final class SingleUseReviewApprovalTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir().'/proofpatch_approval_test_'.bin2hex(random_bytes(6));
    }

    protected function tearDown(): void
    {
        if (is_dir($this->tempDir)) {
            foreach (glob($this->tempDir.'/*') ?: [] as $file) {
                @unlink($file);
            }
            @rmdir($this->tempDir);
        }
    }

    public function testIssueGeneratesCryptographicTokenBoundToContext(): void
    {
        $store = new SingleUseReviewApproval($this->tempDir, 1800);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';

        $approval = $store->issue($repo, $pr, $head, $digest);

        self::assertSame(64, strlen($approval['token']));
        self::assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $approval['token']);
        self::assertSame($repo, $approval['repository']);
        self::assertSame($pr, $approval['pullNumber']);
        self::assertSame($head, $approval['headSha']);
        self::assertSame($digest, $approval['digest']);
        self::assertFalse($approval['consumed']);
        self::assertGreaterThanOrEqual(time(), $approval['createdAt']);
        self::assertSame($approval['createdAt'] + 1800, $approval['expiresAt']);

        // Check file exists with 0600 permissions
        $tokenFile = $this->tempDir.'/'.$approval['token'].'.json';
        self::assertFileExists($tokenFile);
        $perms = fileperms($tokenFile) & 0777;
        self::assertSame(0600, $perms);
    }

    public function testConsumeAtomicallyValidatesAndMarksConsumed(): void
    {
        $store = new SingleUseReviewApproval($this->tempDir, 1800);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';

        $issued = $store->issue($repo, $pr, $head, $digest);
        $consumed = $store->consume($issued['token'], $repo, $pr, $head, $digest);

        self::assertTrue($consumed['consumed']);
        self::assertNotEmpty($consumed['consumedAt']);
    }

    public function testReplayConsumptionFailsClosed(): void
    {
        $store = new SingleUseReviewApproval($this->tempDir, 1800);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';

        $issued = $store->issue($repo, $pr, $head, $digest);

        // First consumption succeeds
        $first = $store->consume($issued['token'], $repo, $pr, $head, $digest);
        self::assertTrue($first['consumed']);

        // Second consumption (replay attack / duplicate submission) must fail closed
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('This review approval token has already been consumed. Replays and duplicate requests are strictly rejected.');

        $store->consume($issued['token'], $repo, $pr, $head, $digest);
    }

    public function testTamperedDigestFailsClosed(): void
    {
        $store = new SingleUseReviewApproval($this->tempDir, 1800);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';
        $tamperedDigest = '0000000000000000000000000000000000000000000000000000000000000000';

        $issued = $store->issue($repo, $pr, $head, $digest);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Approval token digest does not match reviewed payload digest.');

        $store->consume($issued['token'], $repo, $pr, $head, $tamperedDigest);
    }

    public function testTamperedHeadShaFailsClosed(): void
    {
        $store = new SingleUseReviewApproval($this->tempDir, 1800);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $staleHead = 'ffffffffffffffffffffffffffffffffffffffff';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';

        $issued = $store->issue($repo, $pr, $head, $digest);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Approval token head SHA does not match current pull request head.');

        $store->consume($issued['token'], $repo, $pr, $staleHead, $digest);
    }

    public function testExpiredTokenFailsClosed(): void
    {
        // 1-second TTL
        $store = new SingleUseReviewApproval($this->tempDir, 1);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';

        $issued = $store->issue($repo, $pr, $head, $digest);

        sleep(2); // Wait for expiration

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('This review approval token has expired.');

        $store->consume($issued['token'], $repo, $pr, $head, $digest);
    }

    public function testConcurrentProcessesEnforceSingleWinner(): void
    {
        $store = new SingleUseReviewApproval($this->tempDir, 1800);
        $repo = 'livewire/livewire';
        $pr = 10797;
        $head = '09b3bbab0123456789abcdef0123456789abcdef';
        $digest = '7ce07ab01e95548d2d66994b43aa6d88d816a971ba1026ff79b8f4f6295ac87c';

        $issued = $store->issue($repo, $pr, $head, $digest);
        $token = $issued['token'];
        $tempDir = escapeshellarg($this->tempDir);
        $autoload = escapeshellarg(dirname(__DIR__, 2).'/vendor/autoload.php');

        // Launch two background PHP processes simultaneously trying to consume the same approval
        $script = <<<PHP
require {$autoload};
\$store = new \ProofPatch\Agent\SingleUseReviewApproval({$tempDir}, 1800);
try {
    \$store->consume('{$token}', '{$repo}', {$pr}, '{$head}', '{$digest}');
    echo 'SUCCESS\n';
} catch (\Throwable \$e) {
    echo 'FAILED: ' . \$e->getMessage() . '\n';
}
PHP;

        $cmd1 = 'php -r '.escapeshellarg($script);
        $cmd2 = 'php -r '.escapeshellarg($script);

        $p1 = popen($cmd1, 'r');
        $p2 = popen($cmd2, 'r');

        $out1 = $p1 !== false ? trim((string) stream_get_contents($p1)) : '';
        $out2 = $p2 !== false ? trim((string) stream_get_contents($p2)) : '';

        if ($p1 !== false) {
            pclose($p1);
        }
        if ($p2 !== false) {
            pclose($p2);
        }

        $outputs = [$out1, $out2];
        $successCount = count(array_filter($outputs, static fn($o) => $o === 'SUCCESS'));
        $failCount = count(array_filter($outputs, static fn($o) => str_starts_with($o, 'FAILED:')));

        // Exactly ONE process must succeed, and the other MUST fail closed
        self::assertSame(1, $successCount, "Expected exactly 1 SUCCESS, got: ".json_encode($outputs));
        self::assertSame(1, $failCount, "Expected exactly 1 FAILED, got: ".json_encode($outputs));
        self::assertStringContainsString('already been consumed', implode(' ', $outputs));
    }
}
