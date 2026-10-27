<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PullRequestSnapshot;

final class PullRequestSnapshotTest extends TestCase
{
    public function testMalformedSnapshotIsRejected(): void
    {
        $directory = sys_get_temp_dir().'/proofpatch-snapshot-'.bin2hex(random_bytes(8));
        mkdir($directory, 0700);
        $file = $directory.'/20261027T120000Z-aaaaaaaaaaaa.json';
        file_put_contents($file, '{');
        try {
            $this->expectException(\InvalidArgumentException::class);
            $this->expectExceptionMessage('Snapshot is missing or invalid.');
            (new PullRequestSnapshot($directory))->verify('20261027T120000Z-aaaaaaaaaaaa');
        } finally {
            unlink($file);
            rmdir($directory);
        }
    }

    public function testSnapshotRetainsObservedHeadAndDetectsTampering(): void
    {
        $directory = sys_get_temp_dir().'/proofpatch-snapshot-'.bin2hex(random_bytes(8));
        try {
            $store = new PullRequestSnapshot($directory);
            $result = $store->capture(['repository' => 'example/project', 'number' => 7, 'headSha' => str_repeat('a', 40),
                'checks' => [['name' => 'Tests', 'status' => 'completed', 'conclusion' => 'success']]]);
            self::assertSame('VALID', $store->verify($result['id'], $result['sha256'])['integrity']);
            self::assertSame('example/project', $store->load($result['id'])['snapshot']['pullRequest']['repository']);
            $path = $directory.'/'.$result['id'].'.json';
            self::assertSame(0, fileperms($path) & 0077);
            $data = json_decode(file_get_contents($path), true, 64, JSON_THROW_ON_ERROR);
            self::assertSame(str_repeat('a', 40), $data['snapshot']['pullRequest']['headSha']);
            $data['snapshot']['pullRequest']['checks'][0]['conclusion'] = 'failure';
            file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
            $this->expectException(\InvalidArgumentException::class);
            $store->verify($result['id'], $result['sha256']);
        } finally {
            foreach (glob($directory.'/*') ?: [] as $file) {
                unlink($file);
            }
            if (is_dir($directory)) {
                rmdir($directory);
            }
        }
    }
}
