<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\GitHubAppClient;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class GitHubAppClientTest extends TestCase
{
    public function testGetCurrentUser(): void
    {
        $http = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            $this->assertSame('GET', $method);
            $this->assertSame('https://api.github.com/user', $url);
            $this->assertContains('Authorization: Bearer test_token_123', $options['headers']);

            return new MockResponse(json_encode([
                'login' => 'pratikbhujel',
                'name' => 'Pratik Bhujel',
                'avatar_url' => 'https://avatars.githubusercontent.com/u/12345',
                'html_url' => 'https://github.com/pratikbhujel',
            ]));
        });

        $client = new GitHubAppClient($http);
        $user = $client->getCurrentUser('test_token_123');

        $this->assertSame('pratikbhujel', $user['login']);
        $this->assertSame('Pratik Bhujel', $user['name']);
        $this->assertSame('https://avatars.githubusercontent.com/u/12345', $user['avatarUrl']);
        $this->assertSame('https://github.com/pratikbhujel', $user['htmlUrl']);
    }

    public function testListSelectedRepositories(): void
    {
        $http = new MockHttpClient([
            // Call 1: /user/installations
            new MockResponse(json_encode([
                'installations' => [
                    ['id' => 101, 'account' => ['login' => 'pratikbhujel']],
                ],
            ])),
            // Call 2: /user/installations/101/repositories
            new MockResponse(json_encode([
                'repositories' => [
                    [
                        'id' => 1001,
                        'name' => 'proofpatch-backend',
                        'full_name' => 'pratikbhujel/proofpatch-backend',
                        'owner' => ['login' => 'pratikbhujel'],
                        'private' => true,
                        'default_branch' => 'main',
                        'html_url' => 'https://github.com/pratikbhujel/proofpatch-backend',
                    ],
                    [
                        'id' => 1002,
                        'name' => 'proofpatch-public',
                        'full_name' => 'pratikbhujel/proofpatch-public',
                        'owner' => ['login' => 'pratikbhujel'],
                        'private' => false,
                        'default_branch' => 'main',
                        'html_url' => 'https://github.com/pratikbhujel/proofpatch-public',
                    ],
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $repos = $client->listSelectedRepositories('test_token');

        $this->assertCount(2, $repos);
        $this->assertSame('pratikbhujel/proofpatch-backend', $repos[0]['fullName']);
        $this->assertTrue($repos[0]['isPrivate']);
        $this->assertSame('pratikbhujel/proofpatch-public', $repos[1]['fullName']);
        $this->assertFalse($repos[1]['isPrivate']);
    }

    public function testListOpenPullRequests(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                [
                    'number' => 42,
                    'title' => 'Fix order calculation quantity boundary',
                    'head' => ['ref' => 'fix/quantity', 'sha' => '1111111111222222222233333333334444444444'],
                    'base' => [
                        'ref' => 'main',
                        'sha' => '5555555555666666666677777777778888888888',
                        'repo' => ['private' => true],
                    ],
                    'user' => ['login' => 'pratikbhujel'],
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $pulls = $client->listOpenPullRequests('test_token', 'pratikbhujel/proofpatch-backend');

        $this->assertCount(1, $pulls);
        $this->assertSame(42, $pulls[0]['number']);
        $this->assertSame('Fix order calculation quantity boundary', $pulls[0]['title']);
        $this->assertSame('fix/quantity', $pulls[0]['head']);
        $this->assertSame('1111111111222222222233333333334444444444', $pulls[0]['headSha']);
        $this->assertSame('open', $pulls[0]['state']);
        $this->assertFalse($pulls[0]['isMerged']);
        $this->assertTrue($pulls[0]['isPrivate']);
    }

    public function testListPullRequestsIdentifiesMergedState(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                [
                    'number' => 83,
                    'title' => 'Preserve split POSIX UTF-8 input across key reads',
                    'state' => 'closed',
                    'merged' => true,
                    'merged_at' => '2026-09-25T12:16:11Z',
                    'head' => ['ref' => 'fix/split-utf8', 'sha' => str_repeat('a', 40)],
                    'base' => [
                        'ref' => 'main',
                        'sha' => str_repeat('b', 40),
                        'repo' => ['private' => false, 'visibility' => 'public'],
                    ],
                    'user' => ['login' => 'pratikbhujel'],
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $pulls = $client->listOpenPullRequests('test_token', 'pratikbhujel/php-terminal');

        $this->assertCount(1, $pulls);
        $this->assertSame('merged', $pulls[0]['state']);
        $this->assertTrue($pulls[0]['isMerged']);
        $this->assertFalse($pulls[0]['isPrivate']);
    }

    public function testFetchPullRequestPatch(): void
    {
        $headSha = str_repeat('a', 40);
        $baseSha = str_repeat('b', 40);

        $http = new MockHttpClient([
            // /repos/pratikbhujel/my-repo/pulls/10
            new MockResponse(json_encode([
                'number' => 10,
                'head' => ['sha' => $headSha],
                'base' => ['sha' => $baseSha, 'repo' => ['private' => true]],
                'changed_files' => 1,
            ])),
            // /repos/pratikbhujel/my-repo/pulls/10/files?per_page=100
            new MockResponse(json_encode([
                [
                    'filename' => 'src/Order.php',
                    'patch' => "@@ -10,3 +10,3 @@\n-old\n+new\n",
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $result = $client->fetchPullRequestPatch('test_token', 'pratikbhujel/my-repo', 10);

        $this->assertSame('pratikbhujel/my-repo', $result['repository']);
        $this->assertSame(10, $result['number']);
        $this->assertSame($headSha, $result['headSha']);
        $this->assertSame($baseSha, $result['baseSha']);
        $this->assertTrue($result['isPrivate']);
        $this->assertCount(1, $result['files']);
        $this->assertSame('src/Order.php', $result['files'][0]['name']);
        $this->assertSame('available', $result['files'][0]['status']);
    }

    public function testValidateRepositoryNameRejectsInvalidFormat(): void
    {
        $client = new GitHubAppClient(new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('A valid repository name in owner/repo format is required.');
        $client->listOpenPullRequests('test_token', 'invalid_name');
    }

    public function testValidateRepositoryNameRejectsPathTraversal(): void
    {
        $client = new GitHubAppClient(new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('A valid repository name in owner/repo format is required.');
        $client->listOpenPullRequests('test_token', 'owner/..');
    }

    public function testRepositoryOmittedPrivateDefaultsToPrivateFailClosed(): void
    {
        // When private is omitted or null, it must FAIL CLOSED and be marked isPrivate: true
        $this->assertFalse(GitHubAppClient::isExplicitlyPublic([]));
        $this->assertFalse(GitHubAppClient::isExplicitlyPublic(['name' => 'ambiguous-repo']));
        $this->assertFalse(GitHubAppClient::isExplicitlyPublic(['private' => null]));
    }

    public function testRepositoryNonPublicVisibilityDefaultsToPrivateFailClosed(): void
    {
        // When visibility is internal or private, even if private: false was sent by a glitch, must fail closed
        $this->assertFalse(GitHubAppClient::isExplicitlyPublic(['private' => false, 'visibility' => 'internal']));
        $this->assertFalse(GitHubAppClient::isExplicitlyPublic(['private' => false, 'visibility' => 'private']));

        // Only explicitly private: false and visibility: 'public' is non-private
        $this->assertTrue(GitHubAppClient::isExplicitlyPublic(['private' => false, 'visibility' => 'public']));
        $this->assertTrue(GitHubAppClient::isExplicitlyPublic(['private' => false]));
    }
}
