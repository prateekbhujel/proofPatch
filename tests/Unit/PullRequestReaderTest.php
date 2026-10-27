<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PullRequestReader;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PullRequestReaderTest extends TestCase
{
    public function testReadsRealisticPullRequestFilesAndChecksAtTheExactHead(): void
    {
        $sha = str_repeat('a', 40);
        $urls = [];
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$urls, $sha): MockResponse {
            $urls[] = $url;
            self::assertSame('GET', $method);
            self::assertSame(0, $options['max_redirects']);
            if (str_contains($url, '/files?')) {
                $data = [['filename' => 'src/Checkout.php', 'status' => 'modified', 'additions' => 3, 'deletions' => 1]];
            } elseif (str_contains($url, '/check-runs?')) {
                self::assertStringContainsString('/commits/'.$sha.'/', $url);
                $data = ['total_count' => 1, 'check_runs' => [['name' => 'Tests', 'status' => 'completed', 'conclusion' => 'success']]];
            } else {
                $data = ['number' => 12, 'title' => 'Fix checkout', 'state' => 'open', 'changed_files' => 2,
                    'head' => ['sha' => $sha, 'ref' => 'fix'], 'base' => ['sha' => str_repeat('b', 40), 'ref' => 'main']];
            }
            return new MockResponse(json_encode($data, JSON_THROW_ON_ERROR));
        });
        $result = (new PullRequestReader($client))->read('https://github.com/example/project/pull/12');
        self::assertSame('example/project', $result['repository']);
        self::assertSame($sha, $result['headSha']);
        self::assertSame(str_repeat('b', 40), $result['baseSha']);
        self::assertTrue($result['filesTruncated']);
        self::assertSame('src/Checkout.php', $result['files'][0]['name']);
        self::assertSame('success', $result['checks'][0]['conclusion']);
        self::assertCount(4, $urls);

        // Test shorthand formats resolve identically
        self::assertSame('https://github.com/owner/repo/pull/123', PullRequestReader::normalizeUrl('owner/repo#123'));
        self::assertSame('https://github.com/owner/repo/pull/123', PullRequestReader::normalizeUrl('owner/repo/pull/123'));
        self::assertSame('https://github.com/owner/repo/pull/123', PullRequestReader::normalizeUrl('github.com/owner/repo/pull/123'));
        self::assertSame('https://github.com/owner/repo/pull/123', PullRequestReader::normalizeUrl('https://github.com/owner/repo/pull/123'));
    }

    public function testRejectsPullRequestOrBaseChangesDuringCapture(): void
    {
        foreach (['head', 'base'] as $changed) {
            $reads = 0;
            $client = new MockHttpClient(function (string $method, string $url) use (&$reads, $changed): MockResponse {
                if (str_contains($url, '/files?')) {
                    return new MockResponse('[]');
                }
                if (str_contains($url, '/check-runs?')) {
                    return new MockResponse('{"total_count":0,"check_runs":[]}');
                }
                ++$reads;
                $data = ['number' => 12, 'title' => 'Fix checkout', 'state' => 'open', 'changed_files' => 0,
                    'head' => ['sha' => str_repeat('a', 40), 'ref' => 'fix'],
                    'base' => ['sha' => str_repeat('b', 40), 'ref' => 'main']];
                if ($reads === 2) {
                    $data[$changed]['sha'] = str_repeat('c', 40);
                }
                return new MockResponse(json_encode($data, JSON_THROW_ON_ERROR));
            });
            try {
                (new PullRequestReader($client))->read('https://github.com/example/project/pull/12');
                self::fail('A moving pull request must not be captured.');
            } catch (\RuntimeException $error) {
                self::assertStringContainsString('changed while', $error->getMessage());
            }
        }
    }

    public function testRejectsNonGithubAndManipulatedUrlsBeforeNetworkAccess(): void
    {
        $calls = 0;
        $client = new MockHttpClient(function () use (&$calls): MockResponse { ++$calls; return new MockResponse('{}'); });
        foreach (['https://github.com.evil.test/a/b/pull/1', 'https://github.com/a/../pull/1',
            'https://github.com/a/b/pull/1?token=secret', 'http://github.com/a/b/pull/1'] as $url) {
            try {
                (new PullRequestReader($client))->read($url);
                self::fail('Invalid URL accepted.');
            } catch (\InvalidArgumentException) {
                self::assertSame(0, $calls);
            }
        }
    }

    public function testHttpFailureDoesNotExposeResponseContents(): void
    {
        $client = new MockHttpClient(fn() => new MockResponse('private details', ['http_code' => 404]));
        try {
            (new PullRequestReader($client))->read('https://github.com/a/b/pull/1');
            self::fail('HTTP failure accepted.');
        } catch (\RuntimeException $error) {
            self::assertStringContainsString('HTTP 404', $error->getMessage());
            self::assertStringNotContainsString('private details', $error->getMessage());
        }
    }
}
