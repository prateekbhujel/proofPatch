<?php

declare(strict_types=1);

namespace ProofPatch\Evidence;

/** Creates and checks a portable integrity manifest for a single verifier run. */
final class Receipt
{
    private const FILES = [
        'result.json', 'patch.diff',
        'baseline/checkout.png', 'baseline/observation.json', 'baseline/phpunit.log', 'baseline/junit.xml',
        'candidate/checkout.png', 'candidate/observation.json', 'candidate/phpunit.log', 'candidate/junit.xml',
    ];

    public function create(string $directory): array
    {
        $manifest = $this->manifest($directory);
        return ['manifest' => $manifest, 'sha256' => hash('sha256', CanonicalJson::encode($manifest))];
    }

    /** The optional digest must come from an independently trusted source. */
    public function verify(string $directory, ?string $expectedDigest = null): array
    {
        $receiptPath = $this->path($directory, 'receipt.json');
        $raw = file_get_contents($receiptPath);
        if ($raw === false || strlen($raw) > 65536) {
            throw new \InvalidArgumentException('Receipt is unreadable or too large.');
        }
        try {
            $receipt = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('Receipt is not valid JSON.', 0, $error);
        }
        if (!is_array($receipt) || array_keys($receipt) !== ['manifest', 'sha256']
            || !is_array($receipt['manifest']) || !is_string($receipt['sha256'])
            || !preg_match('/\A[a-f0-9]{64}\z/', $receipt['sha256'])) {
            throw new \InvalidArgumentException('Malformed receipt.');
        }
        $digest = hash('sha256', CanonicalJson::encode($receipt['manifest']));
        if (!hash_equals($receipt['sha256'], $digest)) {
            throw new \InvalidArgumentException('Receipt digest does not match its manifest.');
        }
        if ($expectedDigest !== null && (!preg_match('/\A[a-f0-9]{64}\z/', $expectedDigest)
            || !hash_equals($expectedDigest, $digest))) {
            throw new \InvalidArgumentException('Receipt differs from the expected digest.');
        }
        if (!hash_equals(CanonicalJson::encode($receipt['manifest']), CanonicalJson::encode($this->manifest($directory)))) {
            throw new \InvalidArgumentException('Evidence files or run metadata do not match the receipt.');
        }
        return ['integrity' => 'VALID', 'sha256' => $digest, 'externallyAnchored' => $expectedDigest !== null,
            'decision' => $receipt['manifest']['decision'], 'runId' => $receipt['manifest']['runId']];
    }

    private function manifest(string $directory): array
    {
        $resultPath = $this->path($directory, 'result.json');
        $contents = file_get_contents($resultPath);
        if ($contents === false || strlen($contents) > 1048576) {
            throw new \InvalidArgumentException('Run report is unreadable or too large.');
        }
        try {
            $result = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('Run report is not valid JSON.', 0, $error);
        }
        if (!is_array($result) || !is_string($result['id'] ?? null)
            || !preg_match('/\A\d{8}T\d{6}Z-[a-f0-9]{12}\z/', $result['id'])
            || !in_array($result['decision'] ?? null, ['VERIFIED', 'FAILED', 'INCONCLUSIVE'], true)
            || !is_string($result['baseCommit'] ?? null)
            || !preg_match('/\A[a-f0-9]{40}\z/', $result['baseCommit'])) {
            throw new \InvalidArgumentException('Run report is missing required metadata.');
        }
        if ($result['decision'] === 'VERIFIED') {
            foreach (['baselineReproduced', 'protectedTestsPassed', 'outsideMaskPreserved', 'authorityIntact'] as $gate) {
                if (($result['gates'][$gate] ?? null) !== true) {
                    throw new \InvalidArgumentException('Verified result is missing a passing required gate.');
                }
            }
            if (($result['runs']['baseline']['exitCode'] ?? null) !== 1
                || ($result['runs']['candidate']['exitCode'] ?? null) !== 0
                || !is_string($result['patchSha256'] ?? null)) {
                throw new \InvalidArgumentException('Verified result is missing required run evidence.');
            }
        }
        $files = [];
        foreach (self::FILES as $relative) {
            $path = $directory.'/'.$relative;
            if ($relative !== 'result.json' && !file_exists($path) && !is_link($path)) {
                continue;
            }
            $files[$relative] = hash_file('sha256', $this->path($directory, $relative));
        }
        foreach (['baseline', 'candidate'] as $name) {
            if (!isset($result['runs'][$name])) {
                continue;
            }
            foreach (['checkout.png', 'observation.json', 'phpunit.log', 'junit.xml'] as $file) {
                if (!isset($files[$name.'/'.$file])) {
                    throw new \InvalidArgumentException('Run evidence is incomplete.');
                }
            }
            $run = $result['runs'][$name];
            foreach (['checkout.png' => $run['observation']['screenshotSha256'] ?? null,
                         'phpunit.log' => $run['logSha256'] ?? null, 'junit.xml' => $run['junitSha256'] ?? null] as $file => $hash) {
                if (!is_string($hash) || !hash_equals($hash, $files[$name.'/'.$file])) {
                    throw new \InvalidArgumentException('Run report and evidence hashes disagree.');
                }
            }
        }
        if (isset($result['patchSha256']) && (!isset($files['patch.diff'])
            || !is_string($result['patchSha256']) || !hash_equals($result['patchSha256'], $files['patch.diff']))) {
            throw new \InvalidArgumentException('Patch does not match the run report.');
        }
        return ['format' => 'proofpatch-receipt-v1', 'runId' => $result['id'],
            'baseCommit' => $result['baseCommit'], 'decision' => $result['decision'], 'files' => $files];
    }

    private function path(string $directory, string $relative): string
    {
        if (is_link($directory) || !is_dir($directory)) {
            throw new \InvalidArgumentException('Evidence directory is invalid.');
        }
        $path = $directory;
        foreach (explode('/', $relative) as $part) {
            $path .= '/'.$part;
            if (is_link($path)) {
                throw new \InvalidArgumentException('Evidence may not contain symlinks.');
            }
        }
        if (!is_file($path) || !is_readable($path)) {
            throw new \InvalidArgumentException('Evidence file is missing or unreadable.');
        }
        return $path;
    }
}
