<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

/**
 * Manages server-held, single-use cryptographic approvals for PR review requests.
 * Enforces atomic consumption before any provider call to prevent duplicate spend,
 * concurrent execution, and request replays.
 */
final readonly class SingleUseReviewApproval
{
    public const TOKEN_LENGTH = 64; // 32 bytes hex
    public const DEFAULT_TTL_SECONDS = 1800; // 30 minutes

    public function __construct(
        private string $directory,
        private int $ttlSeconds = self::DEFAULT_TTL_SECONDS,
    ) {
        if ($this->ttlSeconds <= 0) {
            throw new \InvalidArgumentException('Approval TTL must be positive.');
        }
    }

    /**
     * Issue a single-use approval token bound to repository, PR number, head SHA, and preview digest.
     *
     * @return array{
     *     token: string,
     *     repository: string,
     *     pullNumber: int,
     *     headSha: string,
     *     digest: string,
     *     createdAt: int,
     *     expiresAt: int,
     *     consumed: bool
     * }
     */
    public function issue(
        string $repository,
        int $pullNumber,
        string $headSha,
        string $digest,
    ): array {
        if (trim($repository) === '') {
            throw new \InvalidArgumentException('Repository must not be empty.');
        }
        if ($pullNumber < 1) {
            throw new \InvalidArgumentException('Pull number must be >= 1.');
        }
        if (!preg_match('/\A[a-f0-9]{40}\z/', $headSha)) {
            throw new \InvalidArgumentException('Head SHA must be a 40-character hex string.');
        }
        if (!preg_match('/\A[a-f0-9]{64}\z/', $digest)) {
            throw new \InvalidArgumentException('Digest must be a 64-character hex string.');
        }

        $this->ensureDirectory();

        $token = bin2hex(random_bytes(32));
        $now = time();
        $record = [
            'token' => $token,
            'repository' => $repository,
            'pullNumber' => $pullNumber,
            'headSha' => $headSha,
            'digest' => $digest,
            'createdAt' => $now,
            'expiresAt' => $now + $this->ttlSeconds,
            'consumed' => false,
        ];

        $path = $this->tokenPath($token);
        $data = json_encode($record, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)."\n";

        // Exclusive file creation prevents token collisions
        $handle = fopen($path, 'x');
        if ($handle === false) {
            throw new \RuntimeException('Failed to create unique approval token file.');
        }

        try {
            chmod($path, 0600);
            if (fwrite($handle, $data) !== strlen($data) || !fflush($handle)) {
                throw new \RuntimeException('Failed to write approval record.');
            }
            if (function_exists('fsync')) {
                @fsync($handle);
            }
        } finally {
            fclose($handle);
        }

        return $record;
    }

    /**
     * Atomically verify and consume the server-held approval token.
     * MUST be called before any provider or network execution.
     * Fails closed on missing, expired, mismatched, or already consumed tokens.
     *
     * @return array{
     *     token: string,
     *     repository: string,
     *     pullNumber: int,
     *     headSha: string,
     *     digest: string,
     *     createdAt: int,
     *     expiresAt: int,
     *     consumed: true,
     *     consumedAt: string
     * }
     */
    public function consume(
        string $token,
        string $repository,
        int $pullNumber,
        string $headSha,
        string $digest,
    ): array {
        if (!preg_match('/\A[a-f0-9]{64}\z/', $token)) {
            throw new \InvalidArgumentException('Invalid approval token format.');
        }
        if (!preg_match('/\A[a-f0-9]{40}\z/', $headSha)) {
            throw new \InvalidArgumentException('Invalid head SHA format.');
        }
        if (!preg_match('/\A[a-f0-9]{64}\z/', $digest)) {
            throw new \InvalidArgumentException('Invalid digest format.');
        }

        $path = $this->tokenPath($token);
        if (is_link($path) || !is_file($path)) {
            throw new \RuntimeException('Approval token is invalid, expired, or not found on server.');
        }

        $handle = fopen($path, 'r+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new \RuntimeException('Cannot acquire exclusive lock on approval token.');
        }

        try {
            rewind($handle);
            $contents = stream_get_contents($handle, 4096);
            if ($contents === false || $contents === '') {
                throw new \RuntimeException('Approval token record is unreadable or empty.');
            }

            $record = json_decode($contents, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($record) || !isset($record['consumed'], $record['digest'], $record['headSha'])) {
                throw new \RuntimeException('Approval token record is corrupted.');
            }

            // 1. Single-use guard: strictly fail closed if already consumed
            if ($record['consumed'] === true) {
                throw new \RuntimeException('This review approval token has already been consumed. Replays and duplicate requests are strictly rejected.');
            }

            // 2. Expiration check
            if (time() > ($record['expiresAt'] ?? 0)) {
                throw new \RuntimeException('This review approval token has expired. Generate and inspect a fresh preview.');
            }

            // 3. Context binding checks (Repository, PR number, Head SHA, Digest)
            if (($record['repository'] ?? '') !== $repository || ($record['pullNumber'] ?? 0) !== $pullNumber) {
                throw new \RuntimeException('Approval token was not issued for this pull request.');
            }

            if (!hash_equals($record['headSha'], $headSha)) {
                throw new \RuntimeException('Approval token head SHA does not match current pull request head.');
            }

            if (!hash_equals($record['digest'], $digest)) {
                throw new \RuntimeException('Approval token digest does not match reviewed payload digest.');
            }

            // 4. ATOMIC CONSUMPTION BEFORE PROVIDER CALL
            $record['consumed'] = true;
            $record['consumedAt'] = gmdate(DATE_ATOM);

            $data = json_encode($record, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)."\n";
            rewind($handle);
            if (!ftruncate($handle, 0) || fwrite($handle, $data) !== strlen($data) || !fflush($handle)) {
                throw new \RuntimeException('Failed to persist consumed approval state.');
            }
            if (function_exists('fsync')) {
                @fsync($handle);
            }

            return $record;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function ensureDirectory(): void
    {
        if (is_link($this->directory)) {
            throw new \RuntimeException('Approvals directory must not be a symlink.');
        }
        if (!is_dir($this->directory) && !mkdir($this->directory, 0700, true)) {
            throw new \RuntimeException('Cannot create approvals directory.');
        }
        chmod($this->directory, 0700);
    }

    private function tokenPath(string $token): string
    {
        return $this->directory.'/'.basename($token).'.json';
    }
}
