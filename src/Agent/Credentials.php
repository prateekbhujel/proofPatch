<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

final class Credentials
{
    public static function baseten(): string
    {
        $key = getenv('BASETEN_API_KEY');
        if ($key !== false && $key !== '') {
            return $key;
        }
        $home = getenv('HOME');
        $file = $home.'/'.'.config/proofpatch/baseten.key';
        if (!$home || is_link($file) || !is_file($file) || (fileperms($file) & 0077) !== 0) {
            throw new \RuntimeException('Configure an owner-only Baseten key before requesting a proposal.');
        }
        $key = file_get_contents($file);
        if ($key === false) {
            throw new \RuntimeException('Cannot read the Baseten key.');
        }
        return trim($key);
    }
}
