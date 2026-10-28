<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Agent\SingleFileCandidate;
use ProofPatch\Patch\CssPatch;

final class SingleFileCandidateTest extends TestCase
{
    public function testAppliesSingleReplacementWhenShaMatches(): void
    {
        $source = "line 1\nline 2\nline 3\n";
        $sha = hash('sha256', $source);

        $result = SingleFileCandidate::create($source, $sha, "line 2\n", "line 2 modified\n");

        self::assertSame("line 1\nline 2 modified\nline 3\n", $result);
    }

    public function testRejectsMismatchedSha256(): void
    {
        $source = 'const a = 1;';
        $wrongSha = hash('sha256', 'const a = 2;');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Source content does not match the expected SHA-256 digest.');

        SingleFileCandidate::create($source, $wrongSha, '1', '2');
    }

    public function testRejectsMalformedSha256Digest(): void
    {
        $source = 'const a = 1;';

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Expected a 64-character lowercase hex SHA-256 digest.');

        SingleFileCandidate::create($source, strtoupper(hash('sha256', $source)), '1', '2');
    }

    public function testRejectsEmptyFindString(): void
    {
        $source = 'hello world';
        $sha = hash('sha256', $source);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Find string must not be empty.');

        SingleFileCandidate::create($source, $sha, '', 'prefix');
    }

    public function testRejectsIdenticalFindAndReplace(): void
    {
        $source = 'hello world';
        $sha = hash('sha256', $source);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Replacement must differ from the find string.');

        SingleFileCandidate::create($source, $sha, 'world', 'world');
    }

    public function testRejectsFindStringNotFound(): void
    {
        $source = 'hello world';
        $sha = hash('sha256', $source);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Find string was not found in the source.');

        SingleFileCandidate::create($source, $sha, 'nonexistent', 'replacement');
    }

    public function testRejectsAmbiguousMultipleOccurrences(): void
    {
        $source = 'repeat and repeat again';
        $sha = hash('sha256', $source);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Find string must occur exactly once without overlapping or repeated occurrences.');

        SingleFileCandidate::create($source, $sha, 'repeat', 'single');
    }

    public function testRejectsAmbiguousOverlappingMatches(): void
    {
        $source = 'aaa';
        $sha = hash('sha256', $source);

        // Note: substr_count('aaa', 'aa') returns 1 because it skips ahead,
        // but 'aa' matches at offset 0 AND offset 1.
        self::assertSame(1, substr_count($source, 'aa'));

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Find string must occur exactly once without overlapping or repeated occurrences.');

        SingleFileCandidate::create($source, $sha, 'aa', 'bb');
    }

    public function testAppliesReplacementToCheckoutFixture(): void
    {
        $project = dirname(__DIR__, 2);
        $source = file_get_contents($project.'/'.CssPatch::FILE);
        $sha = hash('sha256', $source);

        $candidate = SingleFileCandidate::create(
            $source,
            $sha,
            'pointer-events: auto;',
            'pointer-events: none;'
        );

        self::assertNotSame($source, $candidate);
        self::assertStringContainsString('pointer-events: none;', $candidate);
        self::assertStringNotContainsString('pointer-events: auto;', $candidate);
    }
}
