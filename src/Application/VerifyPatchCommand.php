<?php

declare(strict_types=1);

namespace ProofPatch\Application;

use Illuminate\Console\Command;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Verifier\CheckoutVerifier;

final class VerifyPatchCommand extends Command
{
    protected $signature = 'review:verify {patch : Path to JSON patch file (maximum 16 KB)}';

    protected $description = 'Run isolated 4-gate verification on a candidate CSS patch in a detached git worktree';

    public function handle(): int
    {
        $path = (string) $this->argument('patch');
        if (!is_file($path) || filesize($path) > 16384) {
            $this->error('Patch file must exist and be at most 16 KB.');
            return self::FAILURE;
        }

        try {
            $input = json_decode((string) file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
            if (!is_array($input)) {
                $this->error('Expected a JSON patch object.');
                return self::FAILURE;
            }

            $project = dirname(__DIR__, 2);
            $verifier = new CheckoutVerifier($project);
            $result = $verifier->verify(CssPatch::fromArray($input));

            $this->line(json_encode($result, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));

            return match ($result['decision']) {
                'VERIFIED' => self::SUCCESS,
                'FAILED' => self::FAILURE,
                default => 78,
            };
        } catch (\Throwable $e) {
            $this->error('Verification error: '.$e->getMessage());
            return self::FAILURE;
        }
    }
}
