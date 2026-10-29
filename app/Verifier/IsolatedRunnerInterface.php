<?php

declare(strict_types=1);

namespace ProofPatch\Verifier;

/**
 * Contract for executing untrusted candidate code in an isolated microVM / container sandbox.
 *
 * Security requirements:
 * 1. Network must be explicitly blocked (block_network=True).
 * 2. No host credentials, API keys, or sensitive filesystem volumes mounted.
 * 3. Strict execution bounds: CPU, memory, timeout, and output byte limits.
 * 4. Ephemeral lifecycle: fresh container per run, guaranteed cleanup in finally.
 * 5. Fail closed: If isolation cannot be verified, execution is refused.
 */
interface IsolatedRunnerInterface
{
    /**
     * @param string $source The candidate source file content
     * @param string $testHarness The test harness script content
     * @param string $relativePath Relative path where source should be mounted (e.g. 'src/OrderTotal.php')
     * @param int $timeoutSeconds Maximum wall-clock execution time
     * @return array{
     *     exitCode: int,
     *     output: string,
     *     logSha256: string,
     *     durationMs: int,
     *     sandboxId: string,
     *     runnerType: string,
     *     networkBlocked: bool,
     *     credentialsMounted: bool,
     *     isolated: bool,
     * }
     */
    public function runIsolated(
        string $source,
        string $testHarness,
        string $relativePath = 'src/OrderTotal.php',
        int $timeoutSeconds = 10
    ): array;

    /**
     * Reports local runner configuration. This does not verify provider authentication,
     * connectivity, sandbox isolation, or available credits.
     *
     * @return array{available: bool, runner: string, reason: string}
     */
    public function isAvailable(): array;
}
