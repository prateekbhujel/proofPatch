<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Support;

use ProofPatch\Support\LocalProcess;

/**
 * A process-separation experiment for trusted test fixtures only.
 * Both processes run as the same host user: this is not a sandbox and must
 * never be used for model-generated or otherwise untrusted code.
 *
 * Critical security boundary note:
 * Candidate stdout is untrusted output. ob_start() and JSON/integer parsing
 * do not prevent a candidate from printing a valid result and exiting early.
 * This prototype demonstrates that stdout cannot attest normal function return.
 */
final class OrderTotalOraclePrototype
{
    public static function run(string $fixtureCandidate, string $fixtureHarness, string $directory): array
    {
        mkdir($directory . '/src', 0700, true);
        mkdir($directory . '/tests', 0700, true);
        file_put_contents($directory . '/candidate.php', $fixtureCandidate);
        file_put_contents($directory . '/tests/order_total.php', $fixtureHarness);
        file_put_contents($directory . '/src/OrderTotal.php', <<<'PHP'
<?php
declare(strict_types=1);

function orderTotal(array $items): int
{
    $candidate = dirname(__DIR__) . '/candidate.php';
    $worker = dirname(__DIR__) . '/worker.php';
    $process = proc_open([PHP_BINARY, '-n', $worker, $candidate], [
        0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w'],
    ], $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to start fixture worker');
    }
    fwrite($pipes[0], json_encode($items, JSON_THROW_ON_ERROR));
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    if ($exit !== 0 || $err !== '' || !is_string($out) || !preg_match('/\A-?(?:0|[1-9][0-9]*)\z/D', $out)) {
        throw new RuntimeException('Invalid fixture worker result');
    }
    $value = filter_var($out, FILTER_VALIDATE_INT);
    if (!is_int($value)) {
        throw new RuntimeException('Fixture worker returned an invalid integer');
    }
    return $value;
}
PHP);
        file_put_contents($directory . '/worker.php', <<<'PHP'
<?php
declare(strict_types=1);

$items = json_decode((string) stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (!is_array($items)) {
    exit(2);
}
ob_start();
require $argv[1];
$result = orderTotal($items);
$output = ob_get_clean();
if ($output !== '' || !is_int($result)) {
    exit(3);
}
echo $result;
PHP);

        $process = LocalProcess::create([PHP_BINARY, '-n', $directory . '/tests/order_total.php'], $directory, timeout: 5);
        $process->run();
        return ['exitCode' => $process->getExitCode(), 'stdout' => $process->getOutput(), 'stderr' => $process->getErrorOutput()];
    }
}
