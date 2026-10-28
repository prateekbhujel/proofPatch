<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\IssueSuggestion;
use ProofPatch\Agent\RequestBudget;
use ProofPatch\Agent\SingleFileCandidate;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Verifier\CheckoutVerifier;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class IssueCandidateIntegrationTest extends TestCase
{
    private string $directory;
    private string $runsDirectory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/proofpatch-issue-cand-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);

        $this->runsDirectory = sys_get_temp_dir().'/proofpatch-runs-'.bin2hex(random_bytes(8));
        mkdir($this->runsDirectory, 0700);
        $this->runsDirectory = realpath($this->runsDirectory);
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->directory);
        $this->removeDirectory($this->runsDirectory);
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) return;
        foreach (new \FilesystemIterator($path) as $file) {
            $file->isDir() && !$file->isLink() ? $this->removeDirectory($file->getPathname()) : @unlink($file->getPathname());
        }
        @rmdir($path);
    }

    private function mockResponse(array $suggestion, string $finish = 'stop'): MockResponse
    {
        return new MockResponse(json_encode([
            'model' => 'meta-models/muse-spark-open-1026',
            'choices' => [[
                'finish_reason' => $finish,
                'message' => ['content' => json_encode($suggestion, JSON_THROW_ON_ERROR)],
            ]],
            'usage' => ['prompt_tokens' => 50, 'completion_tokens' => 25],
        ], JSON_THROW_ON_ERROR));
    }

    public function testIssueSuggestionGeneratesUnverifiedInMemoryCandidatePreviewWithoutWritingFiles(): void
    {
        $project = dirname(__DIR__, 2);
        $fixturePath = CssPatch::FILE;
        $originalSource = file_get_contents($project.'/'.$fixturePath);
        $originalSha = hash('sha256', $originalSource);

        $context = [
            'repository' => 'prateekbhujel/proofPatch',
            'issueNumber' => 1,
            'issueUrl' => 'https://github.com/prateekbhujel/proofPatch/issues/1',
            'title' => 'Fix shipping selection occluded by promo banner',
            'body' => 'The shipping option at (420, 320) cannot be clicked because promo banner intercepts pointer events.',
            'commit' => str_repeat('b', 40),
            'path' => $fixturePath,
            'source' => $originalSource,
            'sourceSha256' => $originalSha,
        ];

        $client = new MockHttpClient(function () use ($fixturePath): MockResponse {
            return $this->mockResponse([
                'path' => $fixturePath,
                'find' => 'pointer-events: auto;',
                'replace' => 'pointer-events: none;',
                'explanation' => 'Unblock clicks by ignoring pointer events on the promo overlay.',
            ]);
        });

        $budget = new RequestBudget($this->directory, 100000, 2);
        $service = new IssueSuggestion($client, $budget);

        $preview = $service->preview($context);
        $result = $service->propose($context, $preview['digest'], 'valid-test-key-1234567890');

        // Verify status and metadata
        self::assertSame('unverified_suggestion', $result['status']);
        self::assertSame($fixturePath, $result['path']);
        self::assertSame('pointer-events: auto;', $result['find']);
        self::assertSame('pointer-events: none;', $result['replace']);

        // Verify in-memory candidate preview
        self::assertArrayHasKey('candidate', $result);
        self::assertSame('unverified_in_memory_preview', $result['candidate']['status']);
        self::assertFalse($result['candidate']['applied']);
        self::assertFalse($result['candidate']['verified']);
        self::assertSame(hash('sha256', $result['candidate']['source']), $result['candidate']['sha256']);
        self::assertStringContainsString('pointer-events: none;', $result['candidate']['source']);
        self::assertStringNotContainsString('pointer-events: auto;', $result['candidate']['source']);

        // Assert strictly non-I/O: the repository file must NOT be modified
        self::assertSame($originalSource, file_get_contents($project.'/'.$fixturePath));
        self::assertSame($originalSha, hash_file('sha256', $project.'/'.$fixturePath));
    }

    public function testRejectsOverlappingMatchesEvenWhenSubstrCountReturnsOne(): void
    {
        $context = [
            'repository' => 'prateekbhujel/proofPatch',
            'issueNumber' => 2,
            'issueUrl' => 'https://github.com/prateekbhujel/proofPatch/issues/2',
            'title' => 'Overlap issue',
            'body' => 'Demonstrate overlapping match.',
            'commit' => str_repeat('c', 40),
            'path' => 'src/file.js',
            'source' => 'aaa',
            'sourceSha256' => hash('sha256', 'aaa'),
        ];

        self::assertSame(1, substr_count('aaa', 'aa'), 'substr_count returns 1 due to non-overlapping step');

        $client = new MockHttpClient(function (): MockResponse {
            return $this->mockResponse([
                'path' => 'src/file.js',
                'find' => 'aa',
                'replace' => 'bb',
                'explanation' => 'Replace overlapping substring.',
            ]);
        });

        $budget = new RequestBudget($this->directory, 100000, 2);
        $service = new IssueSuggestion($client, $budget);

        $preview = $service->preview($context);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('constraints');

        $service->propose($context, $preview['digest'], 'valid-test-key-1234567890');
    }

    public function testSameCaseCandidateBridgesToCheckoutVerifierBothValidAndNegativeControl(): void
    {
        $project = dirname(__DIR__, 2);
        $source = file_get_contents($project.'/'.CssPatch::FILE);
        $sourceSha = hash('sha256', $source);

        // 1. Negative control candidate: hiding promo banner via display: none
        preg_match('/^    #promo-banner \{.*\}$/m', $source, $match);
        $negativeCandidateSource = SingleFileCandidate::create(
            $source,
            $sourceSha,
            $match[0],
            '#promo-banner { display: none; }'
        );
        self::assertStringContainsString('display: none;', $negativeCandidateSource);

        $negativeReport = (new CheckoutVerifier($project, $this->runsDirectory))->verify(CssPatch::fromArray([
            'file' => CssPatch::FILE,
            'baseSha256' => $sourceSha,
            'find' => $match[0],
            'replace' => '#promo-banner { display: none; }',
        ]));

        self::assertSame('FAILED', $negativeReport['decision']);
        self::assertFalse($negativeReport['gates']['protectedTestsPassed']);
        self::assertFalse($negativeReport['gates']['outsideMaskPreserved']);
        self::assertGreaterThan(0.0015, $negativeReport['visual']['outsideDriftRatio']);

        // 2. Legitimate fix candidate: pointer-events: none
        $validCandidateSource = SingleFileCandidate::create(
            $source,
            $sourceSha,
            'pointer-events: auto;',
            'pointer-events: none;'
        );
        self::assertStringContainsString('pointer-events: none;', $validCandidateSource);

        $proposalEvidence = [
            'repository' => 'prateekbhujel/proofPatch',
            'issueNumber' => 1,
            'model' => 'meta-models/muse-spark-open-1026',
            'candidateSha256' => hash('sha256', $validCandidateSource),
        ];

        $validReport = (new CheckoutVerifier($project, $this->runsDirectory))->verify(CssPatch::fromArray([
            'file' => CssPatch::FILE,
            'baseSha256' => $sourceSha,
            'find' => 'pointer-events: auto;',
            'replace' => 'pointer-events: none;',
        ]), $proposalEvidence);

        self::assertSame('VERIFIED', $validReport['decision']);
        self::assertSame(1, $validReport['runs']['baseline']['exitCode']);
        self::assertSame(0, $validReport['runs']['candidate']['exitCode']);
        self::assertSame('Express Next-Day', $validReport['runs']['candidate']['observation']['selected']);
        self::assertSame(0, $validReport['visual']['outsideChangedPixels']);
        self::assertTrue($validReport['gates']['baselineReproduced']);
        self::assertTrue($validReport['gates']['protectedTestsPassed']);
        self::assertTrue($validReport['gates']['outsideMaskPreserved']);
        self::assertTrue($validReport['gates']['authorityIntact']);

        // 3. Cryptographic receipt verification incorporating proposal evidence
        self::assertArrayHasKey('proposalEvidence', $validReport);
        self::assertSame($proposalEvidence, $validReport['proposalEvidence']);

        $receipt = json_decode(file_get_contents($validReport['evidenceDirectory'].'/receipt.json'), true, 32, JSON_THROW_ON_ERROR);
        $checked = (new Receipt())->verify($validReport['evidenceDirectory'], $receipt['sha256']);
        self::assertSame('VALID', $checked['integrity']);
        self::assertTrue($checked['externallyAnchored']);
        self::assertSame('VERIFIED', $checked['decision']);

        // Repository file preserved
        self::assertSame($source, file_get_contents($project.'/'.CssPatch::FILE));
    }
}
