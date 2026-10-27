<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\RequestBudget;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class IssueSuggestionTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/proofpatch-issue-test-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.'/*') ?: [] as $file) @unlink($file);
        @rmdir($this->directory);
    }

    private function context(): array
    {
        $source = 'const value = 1;';
        return ['repository' => 'example/project', 'issueNumber' => 12, 'issueUrl' => 'https://github.com/example/project/issues/12',
            'title' => 'Fix problem', 'body' => 'The example is broken.', 'commit' => str_repeat('a', 40),
            'path' => 'src/file.js', 'source' => $source, 'sourceSha256' => hash('sha256', $source)];
    }

    private function response(array $suggestion, string $finish = 'stop'): MockResponse
    {
        return new MockResponse(json_encode(['model' => 'meta-models/muse-spark-open-1026', 'choices' => [[
            'finish_reason' => $finish, 'message' => ['content' => json_encode($suggestion, JSON_THROW_ON_ERROR)],
        ]], 'usage' => ['prompt_tokens' => 20, 'completion_tokens' => 10]], JSON_THROW_ON_ERROR));
    }

    public function testApprovedExactRequestReturnsOnlyAnUnverifiedBoundedSuggestion(): void
    {
        $calls = 0;
        $body = null;
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$calls, &$body): MockResponse {
            ++$calls;
            self::assertSame('POST', $method);
            self::assertSame('https://inference.baseten.co/v1/chat/completions', $url);
            self::assertSame(0, $options['max_redirects']);
            $body = json_decode($options['body'], true, 64, JSON_THROW_ON_ERROR);
            return $this->response(['path' => 'src/file.js', 'find' => 'value = 1', 'replace' => 'value = 2', 'explanation' => 'Update value.']);
        });
        $service = new IssueSuggestion($client, new RequestBudget($this->directory, 100000, 1));
        $context = $this->context();
        $preview = $service->preview($context);
        $result = $service->propose($context, $preview['digest'], 'test-key-1234567890');
        self::assertSame($preview['body'], $body);
        self::assertSame('unverified_suggestion', $result['status']);
        self::assertSame($context['commit'], $result['commit']);
        self::assertSame($context['sourceSha256'], $result['sourceSha256']);
        self::assertSame('value = 2', $result['replace']);
        try {
            $service->propose($context, $preview['digest'], 'test-key-1234567890');
            self::fail('Attempt budget bypassed.');
        } catch (\RuntimeException) { self::assertSame(1, $calls); }
    }

    public function testChangedContextCannotReuseApprovalOrReachProvider(): void
    {
        $calls = 0;
        $client = new MockHttpClient(function () use (&$calls): MockResponse { ++$calls; return $this->response([]); });
        $service = new IssueSuggestion($client, new RequestBudget($this->directory));
        $context = $this->context();
        $digest = $service->preview($context)['digest'];
        $context['body'] = 'Different instructions.';
        try {
            $service->propose($context, $digest, 'test-key-1234567890');
            self::fail('Changed context accepted.');
        } catch (\InvalidArgumentException) { self::assertSame(0, $calls); }
        self::assertFileDoesNotExist($this->directory.'/runtime-ledger.json');
    }

    public function testWrongPathOrAmbiguousFindCannotBeAccepted(): void
    {
        foreach ([['path' => '../unsafe', 'find' => 'value = 1', 'replace' => 'x', 'explanation' => 'Change'],
            ['path' => 'src/file.js', 'find' => 'missing', 'replace' => 'x', 'explanation' => 'Change']] as $suggestion) {
            $client = new MockHttpClient(fn (): MockResponse => $this->response($suggestion));
            $service = new IssueSuggestion($client, new RequestBudget($this->directory, 100000, 3));
            $context = $this->context();
            try {
                $service->propose($context, $service->preview($context)['digest'], 'test-key-1234567890');
                self::fail('Unsafe suggestion accepted.');
            } catch (\RuntimeException $error) { self::assertStringContainsString('constraints', $error->getMessage()); }
        }
    }

    public function testTruncatedModelOutputIsRejected(): void
    {
        $client = new MockHttpClient(fn (): MockResponse => $this->response([], 'length'));
        $service = new IssueSuggestion($client, new RequestBudget($this->directory));
        $context = $this->context();
        $this->expectException(\RuntimeException::class);
        $service->propose($context, $service->preview($context)['digest'], 'test-key-1234567890');
    }
}
