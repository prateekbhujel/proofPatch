<?php

declare(strict_types=1);

namespace ProofPatch\Agent;

/** Persistent one-attempt reservation in integer millionths of a dollar. */
final readonly class RequestBudget
{
    public function __construct(private string $directory, private int $limitMicros = 50000)
    {
    }

    public function run(int $reserveMicros, callable $operation): mixed
    {
        if ($reserveMicros <= 0 || $reserveMicros > $this->limitMicros) {
            throw new \RuntimeException('Request exceeds the local credit budget.');
        }
        if (is_link($this->directory) || (!is_dir($this->directory) && !mkdir($this->directory, 0700, true))) {
            throw new \RuntimeException('Cannot create private request budget directory.');
        }
        chmod($this->directory, 0700);
        $path = $this->directory.'/runtime-ledger.json';
        if (is_link($path)) {
            throw new \RuntimeException('Budget ledger must not be a symlink.');
        }
        $handle = fopen($path, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new \RuntimeException('Cannot lock the request budget.');
        }
        chmod($path, 0600);
        try {
            $contents = stream_get_contents($handle);
            $ledger = $contents === '' ? ['version' => 1, 'attempts' => []] : json_decode($contents, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($ledger) || ($ledger['version'] ?? null) !== 1 || !is_array($ledger['attempts'] ?? null)
                || count($ledger['attempts']) !== 0) {
                throw new \RuntimeException('The runtime pilot has already been used or its ledger is invalid.');
            }
            $ledger['attempts'][] = ['at' => gmdate(DATE_ATOM), 'reservedMicros' => $reserveMicros, 'status' => 'reserved'];
            $this->save($handle, $ledger);
            try {
                $result = $operation();
                $ledger['attempts'][0]['status'] = 'received';
                $ledger['attempts'][0]['usage'] = $result['usage'];
                $this->save($handle, $ledger);
                return $result;
            } catch (\Throwable $error) {
                $ledger['attempts'][0]['status'] = 'uncertain';
                $this->save($handle, $ledger);
                throw $error;
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function save($handle, array $ledger): void
    {
        $data = json_encode($ledger, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)."\n";
        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, $data) !== strlen($data) || !fflush($handle)) {
            throw new \RuntimeException('Cannot persist the request budget.');
        }
        if (function_exists('fsync') && !fsync($handle)) {
            throw new \RuntimeException('Cannot sync the request budget.');
        }
    }
}
