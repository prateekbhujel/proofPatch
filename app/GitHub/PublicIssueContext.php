<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Read one public issue and one explicitly selected public file, without credentials. */
final readonly class PublicIssueContext
{
    private const MAX_SOURCE_BYTES = 12000;

    public function __construct(private HttpClientInterface $http) {}

    public function fetch(string $issueUrl, string $path): array
    {
        [$owner, $repo, $number] = self::parseIssueUrl($issueUrl);
        self::validatePath($path);
        $root = 'https://api.github.com/repos/'.rawurlencode($owner).'/'.rawurlencode($repo);
        $repository = $owner.'/'.$repo;
        $first = $this->get($root);
        $branch = $this->publicBranch($first, $repository);
        $commit = $this->commit($this->get($root.'/commits/'.rawurlencode($branch)));
        $issue = $this->get($root.'/issues/'.$number);
        if (($issue['number'] ?? null) !== (int) $number || array_key_exists('pull_request', $issue)
            || !is_string($issue['title'] ?? null) || (!is_string($issue['body'] ?? null) && ($issue['body'] ?? null) !== null)
            || strlen($issue['title']) > 512 || strlen($issue['body'] ?? '') > 6000) {
            throw new \RuntimeException('The issue is unavailable or exceeds the preview limit.');
        }
        $file = $this->get($root.'/contents/'.implode('/', array_map('rawurlencode', explode('/', $path))).'?ref='.$commit);
        if (($file['type'] ?? null) !== 'file' || ($file['path'] ?? null) !== $path
            || ($file['encoding'] ?? null) !== 'base64' || !is_int($file['size'] ?? null)
            || $file['size'] < 1 || $file['size'] > self::MAX_SOURCE_BYTES || !is_string($file['content'] ?? null)) {
            throw new \RuntimeException('The selected file is unavailable or exceeds the preview limit.');
        }
        $source = base64_decode(preg_replace('/\s+/', '', $file['content']), true);
        if (!is_string($source) || strlen($source) !== $file['size'] || str_contains($source, "\0") || !preg_match('//u', $source)) {
            throw new \RuntimeException('The selected file is not a valid text file.');
        }
        $last = $this->get($root);
        if ($this->publicBranch($last, $repository) !== $branch
            || $this->commit($this->get($root.'/commits/'.rawurlencode($branch))) !== $commit) {
            throw new \RuntimeException('The repository changed; capture it again.');
        }
        $context = ['repository' => $repository, 'issueNumber' => (int) $number,
            'issueUrl' => 'https://github.com/'.$repository.'/issues/'.$number,
            'title' => $issue['title'], 'body' => $issue['body'] ?? '', 'commit' => $commit,
            'path' => $path, 'source' => $source, 'sourceSha256' => hash('sha256', $source)];
        self::validateContext($context);
        return $context;
    }

    /** @return array{string, string, string} */
    public static function parseIssueUrl(string $issueUrl): array
    {
        if (!preg_match('~\Ahttps://github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})/issues/([1-9][0-9]{0,8})/?\z~', trim($issueUrl), $matches)
            || in_array($matches[2], ['.', '..'], true)) {
            throw new \InvalidArgumentException('Enter a public GitHub issue URL.');
        }
        return [$matches[1], $matches[2], $matches[3]];
    }

    public static function validatePath(string $path): void
    {
        if ($path === '' || strlen($path) > 240 || !preg_match('~\A[A-Za-z0-9._/-]+\z~', $path)
            || str_starts_with($path, '/') || str_contains($path, '//')) {
            throw new \InvalidArgumentException('Choose a safe relative file path.');
        }
        foreach (explode('/', $path) as $part) {
            if ($part === '.' || $part === '..' || $part === '' || $part[0] === '.') {
                throw new \InvalidArgumentException('Hidden files and path traversal are not supported.');
            }
        }
        if (preg_match('/\.(?:pem|key|p12|pfx|jks|keystore)$/i', $path)) {
            throw new \InvalidArgumentException('Credential-like files are not supported.');
        }
    }

    public static function validateContext(array $context): void
    {
        $keys = array_keys($context);
        sort($keys);

        $isSynthetic = ($context['isSynthetic'] ?? false) === true;
        if ($isSynthetic) {
            $expectedKeys = ['body', 'commit', 'isSynthetic', 'issueNumber', 'issueUrl', 'path', 'provenance', 'repository', 'source', 'sourceSha256', 'title'];
            sort($expectedKeys);
            if ($keys !== $expectedKeys
                || !is_string($context['repository']) || !preg_match('~\A[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}\z~', $context['repository'])
                || !is_int($context['issueNumber']) || $context['issueNumber'] < 1 || $context['issueNumber'] > 999999999
                || $context['issueUrl'] !== null
                || $context['commit'] !== null
                || !is_string($context['provenance']) || trim($context['provenance']) === ''
                || !is_string($context['title']) || strlen($context['title']) > 512
                || !is_string($context['body']) || strlen($context['body']) > 6000
                || !is_string($context['source']) || strlen($context['source']) < 1 || strlen($context['source']) > self::MAX_SOURCE_BYTES
                || !is_string($context['path']) || !is_string($context['sourceSha256'])
                || !hash_equals(hash('sha256', $context['source']), $context['sourceSha256'])
                || str_contains($context['source'], "\0") || !preg_match('//u', $context['source'])
                || !preg_match('//u', $context['title'].$context['body'])) {
                throw new \InvalidArgumentException('The synthetic issue context is invalid.');
            }
        } else {
            $expectedKeys = ['body', 'commit', 'issueNumber', 'issueUrl', 'path', 'repository', 'source', 'sourceSha256', 'title'];
            $dedicatedKeys = ['body', 'commit', 'issueNumber', 'issueUrl', 'path', 'repository', 'source', 'sourceSha256', 'testSha256', 'testSource', 'title'];
            sort($expectedKeys);
            sort($dedicatedKeys);
            if (($keys !== $expectedKeys && $keys !== $dedicatedKeys)
                || !is_string($context['repository']) || !preg_match('~\A[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}\z~', $context['repository'])
                || !is_int($context['issueNumber']) || $context['issueNumber'] < 1 || $context['issueNumber'] > 999999999
                || $context['issueUrl'] !== 'https://github.com/'.$context['repository'].'/issues/'.$context['issueNumber']
                || !is_string($context['commit']) || !preg_match('/\A[a-f0-9]{40}\z/', $context['commit'])
                || !is_string($context['title']) || strlen($context['title']) > 512
                || !is_string($context['body']) || strlen($context['body']) > 6000
                || !is_string($context['source']) || strlen($context['source']) < 1 || strlen($context['source']) > self::MAX_SOURCE_BYTES
                || !is_string($context['path']) || !is_string($context['sourceSha256'])
                || !hash_equals(hash('sha256', $context['source']), $context['sourceSha256'])
                || str_contains($context['source'], "\0") || !preg_match('//u', $context['source'])
                || !preg_match('//u', $context['title'].$context['body'])) {
                throw new \InvalidArgumentException('The issue context is invalid.');
            }
            if (isset($context['testSource'])) {
                if (!is_string($context['testSource']) || !is_string($context['testSha256'] ?? null)
                    || !hash_equals(hash('sha256', $context['testSource']), $context['testSha256'])
                    || str_contains($context['testSource'], "\0") || !preg_match('//u', $context['testSource'])) {
                    throw new \InvalidArgumentException('The issue context test harness is invalid.');
                }
            }
        }
        self::validatePath($context['path']);
        // Common credential formats are refused even when accidentally committed to a public file.
        if (preg_match('/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp|gho|github_pat|sk_live)_[A-Za-z0-9_]{15,}\b)/', $context['source']."\n".$context['title']."\n".$context['body'])) {
            throw new \InvalidArgumentException('The selected content may contain credentials.');
        }
    }

    private function publicBranch(array $repository, string $expected): string
    {
        $branch = $repository['default_branch'] ?? null;
        if (($repository['private'] ?? null) !== false || ($repository['visibility'] ?? null) !== 'public'
            || !is_string($repository['full_name'] ?? null) || strcasecmp($repository['full_name'], $expected) !== 0
            || !is_string($branch) || $branch === '' || strlen($branch) > 255 || str_contains($branch, "\0")) {
            throw new \RuntimeException('The repository could not be verified as public.');
        }
        return $branch;
    }

    private function commit(array $data): string
    {
        $sha = $data['sha'] ?? null;
        if (!is_string($sha) || !preg_match('/\A[a-f0-9]{40}\z/', $sha)) {
            throw new \RuntimeException('The repository commit is unavailable.');
        }
        return $sha;
    }

    private function get(string $url): array
    {
        $response = $this->http->request('GET', $url, [
            'headers' => ['Accept' => 'application/vnd.github+json', 'User-Agent' => 'ProofPatch', 'X-GitHub-Api-Version' => '2022-11-28'],
            'max_redirects' => 0, 'timeout' => 15, 'max_duration' => 20,
        ]);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('Public GitHub data is unavailable (HTTP '.$response->getStatusCode().').');
        }
        $raw = $response->getContent(false);
        if (strlen($raw) > 131072) {
            throw new \RuntimeException('GitHub response exceeds the preview limit.');
        }
        try {
            $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new \RuntimeException('GitHub returned invalid data.');
        }
        if (!is_array($data)) {
            throw new \RuntimeException('GitHub returned invalid data.');
        }
        return $data;
    }
}
