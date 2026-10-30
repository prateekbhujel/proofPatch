<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Evidence\CanonicalJson;
use ProofPatch\GitHub\PublicCardPreview;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PublicCardPreviewTest extends TestCase
{
    private function card(): array
    {
        return ['id' => 3, 'userId' => 7, 'repository' => 'example/project',
            'title' => 'Fix the chart', 'description' => 'The chart should show quantities correctly.'];
    }

    private function repo(bool $public = true): array
    {
        return ['full_name' => 'example/project', 'private' => !$public, 'visibility' => $public ? 'public' : 'private'];
    }

    private function responses(string $source = 'const quantity = 1;', bool $public = true): array
    {
        return [$this->repo($public), ['sha' => str_repeat('a', 40)], [
            'type' => 'file', 'path' => 'src/chart.js', 'encoding' => 'base64',
            'size' => strlen($source), 'content' => base64_encode($source),
        ], $this->repo($public)];
    }

    private function client(array $responses, array &$calls): MockHttpClient
    {
        return new MockHttpClient(function (string $method, string $url, array $options) use (&$responses, &$calls): MockResponse {
            $calls[] = [$method, $url, $options];
            self::assertSame('GET', $method);
            self::assertStringStartsWith('https://api.github.com/repos/example/project', $url);
            self::assertStringNotContainsString('Authorization:', implode(' ', $options['headers'] ?? []));
            self::assertStringNotContainsString('Fix%20the%20chart', $url);
            self::assertArrayNotHasKey('body', $options);
            self::assertSame(0, $options['max_redirects']);
            if ($responses === []) self::fail('Unexpected request.');
            return new MockResponse(json_encode(array_shift($responses), JSON_THROW_ON_ERROR));
        });
    }

    public function testLocalPreviewPreservesCardAndSelectedPublicFileAndNeverUploadsCardText(): void
    {
        $calls = [];
        $preview = (new PublicCardPreview($this->client($this->responses(), $calls)))
            ->preview($this->card(), 'src/chart.js', str_repeat('a', 40));
        self::assertSame('local_preview_not_sent', $preview['status']);
        self::assertSame('local_task_card', $preview['context']['kind']);
        self::assertSame($this->card()['title'], $preview['context']['title']);
        self::assertSame($this->card()['description'], $preview['context']['description']);
        self::assertSame('const quantity = 1;', $preview['context']['source']);
        self::assertSame(hash('sha256', CanonicalJson::encode($preview['context'])), $preview['digest']);
        self::assertStringContainsString('ref='.str_repeat('a', 40), $calls[2][1]);
        self::assertArrayNotHasKey('issueNumber', $preview['context']);
        self::assertArrayNotHasKey('image', $preview['context']);
    }

    public function testFreshnessRefetchesTheSameRevisionAndRejectsDifferentSource(): void
    {
        $calls = [];
        $original = (new PublicCardPreview($this->client($this->responses(), $calls)))
            ->preview($this->card(), 'src/chart.js', str_repeat('a', 40));
        $same = new PublicCardPreview($this->client($this->responses(), $calls));
        $same->assertFresh($original, $this->card());
        self::assertCount(8, $calls);
        $this->expectExceptionMessage('The public file changed');
        (new PublicCardPreview($this->client($this->responses('changed'), $calls)))->assertFresh($original, $this->card());
    }

    public function testChangedCardOrTamperedDigestFailsBeforeAnyFetch(): void
    {
        $calls = [];
        $preview = (new PublicCardPreview($this->client($this->responses(), $calls)))
            ->preview($this->card(), 'src/chart.js', str_repeat('a', 40));
        $modified = $this->card();
        $modified['description'] .= ' Another detail.';
        try {
            (new PublicCardPreview($this->client([], $calls)))->assertFresh($preview, $modified);
            self::fail('Changed card accepted.');
        } catch (\RuntimeException) {
            self::assertCount(4, $calls);
        }
        $preview['context']['source'] = 'forged';
        $this->expectExceptionMessage('The task preview changed');
        (new PublicCardPreview($this->client([], $calls)))->assertFresh($preview, $this->card());
    }

    public function testPrivateRepoAndUnsafeInputsFailClosed(): void
    {
        $calls = [];
        try {
            (new PublicCardPreview($this->client([$this->repo(false)], $calls)))
                ->preview($this->card(), 'src/chart.js', str_repeat('a', 40));
            self::fail('Private repository accepted.');
        } catch (\RuntimeException) {
            self::assertCount(1, $calls);
        }
        foreach ([['../.env', str_repeat('a', 40)], ['src/chart.js', 'main']] as [$path, $commit]) {
            try {
                (new PublicCardPreview($this->client([], $calls)))->preview($this->card(), $path, $commit);
                self::fail('Invalid path or revision accepted.');
            } catch (\InvalidArgumentException) {
                self::assertCount(1, $calls);
            }
        }
    }

    public function testScreenshotAndExtraDataCannotBeAddedToCardOrPreview(): void
    {
        $calls = [];
        $card = $this->card();
        $card['image'] = 'private image bytes';
        try {
            (new PublicCardPreview($this->client([], $calls)))->preview($card, 'src/chart.js', str_repeat('a', 40));
            self::fail('Extra card data accepted.');
        } catch (\InvalidArgumentException) {
            self::assertSame([], $calls);
        }
        $preview = (new PublicCardPreview($this->client($this->responses(), $calls)))
            ->preview($this->card(), 'src/chart.js', str_repeat('a', 40));
        $preview['context']['image'] = 'private image bytes';
        $preview['digest'] = hash('sha256', CanonicalJson::encode($preview['context']));
        $this->expectExceptionMessage('The task preview changed');
        (new PublicCardPreview($this->client([], $calls)))->assertFresh($preview, $this->card());
    }
}
