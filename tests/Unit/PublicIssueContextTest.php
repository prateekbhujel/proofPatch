<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PublicIssueContext;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PublicIssueContextTest extends TestCase
{
    private function repo(): array { return ['full_name' => 'example/project', 'private' => false, 'visibility' => 'public', 'default_branch' => 'main']; }
    private function commit(string $char = 'a'): array { return ['sha' => str_repeat($char, 40)]; }
    private function issue(): array { return ['number' => 12, 'title' => 'Fix problem', 'body' => 'The example is broken.']; }
    private function file(string $source = 'const value = 1;'): array { return ['type' => 'file', 'path' => 'src/file.js', 'encoding' => 'base64', 'size' => strlen($source), 'content' => base64_encode($source)]; }

    private function client(array $data, array &$calls): MockHttpClient
    {
        return new MockHttpClient(function (string $method, string $url, array $options) use (&$data, &$calls): MockResponse {
            $calls[] = $url;
            self::assertSame('GET', $method);
            self::assertStringStartsWith('https://api.github.com/repos/example/project', $url);
            self::assertSame(0, $options['max_redirects']);
            self::assertStringNotContainsString('Authorization:', implode(' ', $options['headers'] ?? []));
            if ($data === []) self::fail('Unexpected request.');
            return new MockResponse(json_encode(array_shift($data), JSON_THROW_ON_ERROR));
        });
    }

    public function testCapturesPublicIssueAndSelectedFileAtStableCommit(): void
    {
        $calls = [];
        $context = (new PublicIssueContext($this->client([$this->repo(), $this->commit(), $this->issue(), $this->file(), $this->repo(), $this->commit()], $calls)))
            ->fetch('https://github.com/example/project/issues/12', 'src/file.js');
        self::assertCount(6, $calls);
        self::assertStringContainsString('ref='.str_repeat('a', 40), $calls[3]);
        self::assertSame('const value = 1;', $context['source']);
        self::assertSame(hash('sha256', $context['source']), $context['sourceSha256']);
        self::assertSame(str_repeat('a', 40), $context['commit']);
    }

    public function testPrivateRepoIsRejectedBeforeIssueOrFileIsFetched(): void
    {
        $calls = [];
        $repo = $this->repo();
        $repo['private'] = true;
        try {
            (new PublicIssueContext($this->client([$repo], $calls)))->fetch('https://github.com/example/project/issues/12', 'src/file.js');
            self::fail('Private repository accepted.');
        } catch (\RuntimeException) {
            self::assertCount(1, $calls);
        }
    }

    public function testChangedBranchCommitIsRejected(): void
    {
        $calls = [];
        $this->expectException(\RuntimeException::class);
        (new PublicIssueContext($this->client([$this->repo(), $this->commit(), $this->issue(), $this->file(), $this->repo(), $this->commit('b')], $calls)))
            ->fetch('https://github.com/example/project/issues/12', 'src/file.js');
    }

    public function testHiddenPathAndPullRequestIssueAreRejected(): void
    {
        $calls = [];
        try {
            (new PublicIssueContext($this->client([], $calls)))->fetch('https://github.com/example/project/issues/12', '../.env');
            self::fail('Invalid path accepted.');
        } catch (\InvalidArgumentException) { self::assertCount(0, $calls); }
        $issue = $this->issue();
        $issue['pull_request'] = [];
        $this->expectException(\RuntimeException::class);
        (new PublicIssueContext($this->client([$this->repo(), $this->commit(), $issue], $calls)))
            ->fetch('https://github.com/example/project/issues/12', 'src/file.js');
    }

    public function testCommonCredentialInPublicFileIsRejected(): void
    {
        $calls = [];
        $file = $this->file('-----BEGIN PRIVATE KEY-----');
        $this->expectException(\InvalidArgumentException::class);
        (new PublicIssueContext($this->client([$this->repo(), $this->commit(), $this->issue(), $file, $this->repo(), $this->commit()], $calls)))
            ->fetch('https://github.com/example/project/issues/12', 'src/file.js');
    }
}
