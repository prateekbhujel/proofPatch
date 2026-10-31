<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PullRequestActions;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PullRequestActionsTest extends TestCase
{
    private const HEAD = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    private const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    private array $access = ['userId' => 7, 'repositories' => ['acme/app' => true]];
    private array $pull = ['repository' => 'acme/app', 'number' => 5, 'headSha' => self::HEAD];

    private function remote(array $overrides = []): MockResponse
    {
        return new MockResponse(json_encode(array_replace_recursive([
            'number' => 5, 'state' => 'open', 'merged' => false, 'draft' => false, 'mergeable' => true,
            'head' => ['sha' => self::HEAD],
        ], $overrides)));
    }

    public function testMergeSendsTheReviewedHeadAsAPrecondition(): void
    {
        $requests = [];
        $http = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests) {
            $requests[] = [$method, $url, $options['body'] ?? null];
            return $method === 'GET' ? $this->remote() : new MockResponse(json_encode(['merged' => true, 'sha' => self::OTHER]));
        });
        $result = (new PullRequestActions($http))->merge('tok', $this->access, $this->pull, self::HEAD);

        self::assertSame(['merged' => true, 'sha' => self::OTHER], $result);
        self::assertSame('PUT', $requests[1][0]);
        self::assertStringEndsWith('/repos/acme/app/pulls/5/merge', $requests[1][1]);
        self::assertSame(['sha' => self::HEAD, 'merge_method' => 'squash'], json_decode((string) $requests[1][2], true));
    }

    /** @return iterable<string, array{array, array, string, string}> */
    public static function refusedBeforeAnyNetworkCall(): iterable
    {
        $access = ['userId' => 7, 'repositories' => ['acme/app' => true]];
        $pull = ['repository' => 'acme/app', 'number' => 5, 'headSha' => self::HEAD];
        yield 'identity not verified' => [['userId' => null, 'repositories' => ['acme/app' => true]], $pull, self::HEAD, 'Connect GitHub'];
        yield 'repository not installed' => [['userId' => 7, 'repositories' => ['other/repo' => true]], $pull, self::HEAD, 'not in your GitHub App installation'];
        yield 'revision differs from what was reviewed' => [$access, $pull, self::OTHER, 'does not match'];
        yield 'malformed revision' => [$access, $pull, 'main', 'does not match'];
        yield 'no pull request loaded' => [$access, ['repository' => 'acme/app'], self::HEAD, 'Select a pull request'];
    }

    #[DataProvider('refusedBeforeAnyNetworkCall')]
    public function testRefusesWithoutAuthorityOrExactRevision(array $access, array $pull, string $head, string $message): void
    {
        $calls = 0;
        $http = new MockHttpClient(function () use (&$calls) { $calls++; return new MockResponse('{}'); });
        foreach (['merge', 'close'] as $action) {
            try {
                (new PullRequestActions($http))->{$action}('tok', $access, $pull, $head);
                self::fail("{$action} should have been refused");
            } catch (\RuntimeException $e) {
                self::assertStringContainsString($message, $e->getMessage());
            }
        }
        self::assertSame(0, $calls);
    }

    /** @return iterable<string, array{array, string}> */
    public static function remoteStatesThatBlockMerge(): iterable
    {
        yield 'draft' => [['draft' => true], 'still a draft'];
        yield 'already merged' => [['merged' => true, 'state' => 'closed'], 'already merged'];
        yield 'closed' => [['state' => 'closed'], 'not open'];
        yield 'branch moved' => [['head' => ['sha' => self::OTHER]], 'branch changed'];
        yield 'conflicts' => [['mergeable' => false], 'merge conflicts'];
    }

    #[DataProvider('remoteStatesThatBlockMerge')]
    public function testDoesNotMergeWhenGitHubStateDisagrees(array $state, string $message): void
    {
        $writes = 0;
        $http = new MockHttpClient(function (string $method) use (&$writes, $state) {
            if ($method !== 'GET') { $writes++; }
            return $this->remote($state);
        });
        $this->expectExceptionMessage($message);
        try {
            (new PullRequestActions($http))->merge('tok', $this->access, $this->pull, self::HEAD);
        } finally {
            self::assertSame(0, $writes);
        }
    }

    public function testRaceBetweenCheckAndMergeIsRejectedByGitHub(): void
    {
        $http = new MockHttpClient([$this->remote(), new MockResponse(json_encode(['message' => 'Head branch was modified']), ['http_code' => 409])]);
        $this->expectExceptionMessage('branch changed after you reviewed it');
        (new PullRequestActions($http))->merge('tok', $this->access, $this->pull, self::HEAD);
    }

    public function testInterruptedMergeIsUnknownAndNotRetried(): void
    {
        $writes = 0;
        $http = new MockHttpClient(function (string $method) use (&$writes) {
            if ($method === 'GET') { return $this->remote(); }
            $writes++;
            throw new TransportException('connection reset');
        });
        try {
            (new PullRequestActions($http))->merge('tok', $this->access, $this->pull, self::HEAD);
            self::fail('expected unknown outcome');
        } catch (\RuntimeException $e) {
            self::assertStringContainsString('outcome is unknown', $e->getMessage());
        }
        self::assertSame(1, $writes);
    }

    public function testGitHubRefusalIsReportedNotClaimedAsMerged(): void
    {
        $http = new MockHttpClient([$this->remote(), new MockResponse(json_encode(['message' => 'Required status check is failing']), ['http_code' => 405])]);
        $this->expectExceptionMessage('Required status check is failing');
        (new PullRequestActions($http))->merge('tok', $this->access, $this->pull, self::HEAD);
    }

    public function testCloseRequiresTheReviewedHeadAndConfirmsState(): void
    {
        $http = new MockHttpClient([$this->remote(), new MockResponse(json_encode(['state' => 'closed']))]);
        self::assertSame(['state' => 'closed'], (new PullRequestActions($http))->close('tok', $this->access, $this->pull, self::HEAD));

        $moved = new MockHttpClient([$this->remote(['head' => ['sha' => self::OTHER]])]);
        $this->expectExceptionMessage('branch changed');
        (new PullRequestActions($moved))->close('tok', $this->access, $this->pull, self::HEAD);
    }

    public function testTokenEchoedByUpstreamIsNotSurfaced(): void
    {
        $http = new MockHttpClient([new MockResponse('{"echo":"secret-token"}')]);
        try {
            (new PullRequestActions($http))->merge('secret-token', $this->access, $this->pull, self::HEAD);
            self::fail('expected refusal');
        } catch (\RuntimeException $e) {
            self::assertStringNotContainsString('secret-token', $e->getMessage());
        }
    }
}
