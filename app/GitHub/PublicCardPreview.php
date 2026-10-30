<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use ProofPatch\Evidence\CanonicalJson;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Builds local-only task context for an explicitly chosen public file and commit. */
final readonly class PublicCardPreview
{
    private const MAX_SOURCE_BYTES = 12000;
    private const MAX_CARD_BODY_BYTES = 6000;

    public function __construct(private HttpClientInterface $http) {}

    /**
     * $card contains only local user-entered text and identity; none of it is sent to GitHub.
     * This is not a model request, authorization token, or verification result.
     *
     * @param array{id: int, userId: int, repository: string, title: string, description: string} $card
     */
    public function preview(array $card, string $path, string $commit): array
    {
        $version = self::cardVersion($card);
        $file = $this->fetchPublicFile($card['repository'], $path, $commit);
        $context = [
            'kind' => 'local_task_card',
            'cardId' => $card['id'],
            'cardVersion' => $version,
            'repository' => $card['repository'],
            'title' => $card['title'],
            'description' => $card['description'],
            'commit' => $commit,
            'path' => $path,
            'source' => $file,
            'sourceSha256' => hash('sha256', $file),
        ];
        return [
            'context' => $context,
            'digest' => hash('sha256', CanonicalJson::encode($context)),
            'status' => 'local_preview_not_sent',
        ];
    }

    /** Recheck card identity and exact public file before using an existing preview. */
    public function assertFresh(array $preview, array $card): void
    {
        $context = $preview['context'] ?? null;
        $digest = $preview['digest'] ?? null;
        $keys = is_array($context) ? array_keys($context) : [];
        sort($keys);
        if (!is_array($context) || $keys !== ['cardId', 'cardVersion', 'commit', 'description', 'kind', 'path', 'repository', 'source', 'sourceSha256', 'title'] || !is_string($digest)
            || ($preview['status'] ?? null) !== 'local_preview_not_sent'
            || !hash_equals(hash('sha256', CanonicalJson::encode($context)), $digest)
            || ($context['kind'] ?? null) !== 'local_task_card'
            || ($context['cardId'] ?? null) !== ($card['id'] ?? null)
            || !is_string($context['cardVersion'] ?? null)
            || !hash_equals($context['cardVersion'], self::cardVersion($card))
            || ($context['repository'] ?? null) !== ($card['repository'] ?? null)
            || ($context['title'] ?? null) !== ($card['title'] ?? null)
            || ($context['description'] ?? null) !== ($card['description'] ?? null)
            || !is_string($context['path'] ?? null) || !is_string($context['commit'] ?? null)
            || !is_string($context['source'] ?? null) || !is_string($context['sourceSha256'] ?? null)
            || !hash_equals(hash('sha256', $context['source']), $context['sourceSha256'])) {
            throw new \RuntimeException('The task preview changed; create a new preview.');
        }
        $current = $this->fetchPublicFile($card['repository'], $context['path'], $context['commit']);
        if (!hash_equals($context['sourceSha256'], hash('sha256', $current))) {
            throw new \RuntimeException('The public file changed; create a new preview.');
        }
    }

    /** Uses content-derived versioning so edits within one clock tick still invalidate previews. */
    public static function cardVersion(array $card): string
    {
        $keys = array_keys($card);
        sort($keys);
        if ($keys !== ['description', 'id', 'repository', 'title', 'userId']
            || !is_int($card['id']) || $card['id'] < 1 || !is_int($card['userId']) || $card['userId'] < 1
            || !is_string($card['repository']) || !preg_match('~\A[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}\z~', $card['repository'])
            || in_array(explode('/', $card['repository'])[1], ['.', '..'], true)
            || !is_string($card['title']) || trim($card['title']) === '' || strlen($card['title']) > 180
            || !is_string($card['description']) || trim($card['description']) === '' || strlen($card['description']) > self::MAX_CARD_BODY_BYTES
            || !preg_match('//u', $card['title'].$card['description'])
            || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $card['title'].$card['description'])) {
            throw new \InvalidArgumentException('The task is invalid or exceeds preview limits.');
        }
        return hash('sha256', CanonicalJson::encode($card));
    }

    private function fetchPublicFile(string $repository, string $path, string $commit): string
    {
        PublicIssueContext::validatePath($path);
        if (!preg_match('/\A[a-f0-9]{40}\z/', $commit)) {
            throw new \InvalidArgumentException('Choose a full 40-character commit SHA.');
        }
        [$owner, $repo] = explode('/', $repository);
        $root = 'https://api.github.com/repos/'.rawurlencode($owner).'/'.rawurlencode($repo);
        $this->assertPublic($this->get($root), $repository);
        $revision = $this->get($root.'/commits/'.$commit);
        if (($revision['sha'] ?? null) !== $commit) {
            throw new \RuntimeException('The selected commit is unavailable.');
        }
        $data = $this->get($root.'/contents/'.implode('/', array_map('rawurlencode', explode('/', $path))).'?ref='.$commit);
        if (($data['type'] ?? null) !== 'file' || ($data['path'] ?? null) !== $path
            || ($data['encoding'] ?? null) !== 'base64' || !is_int($data['size'] ?? null)
            || $data['size'] < 1 || $data['size'] > self::MAX_SOURCE_BYTES || !is_string($data['content'] ?? null)) {
            throw new \RuntimeException('The selected file is unavailable or exceeds preview limits.');
        }
        $source = base64_decode(preg_replace('/\s+/', '', $data['content']), true);
        if (!is_string($source) || strlen($source) !== $data['size'] || str_contains($source, "\0") || !preg_match('//u', $source)) {
            throw new \RuntimeException('The selected file is not a valid text file.');
        }
        $this->assertPublic($this->get($root), $repository);
        return $source;
    }

    private function assertPublic(array $repo, string $expected): void
    {
        if (($repo['private'] ?? null) !== false || ($repo['visibility'] ?? null) !== 'public'
            || !is_string($repo['full_name'] ?? null) || strcasecmp($repo['full_name'], $expected) !== 0) {
            throw new \RuntimeException('The repository could not be verified as public.');
        }
    }

    private function get(string $url): array
    {
        $response = $this->http->request('GET', $url, [
            'headers' => ['Accept' => 'application/vnd.github+json', 'User-Agent' => 'ProofPatcher', 'X-GitHub-Api-Version' => '2022-11-28'],
            'max_redirects' => 0, 'timeout' => 15, 'max_duration' => 20,
        ]);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('Public GitHub data is unavailable.');
        }
        $raw = $response->getContent(false);
        if (strlen($raw) > 131072) {
            throw new \RuntimeException('GitHub response exceeds preview limits.');
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
