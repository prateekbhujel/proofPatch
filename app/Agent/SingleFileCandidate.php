<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

/**
 * Pure, non-I/O preview helper that applies a single-file find-and-replace candidate.
 * Never reads or writes files, runs commands, contacts services, or claims verification.
 */
final readonly class SingleFileCandidate
{
    public static function create(string $source, string $expectedSha256, string $find, string $replace): string
    {
        if (!preg_match('/\A[a-f0-9]{64}\z/', $expectedSha256)) {
            throw new \InvalidArgumentException('Expected a 64-character lowercase hex SHA-256 digest.');
        }

        if (!hash_equals($expectedSha256, hash('sha256', $source))) {
            throw new \InvalidArgumentException('Source content does not match the expected SHA-256 digest.');
        }

        if ($find === '') {
            throw new \InvalidArgumentException('Find string must not be empty.');
        }

        if ($find === $replace) {
            throw new \InvalidArgumentException('Replacement must differ from the find string.');
        }

        $first = strpos($source, $find);
        if ($first === false) {
            throw new \InvalidArgumentException('Find string was not found in the source.');
        }

        if (strpos($source, $find, $first + 1) !== false) {
            throw new \InvalidArgumentException('Find string must occur exactly once without overlapping or repeated occurrences.');
        }

        return substr_replace($source, $replace, $first, strlen($find));
    }
}
