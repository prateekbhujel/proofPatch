<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Read-only client for selected owned repositories accessible via a GitHub App user access token.
 *
 * Implements strict least-privilege read operations:
 * - Only queries repositories explicitly granted to the app installation.
 * - Accurately tags private vs public repository status.
 * - Never modifies, pushes, comments, or deletes anything on GitHub.
 */
final readonly class GitHubAppClient
{
    private const API_ROOT = 'https://api.github.com';
    private const MAX_RESPONSE_BYTES = 1048576; // 1MB safe payload limit

    public function __construct(private HttpClientInterface $http)
    {
    }

    /**
     * @return array{login: string, name: ?string, avatarUrl: ?string, htmlUrl: string}
     */
    public function getCurrentUser(string $token): array
    {
        $data = $this->get('/user', $token);
        if (!is_string($data['login'] ?? null)) {
            throw new \RuntimeException('Failed to retrieve GitHub user profile.');
        }

        return [
            'login' => (string) $data['login'],
            'name' => isset($data['name']) && is_string($data['name']) ? $data['name'] : null,
            'avatarUrl' => isset($data['avatar_url']) && is_string($data['avatar_url']) ? $data['avatar_url'] : null,
            'htmlUrl' => (string) ($data['html_url'] ?? 'https://github.com/'.$data['login']),
        ];
    }

    /**
     * Retrieves the list of repositories explicitly selected for the GitHub App installation.
     *
     * @return array<int, array{id: int, name: string, fullName: string, owner: string, isPrivate: bool, defaultBranch: string, htmlUrl: string}>
     */
    public function listSelectedRepositories(string $token): array
    {
        $installationsData = $this->get('/user/installations', $token);
        $installations = $installationsData['installations'] ?? [];
        if (!is_array($installations)) {
            return [];
        }

        $repositories = [];
        $seen = [];

        foreach ($installations as $installation) {
            $installationId = $installation['id'] ?? null;
            if (!is_int($installationId)) {
                continue;
            }

            try {
                $reposData = $this->get("/user/installations/{$installationId}/repositories", $token);
                $repoList = $reposData['repositories'] ?? [];
                if (!is_array($repoList)) {
                    continue;
                }

                foreach ($repoList as $repo) {
                    $fullName = (string) ($repo['full_name'] ?? '');
                    if ($fullName === '' || isset($seen[$fullName])) {
                        continue;
                    }
                    $seen[$fullName] = true;

                    $repositories[] = [
                        'id' => (int) ($repo['id'] ?? 0),
                        'name' => (string) ($repo['name'] ?? ''),
                        'fullName' => $fullName,
                        'owner' => (string) ($repo['owner']['login'] ?? ''),
                        'isPrivate' => !self::isExplicitlyPublic($repo),
                        'defaultBranch' => (string) ($repo['default_branch'] ?? 'main'),
                        'htmlUrl' => (string) ($repo['html_url'] ?? 'https://github.com/'.$fullName),
                    ];
                }
            } catch (\Throwable) {
                // If a specific installation is inaccessible or suspended, skip gracefully
                continue;
            }
        }

        return $repositories;
    }

    /**
     * Lists open pull requests for an authorized repository.
     *
     * @return array<int, array{number: int, title: string, head: string, base: string, headSha: string, baseSha: string, user: string, isPrivate: bool}>
     */
    public function listOpenPullRequests(string $token, string $repository): array
    {
        $this->validateRepositoryName($repository);
        $pulls = $this->get("/repos/{$repository}/pulls?state=open&per_page=30", $token);
        if (!is_array($pulls)) {
            return [];
        }

        $results = [];
        foreach ($pulls as $pull) {
            if (!isset($pull['number'], $pull['title'], $pull['head']['sha'], $pull['base']['sha'])) {
                continue;
            }

            $isMerged = ($pull['merged'] ?? false) === true || ($pull['merged_at'] ?? null) !== null;
            $state = $isMerged ? 'merged' : (string) ($pull['state'] ?? 'open');
            $results[] = [
                'number' => (int) $pull['number'],
                'state' => $state,
                'isMerged' => $isMerged,
                'title' => (string) $pull['title'],
                'head' => (string) ($pull['head']['ref'] ?? ''),
                'base' => (string) ($pull['base']['ref'] ?? ''),
                'headSha' => (string) ($pull['head']['sha'] ?? ''),
                'baseSha' => (string) ($pull['base']['sha'] ?? ''),
                'user' => (string) ($pull['user']['login'] ?? 'unknown'),
                'isPrivate' => !is_array($pull['base']['repo'] ?? null) || !self::isExplicitlyPublic($pull['base']['repo']),
            ];
        }

        return $results;
    }

    /**
     * Fetches unified diff patches for a pull request using authorized read access.
     *
     * @return array{repository: string, number: int, headSha: string, baseSha: string, isPrivate: bool, changedFiles: int, files: array}
     */
    public function fetchPullRequestPatch(string $token, string $repository, int $number): array
    {
        $this->validateRepositoryName($repository);
        $pull = $this->get("/repos/{$repository}/pulls/{$number}", $token);
        $headSha = (string) ($pull['head']['sha'] ?? '');
        $baseSha = (string) ($pull['base']['sha'] ?? '');
        $baseRepo = $pull['base']['repo'] ?? null;
        $isPrivate = !is_array($baseRepo) || !self::isExplicitlyPublic($baseRepo);
        $changedFiles = (int) ($pull['changed_files'] ?? 0);

        if (!preg_match('/\A[a-f0-9]{40}\z/', $headSha) || !preg_match('/\A[a-f0-9]{40}\z/', $baseSha)) {
            throw new \RuntimeException('Incomplete commit SHA data in pull request.');
        }

        $files = $this->get("/repos/{$repository}/pulls/{$number}/files?per_page=100", $token);
        if (!is_array($files)) {
            throw new \RuntimeException('Failed to retrieve changed files.');
        }

        $resultFiles = [];
        foreach ($files as $file) {
            $name = (string) ($file['filename'] ?? '');
            $patch = isset($file['patch']) && is_string($file['patch']) ? $file['patch'] : null;
            $resultFiles[] = [
                'name' => $name,
                'status' => $patch !== null ? 'available' : 'missing',
                'patch' => $patch,
            ];
        }

        return [
            'repository' => $repository,
            'number' => $number,
            'headSha' => $headSha,
            'baseSha' => $baseSha,
            'isPrivate' => $isPrivate,
            'changedFiles' => $changedFiles,
            'filesTruncated' => $changedFiles > count($resultFiles),
            'files' => $resultFiles,
        ];
    }

    /**
     * Determines whether a repository or repository descriptor is explicitly, unambiguously public.
     * Fails closed: if visibility is missing, null, not 'public', or if private flag is not strictly false,
     * it MUST be treated as private. Private content must never default to public.
     */
    public static function isExplicitlyPublic(array $repo): bool
    {
        if (!array_key_exists('private', $repo) || $repo['private'] !== false) {
            return false;
        }

        if (array_key_exists('visibility', $repo) && $repo['visibility'] !== 'public') {
            return false;
        }

        return true;
    }

    private function validateRepositoryName(string $repository): void
    {
        if (!preg_match('~\A([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})\z~', trim($repository), $m)
            || in_array($m[2], ['.', '..'], true)) {
            throw new \InvalidArgumentException('A valid repository name in owner/repo format is required.');
        }
    }

    private function get(string $path, string $token): array
    {
        $url = str_starts_with($path, 'http') ? $path : self::API_ROOT.$path;
        $response = $this->http->request('GET', $url, [
            'headers' => [
                'Accept' => 'application/vnd.github+json',
                'Authorization' => 'Bearer '.$token,
                'User-Agent' => 'ProofPatch-CoMaintainer',
                'X-GitHub-Api-Version' => '2022-11-28',
            ],
            'timeout' => 15,
        ]);

        $status = $response->getStatusCode();
        if ($status !== 200) {
            throw new \RuntimeException("GitHub API returned HTTP {$status} for path {$path}.");
        }

        $content = $response->getContent(false);
        if (strlen($content) > self::MAX_RESPONSE_BYTES) {
            throw new \RuntimeException('GitHub API response exceeded safe byte limit.');
        }

        if (str_contains($content, $token)) {
            throw new \RuntimeException('GitHub API response contained sensitive authorization token.');
        }

        $data = json_decode($content, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($data)) {
            throw new \RuntimeException('GitHub API returned non-JSON data.');
        }

        return $data;
    }
}
