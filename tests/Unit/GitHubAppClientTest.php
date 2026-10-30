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

    public function testDeniedInstallationAccessNeverFallsBackToAllUserRepositories(): void
    {
        $calls = [];
        $http = new MockHttpClient(function (string $method, string $url) use (&$calls): MockResponse {
            $calls[] = $url;
            return new MockResponse('Forbidden', ['http_code' => 403]);
        });

        $status = null;
        $repositories = (new GitHubAppClient($http))->listSelectedRepositories('test_token', $status);

        self::assertSame([], $repositories);
        self::assertCount(1, $calls);
        self::assertStringContainsString('/user/installations?', $calls[0]);
        self::assertTrue($status['truncated']);
        self::assertNotEmpty($status['errors']);
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
            // Request 1: /repos/pratikbhujel/my-repo/pulls/10 (initial read)
            new MockResponse(json_encode([
                'number' => 10,
                'title' => 'Fix order calculation quantity boundary',
                'state' => 'open',
                'head' => ['ref' => 'fix/order-quantity', 'sha' => $headSha],
                'base' => ['ref' => 'main', 'sha' => $baseSha, 'repo' => ['private' => true]],
                'user' => ['login' => 'pratikbhujel'],
                'html_url' => 'https://github.com/pratikbhujel/my-repo/pull/10',
                'changed_files' => 1,
            ])),
            // Request 2: /repos/pratikbhujel/my-repo/pulls/10/files?per_page=100
            new MockResponse(json_encode([
                [
                    'filename' => 'src/Order.php',
                    'patch' => "@@ -10,3 +10,3 @@\n-old\n+new\n",
                ],
            ])),
            // Request 3: /repos/pratikbhujel/my-repo/pulls/10 (post-files TOCTOU recheck)
            new MockResponse(json_encode([
                'number' => 10,
                'title' => 'Fix order calculation quantity boundary',
                'state' => 'open',
                'head' => ['ref' => 'fix/order-quantity', 'sha' => $headSha],
                'base' => ['ref' => 'main', 'sha' => $baseSha, 'repo' => ['private' => true]],
                'user' => ['login' => 'pratikbhujel'],
                'html_url' => 'https://github.com/pratikbhujel/my-repo/pull/10',
                'changed_files' => 1,
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $result = $client->fetchPullRequestPatch('test_token', 'pratikbhujel/my-repo', 10);

        $this->assertSame('pratikbhujel/my-repo', $result['repository']);
        $this->assertSame(10, $result['number']);
        $this->assertSame('Fix order calculation quantity boundary', $result['title']);
        $this->assertSame('open', $result['state']);
        $this->assertFalse($result['isMerged']);
        $this->assertSame('fix/order-quantity', $result['head']);
        $this->assertSame('main', $result['base']);
        $this->assertSame('pratikbhujel', $result['user']);
        $this->assertSame('https://github.com/pratikbhujel/my-repo/pull/10', $result['url']);
        $this->assertSame($headSha, $result['headSha']);
        $this->assertSame($baseSha, $result['baseSha']);
        $this->assertTrue($result['isPrivate']);
        $this->assertCount(1, $result['files']);
        $this->assertSame('src/Order.php', $result['files'][0]['name']);
        $this->assertSame('available', $result['files'][0]['status']);
    }

    public function testFetchPullRequestPatchDetectsToctouRaceFailsClosed(): void
    {
        $headShaInitial = str_repeat('a', 40);
        $headShaMutated = str_repeat('c', 40);
        $baseSha = str_repeat('b', 40);

        $http = new MockHttpClient([
            // Request 1: Initial PR details
            new MockResponse(json_encode([
                'number' => 10,
                'head' => ['sha' => $headShaInitial, 'ref' => 'feature'],
                'base' => ['sha' => $baseSha, 'ref' => 'main', 'repo' => ['private' => false, 'visibility' => 'public']],
                'changed_files' => 1,
            ])),
            // Request 2: Files response
            new MockResponse(json_encode([
                ['filename' => 'src/Order.php', 'patch' => '+new code'],
            ])),
            // Request 3: Concurrent commit occurred on head branch! (TOCTOU race)
            new MockResponse(json_encode([
                'number' => 10,
                'head' => ['sha' => $headShaMutated, 'ref' => 'feature'],
                'base' => ['sha' => $baseSha, 'ref' => 'main', 'repo' => ['private' => false, 'visibility' => 'public']],
                'changed_files' => 1,
            ])),
        ]);

        $client = new GitHubAppClient($http);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('The pull request or repository visibility changed while diff was loading. Capture it again.');

        $client->fetchPullRequestPatch('test_token', 'pratikbhujel/my-repo', 10);
    }

    public function testFetchPullRequestPatchDetectsVisibilityChangeFailsClosed(): void
    {
        $headSha = str_repeat('a', 40);
        $baseSha = str_repeat('b', 40);

        $http = new MockHttpClient([
            // Request 1: Initial PR details in public repository
            new MockResponse(json_encode([
                'number' => 10,
                'head' => ['sha' => $headSha, 'ref' => 'feature'],
                'base' => ['sha' => $baseSha, 'ref' => 'main', 'repo' => ['private' => false, 'visibility' => 'public']],
                'changed_files' => 1,
            ])),
            // Request 2: Files response
            new MockResponse(json_encode([
                ['filename' => 'src/Secret.php', 'patch' => '+secret data'],
            ])),
            // Request 3: Repository flipped to private concurrently!
            new MockResponse(json_encode([
                'number' => 10,
                'head' => ['sha' => $headSha, 'ref' => 'feature'],
                'base' => ['sha' => $baseSha, 'ref' => 'main', 'repo' => ['private' => true, 'visibility' => 'private']],
                'changed_files' => 1,
            ])),
        ]);

        $client = new GitHubAppClient($http);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('The pull request or repository visibility changed while diff was loading. Capture it again.');

        $client->fetchPullRequestPatch('test_token', 'pratikbhujel/my-repo', 10);
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

    public function testListSelectedRepositoriesPaginatesAcrossPages(): void
    {
        $page1Repos = [];
        for ($i = 1; $i <= 100; $i++) {
            $page1Repos[] = [
                'id' => $i,
                'name' => "repo-{$i}",
                'full_name' => "pratikbhujel/repo-{$i}",
                'owner' => ['login' => 'pratikbhujel'],
                'private' => false,
                'default_branch' => 'main',
            ];
        }
        $page2Repos = [
            [
                'id' => 101,
                'name' => 'repo-101',
                'full_name' => 'pratikbhujel/repo-101',
                'owner' => ['login' => 'pratikbhujel'],
                'private' => false,
                'default_branch' => 'main',
            ],
        ];

        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'installations' => [['id' => 99]],
            ])),
            new MockResponse(json_encode([
                'total_count' => 101,
                'repositories' => $page1Repos,
            ])),
            new MockResponse(json_encode([
                'total_count' => 101,
                'repositories' => $page2Repos,
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $repos = $client->listSelectedRepositories('test_token');

        $this->assertCount(101, $repos);
        $this->assertSame('pratikbhujel/repo-1', $repos[0]['fullName']);
        $this->assertSame('pratikbhujel/repo-101', $repos[100]['fullName']);
    }

    public function testListOpenPullRequestsPaginatesAcrossPages(): void
    {
        $page1Pulls = [];
        for ($i = 1; $i <= 100; $i++) {
            $page1Pulls[] = [
                'number' => $i,
                'title' => "PR {$i}",
                'head' => ['ref' => "feature-{$i}", 'sha' => str_repeat('a', 40)],
                'base' => ['ref' => 'main', 'sha' => str_repeat('b', 40), 'repo' => ['private' => false, 'visibility' => 'public']],
                'user' => ['login' => 'pratikbhujel'],
            ];
        }
        $page2Pulls = [
            [
                'number' => 101,
                'title' => 'PR 101',
                'head' => ['ref' => 'feature-101', 'sha' => str_repeat('c', 40)],
                'base' => ['ref' => 'main', 'sha' => str_repeat('d', 40), 'repo' => ['private' => false, 'visibility' => 'public']],
                'user' => ['login' => 'pratikbhujel'],
            ],
        ];

        $http = new MockHttpClient([
            new MockResponse(json_encode($page1Pulls)),
            new MockResponse(json_encode($page2Pulls)),
        ]);

        $client = new GitHubAppClient($http);
        $pulls = $client->listOpenPullRequests('test_token', 'pratikbhujel/proofPatch');

        $this->assertCount(101, $pulls);
        $this->assertSame(1, $pulls[0]['number']);
        $this->assertSame(101, $pulls[100]['number']);
    }

    public function testListSelectedRepositoriesPaginatesInstallationsAndUsesPerInstallationCounters(): void
    {
        // Two installations, both with multiple repositories.
        // Verifies per-installation counter prevents premature termination of second installation.
        $http = new MockHttpClient([
            // Call 1: /user/installations?per_page=100&page=1
            new MockResponse(json_encode([
                'total_count' => 2,
                'installations' => [
                    ['id' => 101],
                    ['id' => 102],
                ],
            ])),
            // Call 2: installation 101 repos
            new MockResponse(json_encode([
                'total_count' => 1,
                'repositories' => [
                    [
                        'id' => 1001,
                        'name' => 'inst1-repo',
                        'full_name' => 'org1/inst1-repo',
                        'owner' => ['login' => 'org1'],
                        'private' => false,
                        'default_branch' => 'main',
                    ],
                ],
            ])),
            // Call 3: installation 102 repos
            new MockResponse(json_encode([
                'total_count' => 1,
                'repositories' => [
                    [
                        'id' => 2001,
                        'name' => 'inst2-repo',
                        'full_name' => 'org2/inst2-repo',
                        'owner' => ['login' => 'org2'],
                        'private' => false,
                        'default_branch' => 'main',
                    ],
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $status = null;
        $repos = $client->listSelectedRepositories('test_token', $status);

        $this->assertCount(2, $repos);
        $this->assertSame('org1/inst1-repo', $repos[0]['fullName']);
        $this->assertSame('org2/inst2-repo', $repos[1]['fullName']);

        $this->assertNotNull($status);
        $this->assertFalse($status['truncated']);
        $this->assertSame(2, $status['installationsCount']);
        $this->assertSame(2, $status['repositoriesCount']);
        $this->assertEmpty($status['errors']);
    }

    public function testListSelectedRepositoriesReportsTruncationAndErrorsExplicitly(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                'total_count' => 2,
                'installations' => [
                    ['id' => 301],
                    ['id' => 302],
                ],
            ])),
            // Installation 301 throws HTTP 500
            new MockResponse('Internal Server Error', ['http_code' => 500]),
            // Installation 302 succeeds
            new MockResponse(json_encode([
                'total_count' => 1,
                'repositories' => [
                    [
                        'id' => 3001,
                        'name' => 'ok-repo',
                        'full_name' => 'org3/ok-repo',
                        'owner' => ['login' => 'org3'],
                        'private' => false,
                        'default_branch' => 'main',
                    ],
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $status = null;
        $repos = $client->listSelectedRepositories('test_token', $status);

        $this->assertCount(1, $repos);
        $this->assertSame('org3/ok-repo', $repos[0]['fullName']);

        $this->assertNotNull($status);
        $this->assertTrue($status['truncated'], 'Should report truncation when an installation errors');
        $this->assertNotEmpty($status['errors'], 'Should explicitly record installation error');
        $this->assertStringContainsString('Installation 301', $status['errors'][0]);
    }

    public function testListOpenIssuesExcludesPullRequests(): void
    {
        $http = new MockHttpClient([
            new MockResponse(json_encode([
                [
                    'number' => 1,
                    'title' => 'Issue One',
                    'body' => 'Bug report description',
                    'user' => ['login' => 'alice'],
                    'html_url' => 'https://github.com/org/repo/issues/1',
                    'created_at' => '2026-10-29T10:00:00Z',
                    'labels' => [['name' => 'bug']],
                ],
                [
                    // This is a pull request, so it has 'pull_request' key
                    'number' => 2,
                    'title' => 'PR Two',
                    'pull_request' => ['url' => 'https://api.github.com/repos/org/repo/pulls/2'],
                    'user' => ['login' => 'bob'],
                ],
                [
                    'number' => 3,
                    'title' => 'Issue Three',
                    'body' => 'Another issue',
                    'user' => ['login' => 'charlie'],
                    'html_url' => 'https://github.com/org/repo/issues/3',
                    'created_at' => '2026-10-29T11:00:00Z',
                    'labels' => [],
                ],
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $status = null;
        $issues = $client->listOpenIssues('test_token', 'org/repo', $status);

        $this->assertCount(2, $issues);
        $this->assertSame(1, $issues[0]['number']);
        $this->assertSame('Issue One', $issues[0]['title']);
        $this->assertSame(['bug'], $issues[0]['labels']);
        $this->assertSame(3, $issues[1]['number']);
        $this->assertSame('Issue Three', $issues[1]['title']);
    }

    public function testFetchIssueContext(): void
    {
        $sourceContent = "<?php\n\nclass OrderTotal {}\n";
        $http = new MockHttpClient([
            // 1. /repos/org/repo (default branch)
            new MockResponse(json_encode([
                'default_branch' => 'main',
            ])),
            // 2. /repos/org/repo/commits/main
            new MockResponse(json_encode([
                'sha' => '1111222233334444555566667777888899990000',
            ])),
            // 3. /repos/org/repo/issues/42
            new MockResponse(json_encode([
                'number' => 42,
                'title' => 'Fix calculation',
                'body' => 'Details about the bug in OrderTotal',
            ])),
            // 4. /repos/org/repo/contents/src/OrderTotal.php?ref=...
            new MockResponse(json_encode([
                'type' => 'file',
                'encoding' => 'base64',
                'size' => strlen($sourceContent),
                'content' => base64_encode($sourceContent),
            ])),
        ]);

        $client = new GitHubAppClient($http);
        $context = $client->fetchIssueContext('test_token', 'org/repo', 42, 'src/OrderTotal.php');

        $this->assertSame('org/repo', $context['repository']);
        $this->assertSame(42, $context['issueNumber']);
        $this->assertSame('Fix calculation', $context['title']);
        $this->assertSame('1111222233334444555566667777888899990000', $context['commit']);
        $this->assertSame('src/OrderTotal.php', $context['path']);
        $this->assertSame($sourceContent, $context['source']);
        $this->assertSame(hash('sha256', $sourceContent), $context['sourceSha256']);
    }
}
