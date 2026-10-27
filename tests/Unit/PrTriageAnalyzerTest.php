<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\GitHub\PrTriageAnalyzer;

final class PrTriageAnalyzerTest extends TestCase
{
    public function testSharedHunksDoNotEstablishDuplicatePr(): void
    {
        $target = [
            'repository' => 'livewire/livewire',
            'number' => 10797,
            'title' => 'Fix morph dom keying',
            'files' => [
                [
                    'name' => 'src/Features/SupportMorph/Browser.php',
                    'additions' => 4,
                    'deletions' => 2,
                    'patch' => "@@ -120,5 +120,7 @@\n- old\n+ new",
                ],
                [
                    'name' => 'tests/Browser/MorphKeyTest.php',
                    'additions' => 15,
                    'deletions' => 0,
                    'patch' => "@@ -1,10 +1,25 @@\n+ test",
                ],
            ],
        ];

        $candidate = [
            'repository' => 'livewire/livewire',
            'number' => 10798,
            'title' => 'Alternative morph key fix',
            'files' => [
                [
                    'name' => 'src/Features/SupportMorph/Browser.php',
                    'additions' => 2,
                    'deletions' => 1,
                    'patch' => "@@ -122,3 +122,4 @@\n- old\n+ alt",
                ],
                [
                    'name' => 'tests/Browser/MorphKeyTest.php',
                    'additions' => 10,
                    'deletions' => 0,
                    'patch' => "@@ -5,5 +5,15 @@\n+ test",
                ],
            ],
        ];

        $analyzer = new PrTriageAnalyzer([
            'maintainerMode' => 'STRICT_ANTI_SLOP',
            'maxDiffLines' => 50,
            'requireTestCoverage' => true,
        ]);

        $result = $analyzer->triage($target, [$candidate]);

        self::assertSame('unknown', $result['policy']['status']);
        self::assertCount(1, $result['comparisons']);

        $comp = $result['comparisons'][0];
        self::assertSame(1.0, $comp['jaccardScore']);
        self::assertSame(100, $comp['matchPercentage']);
        self::assertSame('SHARED_FILES', $comp['relationship']);
        self::assertStringContainsString('does not establish a duplicate', $comp['verdictBanner']);
        self::assertSame('REVIEW', $result['summary']['verdict']);
        self::assertSame('unknown', $result['policy']['coverage']);
    }

    public function testComparesFilePathsWithoutClaimingFixRelationships(): void
    {
        $target = [
            'repository' => 'laravel/framework',
            'number' => 500,
            'title' => 'Fix routing match',
            'files' => [
                ['name' => 'src/Illuminate/Routing/Route.php', 'additions' => 5, 'deletions' => 2],
                ['name' => 'tests/Routing/RouteTest.php', 'additions' => 8, 'deletions' => 0],
            ],
        ];

        $superset = [
            'repository' => 'laravel/framework',
            'number' => 501,
            'title' => 'Full routing overhaul',
            'files' => [
                ['name' => 'src/Illuminate/Routing/Route.php', 'additions' => 12, 'deletions' => 4],
                ['name' => 'src/Illuminate/Routing/Router.php', 'additions' => 20, 'deletions' => 10],
                ['name' => 'tests/Routing/RouteTest.php', 'additions' => 8, 'deletions' => 0],
            ],
        ];

        $independent = [
            'repository' => 'laravel/framework',
            'number' => 502,
            'title' => 'Database connection pool',
            'files' => [
                ['name' => 'src/Illuminate/Database/Connection.php', 'additions' => 10, 'deletions' => 1],
                ['name' => 'tests/Database/ConnectionTest.php', 'additions' => 12, 'deletions' => 0],
            ],
        ];

        $analyzer = new PrTriageAnalyzer();
        $result = $analyzer->triage($target, [$superset, $independent]);

        self::assertCount(2, $result['comparisons']);

        // Check superset
        self::assertSame(501, $result['comparisons'][0]['candidate']['number']);
        self::assertSame('SHARED_FILES', $result['comparisons'][0]['relationship']);
        self::assertSame(67, $result['comparisons'][0]['matchPercentage']);

        // Check independent
        self::assertSame(502, $result['comparisons'][1]['candidate']['number']);
        self::assertSame('NO_SHARED_FILES_OBSERVED', $result['comparisons'][1]['relationship']);
        self::assertSame(0.0, $result['comparisons'][1]['jaccardScore']);
    }

    public function testLargePrIsFlaggedForReviewWithoutClaimingMissingCoverageOrAutomaticAction(): void
    {
        $slopPr = [
            'repository' => 'example/repo',
            'number' => 99,
            'title' => 'Large AI generated refactor without tests',
            'files' => [
                ['name' => 'src/LargeFile.php', 'additions' => 80, 'deletions' => 40],
            ],
        ];

        $analyzer = new PrTriageAnalyzer([
            'maxDiffLines' => 50,
            'requireTestCoverage' => true,
        ]);

        $result = $analyzer->triage($slopPr, []);

        self::assertSame('review', $result['policy']['status']);
        self::assertTrue($result['policy']['diffExceeded']);
        self::assertSame('unknown', $result['policy']['coverage']);
        self::assertSame('REVIEW', $result['summary']['verdict']);
        self::assertSame('amber', $result['summary']['severity']);
    }

    public function testMissingPatchesCrossRepositoryAndTruncatedEvidenceAreNotOverclaimed(): void
    {
        $target = ['repository' => 'org/repo', 'number' => 1, 'filesTruncated' => true,
            'files' => [['name' => 'src/latest.php', 'additions' => 1, 'deletions' => 0]]];
        $sameRepo = ['repository' => 'ORG/REPO', 'number' => 2, 'files' => [['name' => 'src/latest.php']]];
        $differentRepo = ['repository' => 'other/repo', 'number' => 3, 'files' => [['name' => 'src/latest.php']]];
        $result = (new PrTriageAnalyzer(['requireTestCoverage' => false]))->triage($target, [$sameRepo, $differentRepo]);
        self::assertCount(1, $result['comparisons']);
        self::assertSame('SHARED_FILES', $result['comparisons'][0]['relationship']);
        self::assertTrue($result['comparisons'][0]['incomplete']);
        self::assertSame([], $result['target']['testPaths']);
        self::assertSame('unknown', $result['policy']['status']);
        self::assertStringNotContainsString('distinct line hunks', $result['comparisons'][0]['verdictBanner']);
    }
}
