<?php

declare(strict_types=1);

namespace ProofPatch\Evidence;

/** Reads recorded results without presenting damaged evidence as verified. */
final class RunEvidence
{
    public function read(string $directory): array
    {
        $path = $directory.'/result.json';
        if (is_link($directory) || is_link($path) || !is_file($path) || filesize($path) > 1048576) {
            throw new \InvalidArgumentException('Run report is unavailable.');
        }
        $report = json_decode((string) file_get_contents($path), true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($report) || ($report['id'] ?? null) !== basename($directory)
            || !in_array($report['decision'] ?? null, ['VERIFIED', 'FAILED', 'INCONCLUSIVE'], true)) {
            throw new \InvalidArgumentException('Run report is invalid.');
        }
        try {
            $receipt = (new Receipt())->verify($directory);
            if (($receipt['runId'] ?? null) !== $report['id']) {
                throw new \InvalidArgumentException('Receipt does not identify this run.');
            }
            return ['report' => $report, 'receipt' => $receipt, 'error' => null];
        } catch (\Throwable $error) {
            // The stored result is retained on disk, but its conclusions cannot be trusted.
            $report['decision'] = 'INCONCLUSIVE';
            $report['gates'] = [];
            unset($report['visual']);
            return ['report' => $report, 'receipt' => null, 'error' => $error->getMessage()];
        }
    }
}
