<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\ManualInlineCommentPublisher;
use ProofPatch\Http\Controllers\ManualInlineCommentController;
use ProofPatch\Tests\Support\InteractsWithIsolatedDatabase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class ManualInlineCommentPublisherTest extends TestCase
{
    use InteractsWithIsolatedDatabase;

    private string|false $previousRepo;
    private array $pull;
    private array $draft;
    private int $posts;
    private bool $changedHead;
    private bool $revoked;
    private bool $uncertain;
    private bool $changeOnFinalRead;
    private int $pullReads;

    protected function setUp(): void
    {
        $this->setupIsolatedDatabase();
        $this->bootstrapAndMigrateIsolatedDatabase();
        $this->previousRepo = getenv('PROOFPATCH_TEST_REPO');
        putenv('PROOFPATCH_TEST_REPO=owner/test-repo');
        $this->pull = ['repository' => 'owner/test-repo', 'number' => 7, 'headSha' => str_repeat('a', 40), 'baseSha' => str_repeat('b', 40)];
        $this->draft = ['path' => 'src/example.php', 'line' => 3, 'side' => 'RIGHT', 'comment' => 'Please check this.', 'headSha' => str_repeat('a', 40)];
        $this->posts = 0;
        $this->changedHead = false;
        $this->revoked = false;
        $this->uncertain = false;
        $this->changeOnFinalRead = false;
        $this->pullReads = 0;
    }

    protected function tearDown(): void
    {
        $this->previousRepo === false ? putenv('PROOFPATCH_TEST_REPO') : putenv('PROOFPATCH_TEST_REPO='.$this->previousRepo);
        $this->teardownIsolatedDatabase();
        @restore_error_handler();
        @restore_exception_handler();
    }

    private function publisher(): ManualInlineCommentPublisher
    {
        $http = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            if ($method === 'POST') {
                ++$this->posts;
                $body = json_decode($options['body'], true, 16, JSON_THROW_ON_ERROR);
                self::assertSame(['body' => 'Please check this.', 'commit_id' => str_repeat('a', 40), 'path' => 'src/example.php', 'line' => 3, 'side' => 'RIGHT'], $body);
                if ($this->uncertain) throw new \RuntimeException('Connection lost');
                return new MockResponse(json_encode(['id' => 42]), ['http_code' => 201]);
            }
            $path = parse_url($url, PHP_URL_PATH);
            if ($path === '/user') return new MockResponse(json_encode(['id' => 10, 'login' => 'owner']));
            if ($path === '/user/installations') return new MockResponse(json_encode(['installations' => $this->revoked ? [] : [['id' => 50]]]));
            if ($path === '/user/installations/50/repositories') return new MockResponse(json_encode(['repositories' => [['id' => 1, 'full_name' => 'owner/test-repo', 'name' => 'test-repo', 'owner' => ['login' => 'owner'], 'private' => true]]]));
            if ($path === '/repos/owner/test-repo/pulls/7/files') return new MockResponse(json_encode([['filename' => 'src/example.php', 'patch' => "@@ -1,2 +1,3 @@\n one\n two\n+three"]]));
            if ($path === '/repos/owner/test-repo/pulls/7') {
                ++$this->pullReads;
                $changed = $this->changedHead || ($this->changeOnFinalRead && $this->pullReads === 2);
                return new MockResponse(json_encode([
                    'number' => 7, 'state' => 'open', 'head' => ['sha' => str_repeat($changed ? 'c' : 'a', 40)],
                    'base' => ['sha' => str_repeat('b', 40)], 'changed_files' => 1,
                ]));
            }
            throw new \RuntimeException('Unexpected request');
        });
        return new ManualInlineCommentPublisher($http);
    }

    private function digest(): string
    {
        return ManualInlineCommentPublisher::digest(10, $this->pull['repository'], 7, $this->pull['headSha'], $this->pull['baseSha'], $this->draft);
    }

    public function testManualPostUsesApprovedLineAndCannotBeRepeated(): void
    {
        $publisher = $this->publisher();
        $result = $publisher->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
        self::assertSame(42, $result['id']);
        self::assertSame('https://github.com/owner/test-repo/pull/7#discussion_r42', $result['url']);
        self::assertSame('posted', DB::table('inline_comment_attempts')->value('status'));
        try {
            $publisher->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
            self::fail('Expected duplicate request to fail');
        } catch (\RuntimeException $e) {
            self::assertStringContainsString('already attempted', $e->getMessage());
        }
        self::assertSame(1, $this->posts);
    }

    public function testRevokedGrantAndChangedHeadCannotPost(): void
    {
        foreach (['revoked', 'changedHead'] as $condition) {
            $this->$condition = true;
            try {
                $this->publisher()->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
                self::fail('Expected request to fail closed');
            } catch (\RuntimeException) {}
            self::assertSame(0, $this->posts);
            self::assertSame(0, DB::table('inline_comment_attempts')->count());
            $this->$condition = false;
        }
    }

    public function testUnapprovedOrInvalidLineCannotPost(): void
    {
        $digest = $this->digest();
        $this->draft['comment'] = 'Changed after approval';
        try {
            $this->publisher()->publish('mock-token', 10, $this->pull, $this->draft, $digest);
            self::fail('Expected stale approval to fail');
        } catch (\InvalidArgumentException) {}
        $this->draft['line'] = 99;
        try {
            $this->publisher()->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
            self::fail('Expected invalid anchor to fail');
        } catch (\RuntimeException) {}
        self::assertSame(0, $this->posts);
    }

    public function testUncertainOutcomeCannotBeAutomaticallyRetried(): void
    {
        $this->uncertain = true;
        $publisher = $this->publisher();
        for ($attempt = 0; $attempt < 2; ++$attempt) {
            try {
                $publisher->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
                self::fail('Expected request to fail');
            } catch (\RuntimeException) {}
        }
        self::assertSame(1, $this->posts);
        self::assertSame('uncertain', DB::table('inline_comment_attempts')->value('status'));
    }

    public function testFinalHeadCheckRejectsRevisionChangedDuringFileFetch(): void
    {
        $this->changeOnFinalRead = true;
        try {
            $this->publisher()->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
            self::fail('Expected stale revision to fail');
        } catch (\RuntimeException) {}
        self::assertSame(2, $this->pullReads);
        self::assertSame(0, $this->posts);
        self::assertSame(0, DB::table('inline_comment_attempts')->count());
    }

    public function testOtherRepositoryAndIdentityAreRejected(): void
    {
        $this->pull['repository'] = 'other/repository';
        try {
            $this->publisher()->publish('mock-token', 10, $this->pull, $this->draft, $this->digest());
            self::fail('Expected other repository to fail');
        } catch (\InvalidArgumentException) {}
        $this->pull['repository'] = 'owner/test-repo';
        $otherUserDigest = ManualInlineCommentPublisher::digest(11, $this->pull['repository'], 7, $this->pull['headSha'], $this->pull['baseSha'], $this->draft);
        try {
            $this->publisher()->publish('mock-token', 11, $this->pull, $this->draft, $otherUserDigest);
            self::fail('Expected other user to fail');
        } catch (\RuntimeException) {}
        self::assertSame(0, $this->posts);
    }

    public function testControllerRequiresExplicitApprovalAndKeepsDraftUntilSuccess(): void
    {
        $session = app('session')->driver('array');
        $session->put('github_auth', ['token' => 'mock-token']);
        $session->put('pullRequest', $this->pull);
        $session->put('review_drafts', ['draft-1' => $this->draft]);
        app('redirect')->setSession($session);
        $controller = new ManualInlineCommentController($this->publisher());

        $denied = Request::create('/repositories/review/comment', 'POST', ['id' => 'draft-1', 'digest' => $this->digest()]);
        $denied->setLaravelSession($session);
        $denied->attributes->set('proofpatch_github_access', ['userId' => 10]);
        $controller->store($denied);
        self::assertSame(0, $this->posts);
        self::assertArrayHasKey('draft-1', $session->get('review_drafts'));

        $allowed = Request::create('/repositories/review/comment', 'POST', ['id' => 'draft-1', 'digest' => $this->digest(), 'approved' => true]);
        $allowed->setLaravelSession($session);
        $allowed->attributes->set('proofpatch_github_access', ['userId' => 10]);
        $controller->store($allowed);
        self::assertSame(1, $this->posts);
        self::assertSame([], $session->get('review_drafts'));
    }

    public function testApprovalDigestChangesWithUserRevisionAndEveryDraftField(): void
    {
        $expected = $this->digest();
        foreach ([
            [11, 'owner/test-repo', 7, str_repeat('a', 40), str_repeat('b', 40), $this->draft],
            [10, 'owner/other', 7, str_repeat('a', 40), str_repeat('b', 40), $this->draft],
            [10, 'owner/test-repo', 8, str_repeat('a', 40), str_repeat('b', 40), $this->draft],
            [10, 'owner/test-repo', 7, str_repeat('c', 40), str_repeat('b', 40), $this->draft],
            [10, 'owner/test-repo', 7, str_repeat('a', 40), str_repeat('c', 40), $this->draft],
            [10, 'owner/test-repo', 7, str_repeat('a', 40), str_repeat('b', 40), array_replace($this->draft, ['path' => 'other.php'])],
            [10, 'owner/test-repo', 7, str_repeat('a', 40), str_repeat('b', 40), array_replace($this->draft, ['line' => 4])],
            [10, 'owner/test-repo', 7, str_repeat('a', 40), str_repeat('b', 40), array_replace($this->draft, ['side' => 'LEFT'])],
            [10, 'owner/test-repo', 7, str_repeat('a', 40), str_repeat('b', 40), array_replace($this->draft, ['comment' => 'Changed'])],
        ] as $input) {
            self::assertNotSame($expected, ManualInlineCommentPublisher::digest(...$input));
        }
    }
}
