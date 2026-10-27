<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\ModelProposal;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Support\LocalProcess;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class ModelProposalTest extends TestCase
{
    private string $directory;
    private string $project;

    protected function setUp(): void
    {
        $this->project = dirname(__DIR__, 2);
        $this->directory = sys_get_temp_dir().'/proofpatch-model-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);
        mkdir($this->directory.'/baseline', 0700);
        foreach (['checkout.png', 'observation.json', 'phpunit.log', 'junit.xml'] as $file) {
            file_put_contents($this->directory.'/baseline/'.$file, 'test evidence '.$file);
        }
        $report = ['id' => '20261027T040000Z-123456abcdef', 'decision' => 'FAILED', 'proposal' => ['file' => 'public/fixtures/checkout.html'],
            'baseCommit' => trim(LocalProcess::output(['git', '-C', $this->project, 'rev-parse', 'HEAD'])),
            'runs' => ['baseline' => ['exitCode' => 1, 'observation' => [
                'initial' => 'Standard', 'selected' => 'Standard', 'pointer' => ['trusted' => true, 'x' => 420, 'y' => 320],
                'hitStack' => [], 'banner' => ['visible' => true],
                'screenshotSha256' => hash_file('sha256', $this->directory.'/baseline/checkout.png'),
            ], 'logSha256' => hash_file('sha256', $this->directory.'/baseline/phpunit.log'),
                'junitSha256' => hash_file('sha256', $this->directory.'/baseline/junit.xml')]]];
        file_put_contents($this->directory.'/result.json', json_encode($report, JSON_THROW_ON_ERROR));
        file_put_contents($this->directory.'/receipt.json', json_encode((new Receipt())->create($this->directory), JSON_THROW_ON_ERROR));
    }

    protected function tearDown(): void
    {
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $path) {
            $path->isDir() && !$path->isLink() ? rmdir($path->getPathname()) : unlink($path->getPathname());
        }
        rmdir($this->directory);
    }

    public function testProposesFromEvidenceAndCannotSpendTwice(): void
    {
        $calls = 0;
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$calls): MockResponse {
            ++$calls;
            self::assertSame('POST', $method);
            self::assertSame('https://inference.baseten.co/v1/chat/completions', $url);
            $payload = json_decode($options['body'], true, 64, JSON_THROW_ON_ERROR);
            self::assertSame('meta-models/muse-spark-open-1026', $payload['model']);
            self::assertSame('low', $payload['reasoning_effort']);
            self::assertStringContainsString('hitStack', $payload['messages'][1]['content']);
            return $this->response('stop', ['find' => 'pointer-events: auto;', 'replace' => 'pointer-events: none;']);
        });
        $service = new ModelProposal($this->project, $client, new RequestBudget($this->directory.'/budget'));
        $result = $service->propose($this->directory, 'test-key-1234567890');
        self::assertSame('pointer-events: none;', $result['patch']['replace']);
        self::assertSame(['prompt_tokens' => 600, 'completion_tokens' => 400], $result['usage']);
        $this->expectException(\RuntimeException::class);
        try {
            $service->propose($this->directory, 'test-key-1234567890');
        } finally {
            self::assertSame(1, $calls);
        }
    }

    public function testTruncatedOutputIsRejectedAndReservationPersists(): void
    {
        $client = new MockHttpClient(fn() => $this->response('length', ['find' => 'x', 'replace' => 'y']));
        $service = new ModelProposal($this->project, $client, new RequestBudget($this->directory.'/budget'));
        try {
            $service->propose($this->directory, 'test-key-1234567890');
            self::fail('Truncated output was accepted.');
        } catch (\RuntimeException $error) {
            self::assertStringContainsString('incomplete', $error->getMessage());
        }
        $ledger = json_decode(file_get_contents($this->directory.'/budget/runtime-ledger.json'), true, 16, JSON_THROW_ON_ERROR);
        self::assertSame('uncertain', $ledger['attempts'][0]['status']);
        self::assertGreaterThan(0, $ledger['attempts'][0]['reservedMicros']);
    }

    public function testTamperedEvidenceStopsBeforeSending(): void
    {
        file_put_contents($this->directory.'/baseline/checkout.png', 'changed');
        $calls = 0;
        $client = new MockHttpClient(function () use (&$calls): MockResponse { ++$calls; return $this->response('stop', []); });
        $service = new ModelProposal($this->project, $client, new RequestBudget($this->directory.'/budget'));
        $this->expectException(\InvalidArgumentException::class);
        try {
            $service->propose($this->directory, 'test-key-1234567890');
        } finally {
            self::assertSame(0, $calls);
        }
    }

    private function response(string $finish, array $patch): MockResponse
    {
        return new MockResponse(json_encode(['model' => 'meta-models/muse-spark-open-1026', 'choices' => [[
            'finish_reason' => $finish, 'message' => ['content' => json_encode($patch, JSON_THROW_ON_ERROR)],
        ]], 'usage' => ['prompt_tokens' => 600, 'completion_tokens' => 400]], JSON_THROW_ON_ERROR));
    }
}
