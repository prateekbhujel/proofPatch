<?php

declare(strict_types=1);

namespace ProofPatch\Support;

use Symfony\Component\Process\Process;

final class LocalProcess
{
    public static function create(array $argv, ?string $directory = null, array $extra = [], float $timeout = 30): Process
    {
        $environment = array_fill_keys(array_keys(getenv()), false);
        foreach (['PATH', 'HOME', 'TMPDIR'] as $key) {
            $environment[$key] = getenv($key) ?: false;
        }
        return new Process($argv, $directory, array_merge($environment, ['LANG' => 'C', 'LC_ALL' => 'C'], $extra), null, $timeout);
    }

    public static function output(array $argv, ?string $directory = null): string
    {
        return self::create($argv, $directory)->mustRun()->getOutput();
    }
}
