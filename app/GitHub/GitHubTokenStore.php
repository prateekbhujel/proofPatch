<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

use Illuminate\Support\Facades\Crypt;

final class GitHubTokenStore
{
    private const FILE_NAME = 'proofpatch_github_auth.enc';

    public static function getStoragePath(): string
    {
        $dir = function_exists('storage_path') ? storage_path('app') : dirname(__DIR__, 2).'/storage/app';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        return $dir.'/'.self::FILE_NAME;
    }

    /**
     * Stores the GitHub authentication token in encrypted form with strict owner-only file permissions.
     * Never logs tokens.
     */
    public static function save(string $token, array $user, array $repositories, ?array $status = null): void
    {
        $token = trim($token);
        if ($token === '') {
            throw new \InvalidArgumentException('Token cannot be empty.');
        }

        $encryptedToken = Crypt::encryptString($token);

        $path = self::getStoragePath();
        $payload = [
            'encrypted_token' => $encryptedToken,
            'user' => [
                'id' => $user['id'] ?? null,
                'login' => $user['login'] ?? null,
            ],
            'repositories' => $repositories,
            'repositoriesStatus' => $status,
            'savedAt' => gmdate(DATE_ATOM),
        ];

        $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            throw new \RuntimeException('Failed to encode GitHub auth payload.');
        }

        file_put_contents($path, $encoded, LOCK_EX);
        chmod($path, 0600);
    }

    public static function get(): ?array
    {
        $path = self::getStoragePath();
        if (!is_file($path)) {
            return null;
        }

        // Owner-only permission check: fail closed if group or others have read permissions
        $perms = fileperms($path);
        if (($perms & 0077) !== 0) {
            @chmod($path, 0600);
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            return null;
        }

        try {
            $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($data) || !isset($data['encrypted_token']) || !is_string($data['encrypted_token'])) {
                return null;
            }

            $decrypted = Crypt::decryptString($data['encrypted_token']);
            $data['token'] = $decrypted;
            return $data;
        } catch (\Throwable) {
            return null;
        }
    }

    public static function getToken(): ?string
    {
        $data = self::get();
        if ($data !== null && isset($data['token']) && is_string($data['token']) && trim($data['token']) !== '') {
            return trim($data['token']);
        }
        return null;
    }

    public static function clear(): void
    {
        $path = self::getStoragePath();
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
