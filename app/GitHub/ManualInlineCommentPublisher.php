<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use ProofPatch\Evidence\CanonicalJson;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Manual one-comment publishing, restricted to the configured test repository. */
final readonly class ManualInlineCommentPublisher
{
    private const ROOT = 'https://api.github.com';

    public function __construct(private HttpClientInterface $http) {}

    /** Digest binds exactly what the user reviewed, including the connected user. */
    public static function digest(int $userId, string $repository, int $number, string $head, string $base, array $draft): string
    {
        return hash('sha256', CanonicalJson::encode([
            'userId' => $userId, 'repository' => strtolower($repository), 'number' => $number,
            'head' => $head, 'base' => $base, 'path' => $draft['path'] ?? null, 'line' => $draft['line'] ?? null,
            'side' => $draft['side'] ?? null, 'comment' => $draft['comment'] ?? null,
        ]));
    }

    /**
     * Makes at most one POST per digest. A failed or interrupted POST is uncertain
     * and cannot be retried automatically. A PR may change between GitHub's final
     * GET and POST; GitHub does not provide an atomic head precondition here.
     */
    public function publish(string $token, int $userId, array $pull, array $draft, string $approvedDigest): array
    {
        $repository = $pull['repository'] ?? null;
        $number = $pull['number'] ?? null;
        $head = $pull['headSha'] ?? null;
        $base = $pull['baseSha'] ?? null;
        $configured = DedicatedTestRepo::requireName();
        if (!is_string($repository) || strcasecmp($repository, $configured) !== 0
            || !is_int($number) || $number < 1 || $number > 999999999
            || !is_string($head) || !preg_match('/\A[a-f0-9]{40}\z/', $head)
            || !is_string($base) || !preg_match('/\A[a-f0-9]{40}\z/', $base)
            || $userId < 1 || $token === '') {
            throw new \InvalidArgumentException('The connected user, test repository or pull request is invalid.');
        }
        $path = $draft['path'] ?? null;
        $line = $draft['line'] ?? null;
        $side = $draft['side'] ?? null;
        $comment = $draft['comment'] ?? null;
        if (!is_string($path) || $path === '' || strlen($path) > 4096 || str_contains($path, "\0")
            || !is_int($line) || $line < 1 || !in_array($side, ['LEFT', 'RIGHT'], true)
            || !is_string($comment) || trim($comment) === '' || strlen($comment) > 2000 || str_contains($comment, "\0")
            || ($draft['headSha'] ?? null) !== $head) {
            throw new \InvalidArgumentException('The draft is incomplete or belongs to another revision.');
        }
        $digest = self::digest($userId, $repository, $number, $head, $base, $draft);
        if (!preg_match('/\A[a-f0-9]{64}\z/', $approvedDigest) || !hash_equals($digest, $approvedDigest)) {
            throw new \InvalidArgumentException('Review the exact comment before posting.');
        }

        $client = new GitHubAppClient($this->http);
        $current = $client->getCurrentUser($token);
        $status = [];
        $repos = $client->listSelectedRepositories($token, $status);
        if (($current['id'] ?? null) !== $userId || ($status['truncated'] ?? true) || !empty($status['errors'])
            || !array_filter($repos, static fn (array $repo): bool => strcasecmp((string) ($repo['fullName'] ?? ''), $repository) === 0)) {
            throw new \RuntimeException('The GitHub identity or repository grant could not be verified.');
        }

        [$owner, $repo] = explode('/', $configured, 2);
        $root = '/repos/'.rawurlencode($owner).'/'.rawurlencode($repo).'/pulls/'.$number;
        $first = $this->read($root, $token);
        $count = $this->assertPull($first, $number, $head, $base);
        if ($count > 100) {
            throw new \RuntimeException('This pull request has too many files for a complete check.');
        }
        $files = $this->read($root.'/files?per_page=100', $token);
        if (!array_is_list($files) || count($files) !== $count) {
            throw new \RuntimeException('GitHub returned an incomplete file list.');
        }
        $file = null;
        foreach ($files as $item) {
            if (is_array($item) && ($item['filename'] ?? null) === $path) {
                if ($file !== null) throw new \RuntimeException('GitHub returned duplicate file paths.');
                $file = $item;
            }
        }
        if ($file === null || !is_string($file['patch'] ?? null) || strlen($file['patch']) > 16384
            || !(DiffHunkParser::validateAnchor($file['patch'], $line, $head, $head, $side)['commentable'] ?? false)) {
            throw new \RuntimeException('The draft line is not present in the current diff.');
        }
        if ($this->assertPull($this->read($root, $token), $number, $head, $base) !== $count) {
            throw new \RuntimeException('The pull request changed. Capture it again.');
        }

        // Persist before network I/O; concurrent and crash retries cannot post twice.
        try {
            DB::table('inline_comment_attempts')->insert(['digest' => $digest, 'status' => 'uncertain', 'created_at' => now(), 'updated_at' => now()]);
        } catch (QueryException $e) {
            if (DB::table('inline_comment_attempts')->where('digest', $digest)->exists()) {
                throw new \RuntimeException('This comment was already attempted. Check GitHub before trying another.');
            }
            throw $e;
        }

        try {
            $response = $this->http->request('POST', self::ROOT.$root.'/comments', [
                'headers' => $this->headers($token), 'max_redirects' => 0, 'timeout' => 15, 'max_duration' => 20,
                'json' => ['body' => $comment, 'commit_id' => $head, 'path' => $path, 'line' => $line, 'side' => $side],
            ]);
            if ($response->getStatusCode() !== 201) throw new \RuntimeException('GitHub did not confirm the comment.');
            $content = $response->getContent(false);
            if (strlen($content) > 131072) throw new \RuntimeException('GitHub returned an invalid confirmation.');
            $data = json_decode($content, true, 32, JSON_THROW_ON_ERROR);
            if (!is_array($data) || !is_int($data['id'] ?? null) || $data['id'] < 1) throw new \RuntimeException('GitHub returned an invalid confirmation.');
            DB::table('inline_comment_attempts')->where('digest', $digest)->update(['status' => 'posted', 'comment_id' => $data['id'], 'updated_at' => now()]);
            return ['id' => $data['id'], 'url' => 'https://github.com/'.$configured.'/pull/'.$number.'#discussion_r'.$data['id']];
        } catch (\Throwable $e) {
            throw new \RuntimeException('Comment outcome is unknown. Check GitHub before trying another.', 0, $e);
        }
    }

    private function assertPull(array $pull, int $number, string $head, string $base): int
    {
        if (($pull['number'] ?? null) !== $number || ($pull['state'] ?? null) !== 'open'
            || ($pull['head']['sha'] ?? null) !== $head || ($pull['base']['sha'] ?? null) !== $base
            || !is_int($pull['changed_files'] ?? null) || $pull['changed_files'] < 1) {
            throw new \RuntimeException('The pull request changed or is not open. Capture it again.');
        }
        return $pull['changed_files'];
    }

    private function read(string $path, string $token): array
    {
        $response = $this->http->request('GET', self::ROOT.$path, [
            'headers' => $this->headers($token), 'max_redirects' => 0, 'timeout' => 15, 'max_duration' => 20,
        ]);
        if ($response->getStatusCode() !== 200) throw new \RuntimeException('GitHub could not verify the pull request.');
        $raw = $response->getContent(false);
        if (strlen($raw) > 1048576) throw new \RuntimeException('GitHub response was too large.');
        $value = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($value)) throw new \RuntimeException('GitHub returned invalid data.');
        return $value;
    }

    private function headers(string $token): array
    {
        return ['Accept' => 'application/vnd.github+json', 'Authorization' => 'Bearer '.$token,
            'User-Agent' => 'ProofPatcher', 'X-GitHub-Api-Version' => '2022-11-28'];
    }
}
