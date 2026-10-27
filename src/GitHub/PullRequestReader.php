<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Reads pull-request context without checking out or executing repository code. */
final readonly class PullRequestReader
{
    public function __construct(private HttpClientInterface $http, private ?string $token = null)
    {
        if ($token !== null && ($token === '' || strlen($token) > 4096 || !preg_match('/\A[\x21-\x7e]+\z/', $token))) {
            throw new \InvalidArgumentException('GitHub token format is invalid.');
        }
    }

    public static function normalizeUrl(string $target): string
    {
        $trimmed = trim($target);
        if (preg_match('~\A([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})#([1-9][0-9]{0,8})\z~', $trimmed, $m)) {
            return 'https://github.com/'.$m[1].'/'.$m[2].'/pull/'.$m[3];
        }
        if (preg_match('~\A([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})/pull/([1-9][0-9]{0,8})/?\z~', $trimmed, $m)) {
            return 'https://github.com/'.$m[1].'/'.$m[2].'/pull/'.$m[3];
        }
        if (preg_match('~\Agithub\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})/pull/([1-9][0-9]{0,8})/?\z~', $trimmed, $m)) {
            return 'https://github.com/'.$m[1].'/'.$m[2].'/pull/'.$m[3];
        }
        return $trimmed;
    }

    public function read(string $url): array
    {
        $normalized = self::normalizeUrl($url);
        if (!preg_match('~\Ahttps://github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})/pull/([1-9][0-9]{0,8})/?\z~', $normalized, $matches)) {
            throw new \InvalidArgumentException('Enter a GitHub pull request URL, such as https://github.com/owner/repo/pull/123.');
        }
        [, $owner, $repo, $number] = $matches;
        if (in_array($repo, ['.', '..'], true)) {
            throw new \InvalidArgumentException('Invalid repository name.');
        }
        $base = 'https://api.github.com/repos/'.rawurlencode($owner).'/'.rawurlencode($repo);
        $pull = $this->get($base.'/pulls/'.$number);
        $sha = $pull['head']['sha'] ?? null;
        $baseSha = $pull['base']['sha'] ?? null;
        if (($pull['number'] ?? null) !== (int) $number || !is_string($sha) || !preg_match('/\A[a-f0-9]{40}\z/', $sha)
            || !is_string($baseSha) || !preg_match('/\A[a-f0-9]{40}\z/', $baseSha)
            || !is_string($pull['title'] ?? null) || !is_string($pull['state'] ?? null)
            || !is_string($pull['base']['ref'] ?? null) || !is_string($pull['head']['ref'] ?? null)
            || !is_int($pull['changed_files'] ?? null) || $pull['changed_files'] < 0) {
            throw new \RuntimeException('GitHub returned incomplete pull request data.');
        }
        $files = $this->get($base.'/pulls/'.$number.'/files?per_page=100');
        $checks = $this->get($base.'/commits/'.$sha.'/check-runs?per_page=100');
        $current = $this->get($base.'/pulls/'.$number);
        if (($current['head']['sha'] ?? null) !== $sha || ($current['base']['sha'] ?? null) !== $baseSha) {
            throw new \RuntimeException('The pull request changed while its details were loading. Try again.');
        }
        if (!array_is_list($files) || !is_array($checks['check_runs'] ?? null) || !is_int($checks['total_count'] ?? null)) {
            throw new \RuntimeException('GitHub returned incomplete file or check data.');
        }
        $fileRows = [];
        foreach ($files as $file) {
            if (!is_array($file) || !is_string($file['filename'] ?? null) || !is_string($file['status'] ?? null)
                || !is_int($file['additions'] ?? null) || !is_int($file['deletions'] ?? null)) {
                throw new \RuntimeException('GitHub returned invalid changed-file data.');
            }
            $fileRows[] = ['name' => $file['filename'], 'status' => $file['status'],
                'additions' => $file['additions'], 'deletions' => $file['deletions']];
        }
        $checkRows = [];
        foreach ($checks['check_runs'] as $check) {
            if (!is_array($check) || !is_string($check['name'] ?? null) || !is_string($check['status'] ?? null)
                || (!is_string($check['conclusion'] ?? null) && ($check['conclusion'] ?? null) !== null)) {
                throw new \RuntimeException('GitHub returned invalid check data.');
            }
            $checkRows[] = ['name' => $check['name'], 'status' => $check['status'], 'conclusion' => $check['conclusion'] ?? null];
        }
        return ['repository' => $owner.'/'.$repo, 'number' => (int) $number,
            'url' => 'https://github.com/'.$owner.'/'.$repo.'/pull/'.$number,
            'title' => $pull['title'], 'state' => $pull['state'], 'base' => $pull['base']['ref'],
            'head' => $pull['head']['ref'], 'headSha' => $sha, 'baseSha' => $baseSha, 'changedFiles' => $pull['changed_files'],
            'files' => $fileRows, 'filesTruncated' => $pull['changed_files'] > count($fileRows),
            'checks' => $checkRows, 'checksTotal' => $checks['total_count'], 'checksTruncated' => $checks['total_count'] > count($checkRows)];
    }

    private function get(string $url): array
    {
        $headers = ['Accept' => 'application/vnd.github+json', 'User-Agent' => 'ProofPatch', 'X-GitHub-Api-Version' => '2022-11-28'];
        if ($this->token !== null) {
            $headers['Authorization'] = 'Bearer '.$this->token;
        }
        $response = $this->http->request('GET', $url, ['headers' => $headers, 'max_redirects' => 0, 'timeout' => 15, 'max_duration' => 20]);
        $status = $response->getStatusCode();
        if ($status !== 200) {
            throw new \RuntimeException('GitHub request returned HTTP '.$status.'. Check the URL or repository access.');
        }
        $raw = $response->getContent(false);
        if (strlen($raw) > 2097152 || ($this->token !== null && str_contains($raw, $this->token))) {
            throw new \RuntimeException('GitHub response exceeded its safe bounds.');
        }
        try {
            $data = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \RuntimeException('GitHub returned invalid JSON.', 0, $error);
        }
        if (!is_array($data)) {
            throw new \RuntimeException('GitHub returned invalid data.');
        }
        return $data;
    }
}
