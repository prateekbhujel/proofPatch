<?php

declare(strict_types=1);

namespace ProofPatch\GitHub;

/** The dedicated workflow is disabled until an exact repository is configured. */
final class DedicatedTestRepo
{
    public static function name(): ?string
    {
        $value = self::setting('PROOFPATCHER_TEST_REPO') ?? self::setting('PROOFPATCH_TEST_REPO');
        if (!is_string($value) || !preg_match('/\A[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}\z/D', $value)) {
            return null;
        }
        [, $repository] = explode('/', $value, 2);
        return in_array($repository, ['.', '..'], true) ? null : $value;
    }

    public static function requireName(): string
    {
        return self::name() ?? throw new \RuntimeException('Dedicated test repository is not configured.');
    }

    public static function baseCommit(): ?string
    {
        $value = self::setting('PROOFPATCHER_TEST_BASE_COMMIT') ?? self::setting('PROOFPATCH_TEST_BASE_COMMIT');
        return is_string($value) && preg_match('/\A[a-f0-9]{40}\z/D', $value) ? $value : null;
    }

    public static function requireBaseCommit(): string
    {
        return self::baseCommit() ?? throw new \RuntimeException('Dedicated test base commit is not configured.');
    }

    private static function setting(string $name): mixed
    {
        $value = getenv($name);
        return $value === false ? ($_ENV[$name] ?? $_SERVER[$name] ?? null) : $value;
    }
}
