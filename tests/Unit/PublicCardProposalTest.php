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
        foreach (glob($this->directory.'/approvals/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->directory.'/approvals');
        foreach (glob($this->directory.'/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->directory);
    }

    private function card(): array
    {
        return [
            'id' => 7,
            'userId' => 3,
            'repository' => 'example/project',
            'title' => 'Update chart quantity',
            'description' => 'The quantity should be two.',
        ];
    }

    private function githubClient(bool $public = true, string $source = "<?php\nreturn 1;\n"): MockHttpClient
    {
        return new MockHttpClient(function (string $method, string $url, array $options) use ($public, $source): MockResponse {
            self::assertSame('GET', $method);
            self::assertArrayNotHasKey('authorization', array_change_key_case($options['headers'] ?? []));
            if ($url === 'https://api.github.com/repos/example/project') {
                $body = [
                    'full_name' => 'example/project',
                    'private' => !$public,
                    'visibility' => $public ? 'public' : 'private',
                ];
            } elseif (str_contains($url, '/commits/')) {
                $body = ['sha' => str_repeat('a', 40)];
            } else {
                $body = [
                    'type' => 'file',
                    'path' => 'src/Chart.php',
                    'encoding' => 'base64',
                    'size' => strlen($source),
                    'content' => base64_encode($source),
                ];
            }
            return new MockResponse(json_encode($body, JSON_THROW_ON_ERROR));
        });
    }

    private function context(string $source = "<?php\nreturn 1;\n"): array
    {
        return (new PublicCardPreview($this->githubClient(true, $source)))->preview(
            $this->card(),
            'src/Chart.php',
            str_repeat('a', 40)
        );
    }

    private function service(MockHttpClient $provider, bool $public = true, string $source = "<?php\nreturn 1;\n"): PublicCardProposal
    {
        return new PublicCardProposal(
            $provider,
            new PublicCardPreview($this->githubClient($public, $source)),
            new RequestBudget($this->directory, 100000, 2),
            new SingleUseReviewApproval($this->directory.'/approvals')
        );
    }

    public function testApprovedCardProposalUsesTaskSnapshotAndRemainsUnverified(): void
    {
        $calls = 0;
        $sent = [];
        $provider = new MockHttpClient(function (string $method, string $url, array $options) use (&$calls, &$sent): MockResponse {
            $calls++;
            self::assertSame('POST', $method);
            self::assertSame('https://inference.baseten.co/v1/chat/completions', $url);
            $sent = json_decode($options['body'], true, 64, JSON_THROW_ON_ERROR);
            return new MockResponse(json_encode([
                'model' => 'meta-models/muse-spark-open-1026',
                'choices' => [[
                    'finish_reason' => 'stop',
                    'message' => [
                        'content' => json_encode([
                            'path' => 'src/Chart.php',
                            'find' => 'return 1;',
                            'replace' => 'return 2;',
                            'explanation' => 'Return two from Chart.php.',
                        ], JSON_THROW_ON_ERROR),
                    ],
                ]],
                'usage' => ['prompt_tokens' => 40, 'completion_tokens' => 20],
            ], JSON_THROW_ON_ERROR));
        });

        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        self::assertSame(0, $calls);
        self::assertSame(7, $preview['cardId']);
        self::assertSame($context['context']['cardVersion'], $preview['cardVersion']);
        self::assertSame($context['digest'], $preview['previewDigest']);
        self::assertStringContainsString('The quantity should be two.', $preview['body']['messages'][1]['content']);
        self::assertStringNotContainsString('issueNumber', $preview['body']['messages'][1]['content']);
        self::assertStringNotContainsString('image', $preview['body']['messages'][1]['content']);

        $result = $service->propose(
            $context,
            fn () => $this->card(),
            true,
            $preview['approvalToken'],
            $preview['digest'],
            'test-key-1234567890',
            fn () => 1,
            fn () => null
        );
        self::assertSame($preview['body'], $sent);
        self::assertSame('unverified_suggestion', $result['status']);
        self::assertSame($context['context']['cardVersion'], $result['cardVersion']);
        self::assertSame($context['digest'], $result['previewDigest']);
        self::assertFalse($result['candidate']['verified']);
        self::assertFalse($result['candidate']['applied']);
        self::assertSame("<?php\nreturn 2;\n", $result['candidate']['source']);

        // Reconstruct the GitHub mock: a replay must be rejected after freshness, before provider use.
        $replayService = $this->service($provider);
        try {
            $replayService->propose(
                $context,
                fn () => $this->card(),
                true,
                $preview['approvalToken'],
                $preview['digest'],
                'test-key-1234567890',
                fn () => 1,
                fn () => null
            );
            self::fail('Replayed approval accepted.');
        } catch (\RuntimeException) {
            self::assertSame(1, $calls);
        }
    }

    public function testRejectsUnapprovedRevokedChangedAndSecretRequestsBeforeProviderCall(): void
    {
        $calls = 0;
        $provider = new MockHttpClient(function () use (&$calls): MockResponse {
            $calls++;
            return new MockResponse('{}');
        });
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());

        foreach (['unapproved', 'revoked', 'changed'] as $case) {
            $changed = $this->card();
            if ($case === 'changed') {
                $changed['description'] = 'Another task';
            }
            try {
                $service->propose(
                    $context,
                    fn () => $case === 'revoked' ? null : $changed,
                    $case !== 'unapproved',
                    $preview['approvalToken'],
                    $preview['digest'],
                    'test-key-1234567890',
                    fn () => 1,
                    fn () => null
                );
                self::fail('Unsafe request accepted: '.$case);
            } catch (\InvalidArgumentException|\RuntimeException) {
                self::assertSame(0, $calls);
            }
        }

        // Rejects secret tokens
        $secretCard = $this->card();
        $secretCard['description'] = 'token ghp_1234567890abcdef1234567890abcdef';
        $secretContext = (new PublicCardPreview($this->githubClient()))->preview($secretCard, 'src/Chart.php', str_repeat('a', 40));
        try {
            $service->preview($secretContext, $secretCard);
            self::fail('Secret content accepted.');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('credentials', $e->getMessage());
        }

        // Rejects private/confidential customer markers
        $privateNoteCard = $this->card();
        $privateNoteCard['description'] = 'Private customer report: confidential billing calculation detail.';
        $privateNoteContext = (new PublicCardPreview($this->githubClient()))->preview($privateNoteCard, 'src/Chart.php', str_repeat('a', 40));
        try {
            $service->preview($privateNoteContext, $privateNoteCard);
            self::fail('Private/confidential task marker accepted.');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('private or confidential', $e->getMessage());
        }
    }

    public function testPrivateRepositoryOrMidFlightRevocationDoesNotConsumeApprovalOrBudget(): void
    {
        $calls = 0;
        $provider = new MockHttpClient(function () use (&$calls): MockResponse {
            $calls++;
            return new MockResponse('{}');
        });
        $context = $this->context();
        $private = $this->service($provider, false);
        $preview = $private->issueApproval($context, $this->card());
        try {
            $private->propose(
                $context,
                fn () => $this->card(),
                true,
                $preview['approvalToken'],
                $preview['digest'],
                'test-key-1234567890',
                fn () => 1,
                fn () => null
            );
            self::fail('Private repository accepted.');
        } catch (\RuntimeException) {
            self::assertSame(0, $calls);
        }

        $valid = $this->service($provider);
        $count = 0;
        try {
            $valid->propose(
                $context,
                function () use (&$count) {
                    return ++$count === 1 ? $this->card() : null;
                },
                true,
                $preview['approvalToken'],
                $preview['digest'],
                'test-key-1234567890',
                fn () => 1,
                fn () => null
            );
            self::fail('Revoked grant accepted.');
        } catch (\RuntimeException) {
            self::assertSame(0, $calls);
        }
        self::assertSame(0, (new RequestBudget($this->directory, 100000, 2))->status()['attempts']);
    }

    public function testWrongDigestAndDifferentUserCannotConsumeApproval(): void
    {
        $calls = 0;
        $provider = new MockHttpClient(function () use (&$calls): MockResponse {
            $calls++;
            return new MockResponse('{}');
        });
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        $different = $this->card();
        $different['userId'] = 9;
        foreach ([
            ['card' => $this->card(), 'digest' => str_repeat('0', 64)],
            ['card' => $different, 'digest' => $preview['digest']],
        ] as $attempt) {
            try {
                $service->propose(
                    $context,
                    fn () => $attempt['card'],
                    true,
                    $preview['approvalToken'],
                    $attempt['digest'],
                    'test-key-1234567890',
                    fn () => 1,
                    fn () => null
                );
                self::fail('Mismatched authorization accepted.');
            } catch (\InvalidArgumentException|\RuntimeException) {
                self::assertSame(0, $calls);
            }
        }
    }

    public function testModelCannotRewriteDifferentPath(): void
    {
        $provider = new MockHttpClient([new MockResponse(json_encode([
            'model' => 'meta-models/muse-spark-open-1026',
            'choices' => [[
                'finish_reason' => 'stop',
                'message' => [
                    'content' => json_encode([
                        'path' => 'src/Other.php',
                        'find' => 'return 1;',
                        'replace' => 'return 2;',
                        'explanation' => 'Wrong file.',
                    ], JSON_THROW_ON_ERROR),
                ],
            ]],
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 10],
        ], JSON_THROW_ON_ERROR))]);
        $service = $this->service($provider);
        $context = $this->context();
        $preview = $service->issueApproval($context, $this->card());
        $this->expectExceptionMessage('selected-file constraints');
        $service->propose(
            $context,
            fn () => $this->card(),
            true,
            $preview['approvalToken'],
            $preview['digest'],
            'test-key-1234567890',
            fn () => 1,
            fn () => null
        );
    }
}
