<?php

declare(strict_types=1);

namespace ProofPatch\Verifier;

use ProofPatch\Support\LocalProcess;
use Symfony\Component\Process\ExecutableFinder;

final readonly class LockedCheckoutRunner
{
    public function __construct(private string $project)
    {
    }

    public function run(string $worktree, string $evidence): array
    {
        if (!mkdir($evidence, 0700, true)) {
            throw new \RuntimeException('Cannot create a fresh evidence directory.');
        }
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        if ($socket === false) {
            throw new \RuntimeException('Cannot reserve a local port.');
        }
        $port = (int) substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
        fclose($socket);
        $server = LocalProcess::create([PHP_BINARY, '-S', '127.0.0.1:'.$port, '-t', $worktree.'/public'], $worktree);
        $server->start();
        try {
            $ready = false;
            for ($attempt = 0; $attempt < 100; ++$attempt) {
                $connection = @stream_socket_client('tcp://127.0.0.1:'.$port, $error, $message, 0.1);
                if ($connection !== false) {
                    fclose($connection);
                    $ready = true;
                    break;
                }
                if (!$server->isRunning()) {
                    throw new \RuntimeException('Fixture server stopped: '.$server->getErrorOutput());
                }
                usleep(50000);
            }
            if (!$ready) {
                throw new \RuntimeException('Fixture server did not start.');
            }
            $configuredDriver = getenv('CHECKOUT_DRIVER');
            $driver = $configuredDriver ?: $this->project.'/drivers/chromedriver-mac-arm64/chromedriver';
            if (!$configuredDriver && !is_executable($driver)) {
                $driver = (new ExecutableFinder())->find('chromedriver', null, [$this->project.'/drivers']);
            }
            if ($driver === null || !is_executable($driver)) {
                throw new \RuntimeException('ChromeDriver is not configured.');
            }
            $browser = getenv('PANTHER_CHROME_BINARY') ?: $this->project.'/drivers/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
            $environment = ['CHECKOUT_URL' => 'http://127.0.0.1:'.$port.'/fixtures/checkout.html',
                'CHECKOUT_ARTIFACT_DIR' => $evidence, 'CHECKOUT_DRIVER' => $driver];
            if (is_executable($browser)) {
                $environment['PANTHER_CHROME_BINARY'] = $browser;
            }
            $argv = [PHP_BINARY, $this->project.'/vendor/bin/phpunit', '--no-configuration', '--bootstrap',
                $this->project.'/vendor/autoload.php', '--log-junit', $evidence.'/junit.xml', $this->project.'/tests/Locked/CheckoutLockedTest.php'];
            $process = LocalProcess::create($argv, $this->project, $environment, 60);
            $exit = $process->run();
            $output = $process->getOutput().$process->getErrorOutput();
            file_put_contents($evidence.'/phpunit.log', $output);
            if (!is_file($evidence.'/observation.json') || !is_file($evidence.'/junit.xml')) {
                throw new \RuntimeException('Protected test did not produce complete browser evidence.');
            }
            $observation = json_decode(file_get_contents($evidence.'/observation.json'), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($observation) || !is_file($evidence.'/checkout.png')
                || !hash_equals($observation['screenshotSha256'] ?? '', hash_file('sha256', $evidence.'/checkout.png'))) {
                throw new \RuntimeException('Browser screenshot evidence is missing or inconsistent.');
            }
            return ['argv' => $argv, 'exitCode' => $exit, 'output' => $output, 'observation' => $observation,
                'logSha256' => hash_file('sha256', $evidence.'/phpunit.log'), 'junitSha256' => hash_file('sha256', $evidence.'/junit.xml')];
        } finally {
            $server->stop();
        }
    }
}
