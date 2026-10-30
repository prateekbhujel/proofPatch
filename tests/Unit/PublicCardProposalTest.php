<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\PublicCardProposal;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Agent\SingleUseReviewApproval;
use ProofPatch\GitHub\PublicCardPreview;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PublicCardProposalTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/proofpatch-card-proposal-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.'/approvals/*') ?: [] as $file) @unlink($file);
        @rmdir($this->directory.'/approvals');
        foreach (glob($this->directory.'/*') ?: [] as $file) @unlink($file);
        @rmdir($this->directory);
    }

    private function card(): array
    {
        return ['id' => 4, 'userId' => 8, 'repository' => 'example/project',
            'title' => 'Fix the chart', 'description' => 'The quantity should be two.'];
    }

    private function githubClient(bool $public = true): MockHttpClient
    {
        $repo = ['full_name' => 'example/project', 'private' => !$public, 'visibility' => $public ? 'public' : 'private'];
        $source = 'const quantity = 1;';
        $responses = [$repo, ['sha' => str_repeat('a', 40)], [
            'type' => 'file', 'path' => 'src/chart.js', 'encoding' => 'base64', 'size' => strlen($source), 'content' => base64_encode($source),
        ], $repo];
        return new MockHttpClient(function (string $method, string $url, array $options) use (&$responses): MockResponse {
            self::assertSame('GET', $method);
            self::assertStringStartsWith('https://api.github.com/repos/example/project', $url);
            self::assertArrayNotHasKey('body', $options);
            if (!$responses) self::fail('Unexpected GitHub request.');
            return new MockResponse(json_encode(array_shift($responses), JSON_THROW_ON_ERROR));
        });
    }

    private function context(): array
    {
        return (new PublicCardPreview($this->githubClient()))->preview($this->card(), 'src/chart.js', str_repeat('a', 40));
    }

    private function service(MockHttpClient $provider, bool $public = true): PublicCardProposal
    {
        return new PublicCardProposal($provider, new PublicCardPreview($this->githubClient($public)),
            new RequestBudget($this->directory, 100000, 2), new SingleUseReviewApproval($this->directory.'/approvals'));
    }

    private function modelResponse(): MockResponse
    {
        return new MockResponse(json_encode(['model' => 'meta-models/muse-spark-open-1026', 'choices' => [[
            'finish_reason' => 'stop', 'message' => ['content' => json_encode([
                'path' => 'src/chart.js', 'find' => 'quantity = 1', 'replace' => 'quantity = 2', 'explanation' => 'Update quantity.',
            ], JSON_THROW_ON_ERROR)],
        ]], 'usage' => ['prompt_tokens' => 40, 'completion_tokens' => 20]], JSON_THROW_ON_ERROR));
    }

    public function testExactApprovedPayloadRunsOnceAndReturnsOnlyUnverifiedCandidate(): void
    {
        $calls = 0;
        $sent = null;
        $provider = new MockHttpClient(function (string $method, string $url, array $options) use (&$calls, &$sent): MockResponse {
            $calls++;
            self::assertSame('POST', $method);
            self::assertSame('https://inference.baseten.co/v1/chat/completions', $url);
            self::assertSame(0, $options['max_redirects']);
            $sent = json_decode($options['body'], true, 64, JSON_THROW_ON_ERROR);
            return $this->modelResponse();
        });
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        self::assertStringContainsString('The quantity should be two.', $preview['body']['messages'][1]['content']);
        self::assertStringNotContainsString('issueNumber', $preview['body']['messages'][1]['content']);
        self::assertStringNotContainsString('image', $preview['body']['messages'][1]['content']);
        $result = $service->propose($context, fn () => $this->card(), true, $preview['approvalToken'], $preview['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
        self::assertSame($preview['body'], $sent);
        self::assertSame('unverified_suggestion', $result['status']);
        self::assertFalse($result['candidate']['verified']);
        self::assertFalse($result['candidate']['applied']);
        self::assertSame('const quantity = 2;', $result['candidate']['source']);
        // Reconstruct the GitHub mock: a replay must be rejected after freshness, before provider use.
        $replayService = $this->service($provider);
        try {
            $replayService->propose($context, fn () => $this->card(), true, $preview['approvalToken'], $preview['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
            self::fail('Replayed approval accepted.');
        } catch (\RuntimeException) { self::assertSame(1, $calls); }
    }

    public function testNoApprovalChangedCardOrRevokedGrantNeverContactsProvider(): void
    {
        $calls = 0;
        $provider = new MockHttpClient(function () use (&$calls): MockResponse { $calls++; return $this->modelResponse(); });
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        foreach (['unapproved', 'changed', 'revoked'] as $case) {
            $changed = $this->card();
            if ($case === 'changed') $changed['description'] = 'Another task';
            try {
                $service->propose($context, fn () => $case === 'revoked' ? null : $changed, $case !== 'unapproved',
                    $preview['approvalToken'], $preview['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
                self::fail('Unsafe request accepted: '.$case);
            } catch (\InvalidArgumentException|\RuntimeException) { self::assertSame(0, $calls); }
        }
        self::assertFileDoesNotExist($this->directory.'/runtime-ledger.json');
    }

    public function testPrivateRepositoryAndSecondGrantCheckFailClosed(): void
    {
        $calls = 0;
        $provider = new MockHttpClient(function () use (&$calls): MockResponse { $calls++; return $this->modelResponse(); });
        $context = $this->context();
        $private = $this->service($provider, false);
        $preview = $private->issueApproval($context, $this->card());
        try {
            $private->propose($context, fn () => $this->card(), true, $preview['approvalToken'], $preview['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
            self::fail('Private repository accepted.');
        } catch (\RuntimeException) { self::assertSame(0, $calls); }
        $valid = $this->service($provider);
        $count = 0;
        try {
            $valid->propose($context, function () use (&$count) { return ++$count === 1 ? $this->card() : null; },
                true, $preview['approvalToken'], $preview['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
            self::fail('Revoked grant accepted.');
        } catch (\RuntimeException) { self::assertSame(0, $calls); }
        self::assertSame(0, (new RequestBudget($this->directory, 100000, 2))->status()['attempts']);
    }
    public function testWrongDigestAndDifferentUserCannotConsumeApproval(): void
    {
        $calls = 0;
        $provider = new MockHttpClient(function () use (&$calls): MockResponse { $calls++; return $this->modelResponse(); });
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        $different = $this->card();
        $different['userId'] = 9;
        foreach ([['card' => $this->card(), 'digest' => str_repeat('0', 64)], ['card' => $different, 'digest' => $preview['digest']]] as $attempt) {
            try {
                $service->propose($context, fn () => $attempt['card'], true, $preview['approvalToken'], $attempt['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
                self::fail('Mismatched authorization accepted.');
            } catch (\InvalidArgumentException|\RuntimeException) { self::assertSame(0, $calls); }
        }
        self::assertFileDoesNotExist($this->directory.'/runtime-ledger.json');
    }

    public function testUnexpectedPathFromModelNeverProducesCandidate(): void
    {
        $provider = new MockHttpClient(function (): MockResponse {
            return new MockResponse(json_encode(['model' => 'meta-models/muse-spark-open-1026', 'choices' => [[
                'finish_reason' => 'stop', 'message' => ['content' => json_encode([
                    'path' => '../unsafe', 'find' => 'quantity = 1', 'replace' => 'quantity = 2', 'explanation' => 'Change',
                ], JSON_THROW_ON_ERROR)],
            ]], 'usage' => ['prompt_tokens' => 40, 'completion_tokens' => 20]], JSON_THROW_ON_ERROR));
        });
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        $this->expectExceptionMessage('selected-file constraints');
        $service->propose($context, fn () => $this->card(), true, $preview['approvalToken'], $preview['digest'], 'test-key-1234567890', fn () => 1, fn () => null);
    }

}
