<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PublicPatchPreview;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PublicPatchPreviewTest extends TestCase
{
    private function captured(): array
    {
        return ['repository' => 'example/project', 'number' => 12,
            'headSha' => str_repeat('a', 40), 'baseSha' => str_repeat('b', 40)];
    }

    private function pull(int $count = 1): array
    {
        return ['number' => 12, 'head' => ['sha' => str_repeat('a', 40)],
            'base' => ['sha' => str_repeat('b', 40)], 'changed_files' => $count];
    }

    private function repo(): array
    {
        return ['full_name' => 'example/project', 'private' => false, 'visibility' => 'public'];
    }

    private function client(array $responses, array &$requests): MockHttpClient
    {
        return new MockHttpClient(function (string $method, string $url, array $options) use (&$responses, &$requests): MockResponse {
            $requests[] = [$method, $url, $options];
            self::assertSame('GET', $method);
            self::assertStringStartsWith('https://api.github.com/repos/example/project', $url);
            self::assertSame(0, $options['max_redirects']);
            foreach ($options['normalized_headers'] ?? [] as $name => $value) {
                self::assertNotSame('authorization', strtolower($name));
            }
            self::assertStringNotContainsString('Authorization:', implode(' ', $options['headers'] ?? []));
            if ($responses === []) self::fail('Unexpected extra request.');
            return new MockResponse(json_encode(array_shift($responses), JSON_THROW_ON_ERROR));
        });
    }

    public function testPreviewIsUnauthenticatedBoundedAndLabelsIncompleteData(): void
    {
        $files = [
            ['filename' => 'src/a.php', 'additions' => 1, 'deletions' => 1, 'patch' => "@@ -1 +1 @@\n-old\n+new"],
            ['filename' => 'image.bin', 'additions' => 0, 'deletions' => 0],
            ['filename' => 'large.txt', 'additions' => 1, 'deletions' => 0, 'patch' => '+'.str_repeat('x', 16384)],
            ['filename' => 'partial.txt', 'additions' => 2, 'deletions' => 0, 'patch' => "@@ -0,0 +1,2 @@\n+one"],
        ];
        $requests = [];
        $preview = (new PublicPatchPreview($this->client([$this->repo(), $this->pull(5), $files, $this->pull(5), $this->repo()], $requests)))->fetch($this->captured());
        self::assertCount(5, $requests);
        self::assertSame(['available', 'missing', 'oversize', 'partial'], array_column($preview['files'], 'status'));
        self::assertSame("@@ -1 +1 @@\n-old\n+new", $preview['files'][0]['patch']);
        self::assertNull($preview['files'][2]['patch']);
        self::assertTrue($preview['filesTruncated']);
        self::assertSame($this->captured()['headSha'], $preview['headSha']);
    }

    public function testPrivateOrUnverifiedRepositoryFailsBeforePatchFetch(): void
    {
        foreach ([['full_name' => 'example/project', 'private' => true, 'visibility' => 'private'],
            ['full_name' => 'example/project', 'private' => false], ['full_name' => 'other/project', 'private' => false, 'visibility' => 'public']] as $repo) {
            $requests = [];
            try {
                (new PublicPatchPreview($this->client([$repo], $requests)))->fetch($this->captured());
                self::fail('Unverified public visibility was accepted.');
            } catch (\RuntimeException) {
                self::assertCount(1, $requests);
            }
        }
    }

    public function testChangedHeadOrBaseNeverProducesPreview(): void
    {
        foreach (['head', 'base'] as $which) {
            $changed = $this->pull();
            $changed[$which]['sha'] = str_repeat('c', 40);
            foreach ([$changed, $this->pull()] as $first) {
                $requests = [];
                $responses = [$this->repo(), $first];
                if ($first === $this->pull()) {
                    $responses[] = [['filename' => 'a', 'additions' => 0, 'deletions' => 0]];
                    $responses[] = $changed;
                }
                try {
                    (new PublicPatchPreview($this->client($responses, $requests)))->fetch($this->captured());
                    self::fail('Stale pull request was accepted.');
                } catch (\RuntimeException) {
                    self::assertCount($first === $changed ? 2 : 4, $requests);
                }
            }
        }
    }

    public function testVisibilityChangeAfterFetchFailsClosed(): void
    {
        $requests = [];
        $private = ['full_name' => 'example/project', 'private' => true, 'visibility' => 'private'];
        $this->expectException(\RuntimeException::class);
        (new PublicPatchPreview($this->client([$this->repo(), $this->pull(0), [], $this->pull(0), $private], $requests)))->fetch($this->captured());
    }

    public function testCapturedChangedFileCountMustStillMatch(): void
    {
        $requests = [];
        $captured = $this->captured();
        $captured['changedFiles'] = 2;
        try {
            (new PublicPatchPreview($this->client([$this->repo(), $this->pull(1)], $requests)))->fetch($captured);
            self::fail('A changed file count was accepted.');
        } catch (\RuntimeException) {
            self::assertCount(2, $requests);
        }
    }

    public function testInvalidSnapshotIsRejectedBeforeNetwork(): void
    {
        $requests = [];
        $this->expectException(\InvalidArgumentException::class);
        (new PublicPatchPreview($this->client([], $requests)))->fetch(['repository' => 'example/../evil']);
    }
}
