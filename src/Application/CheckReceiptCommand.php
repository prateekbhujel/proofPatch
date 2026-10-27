<?php

declare(strict_types=1);

namespace ProofPatch\Application;

use Illuminate\Console\Command;
use ProofPatch\Evidence\Receipt;

final class CheckReceiptCommand extends Command
{
    protected $signature = 'review:receipt {run : Run ID or path to evidence directory} {expected? : Optional expected SHA-256 digest}';

    protected $description = 'Verify the cryptographic integrity of a ProofPatch evidence receipt';

    public function handle(): int
    {
        $run = (string) $this->argument('run');
        $expected = $this->argument('expected') ? (string) $this->argument('expected') : null;

        $directory = is_dir($run) ? $run : dirname(__DIR__, 2).'/artifacts/runs/'.$run;
        if (!is_dir($directory)) {
            $this->error("Evidence directory not found: {$run}");
            return self::FAILURE;
        }

        try {
            $result = (new Receipt())->verify($directory, $expected);
            $this->line(json_encode($result, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Receipt check failed: '.$e->getMessage());
            return self::FAILURE;
        }
    }
}
