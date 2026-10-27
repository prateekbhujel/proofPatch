<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Support\LocalProcess;
use ProofPatch\Verifier\CheckoutVerifier;

final class CheckoutVerifierTest extends TestCase
{
    public function testVerifiesARepairWithoutChangingTheSourceCheckout(): void
    {
        $project = dirname(__DIR__, 2);
        $source = file_get_contents($project.'/'.CssPatch::FILE);
        $locked = hash_file('sha256', $project.'/tests/Locked/CheckoutLockedTest.php');
        $report = (new CheckoutVerifier($project))->verify(CssPatch::fromArray([
            'file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
            'find' => 'pointer-events: auto;', 'replace' => 'pointer-events: none;',
        ]));

        self::assertSame('VERIFIED', $report['decision'], $report['reason'] ?? '');
        self::assertSame(1, $report['runs']['baseline']['exitCode']);
        self::assertSame(0, $report['runs']['candidate']['exitCode']);
        self::assertSame('Express Next-Day', $report['runs']['candidate']['observation']['selected']);
        self::assertSame(0, $report['visual']['outsideChangedPixels']);
        self::assertCount(4, $report['gates']);
        self::assertNotContains(false, $report['gates']);
        self::assertSame($source, file_get_contents($project.'/'.CssPatch::FILE));
        self::assertSame($locked, hash_file('sha256', $project.'/tests/Locked/CheckoutLockedTest.php'));
        self::assertSame($report, json_decode(file_get_contents($report['evidenceDirectory'].'/result.json'), true, 512, JSON_THROW_ON_ERROR));
        self::assertSame($report['runs']['candidate']['logSha256'], hash_file('sha256', $report['evidenceDirectory'].'/candidate/phpunit.log'));
        self::assertSame($report['runs']['candidate']['junitSha256'], hash_file('sha256', $report['evidenceDirectory'].'/candidate/junit.xml'));
        self::assertStringContainsString($project.'/tests/Locked/CheckoutLockedTest.php', implode(' ', $report['runs']['candidate']['argv']));
    }

    public function testRejectsABannerHidingShortcutEvenWhenShippingWorks(): void
    {
        $project = dirname(__DIR__, 2);
        $source = file_get_contents($project.'/'.CssPatch::FILE);
        preg_match('/^    #promo-banner \{.*\}$/m', $source, $match);
        $report = (new CheckoutVerifier($project))->verify(CssPatch::fromArray([
            'file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
            'find' => $match[0], 'replace' => '#promo-banner { display: none; }',
        ]));

        self::assertSame('FAILED', $report['decision'], $report['reason'] ?? '');
        self::assertSame(1, $report['runs']['candidate']['exitCode']);
        self::assertSame('Express Next-Day', $report['runs']['candidate']['observation']['selected']);
        self::assertFalse($report['gates']['protectedTestsPassed']);
        self::assertFalse($report['gates']['outsideMaskPreserved']);
        self::assertGreaterThan(0.0015, $report['visual']['outsideDriftRatio']);
        self::assertTrue($report['gates']['authorityIntact']);
    }

    public function testRejectsUncommittedProtectedSourceBeforeExecutingACandidate(): void
    {
        $directory = sys_get_temp_dir().'/proofpatch-boundary-'.bin2hex(random_bytes(8));
        mkdir($directory, 0700);
        $directory = realpath($directory);
        $project = dirname(__DIR__, 2);
        try {
            foreach ([CssPatch::FILE, 'tests/Locked/CheckoutLockedTest.php', 'src/Browser/CheckoutProbe.php'] as $file) {
                mkdir(dirname($directory.'/'.$file), 0700, true);
                copy($project.'/'.$file, $directory.'/'.$file);
            }
            LocalProcess::output(['git', 'init', '--quiet', '--initial-branch=main', $directory]);
            LocalProcess::output(['git', '-C', $directory, 'add', '.']);
            LocalProcess::output(['git', '-C', $directory, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture']);
            file_put_contents($directory.'/tests/Locked/CheckoutLockedTest.php', "\n// changed\n", FILE_APPEND);
            $source = file_get_contents($directory.'/'.CssPatch::FILE);
            $patch = CssPatch::fromArray(['file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
                'find' => 'pointer-events: auto;', 'replace' => 'pointer-events: none;']);
            $this->expectException(\InvalidArgumentException::class);
            $this->expectExceptionMessage('Protected source has uncommitted changes.');
            (new CheckoutVerifier($directory))->verify($patch);
        } finally {
            $this->removeDirectory($directory);
        }
    }

    public function testReportsMissingBrowserInfrastructureAsInconclusive(): void
    {
        $project = dirname(__DIR__, 2);
        $source = file_get_contents($project.'/'.CssPatch::FILE);
        $previous = getenv('CHECKOUT_DRIVER');
        putenv('CHECKOUT_DRIVER=/nonexistent/proofpatch-test-driver');
        try {
            $report = (new CheckoutVerifier($project))->verify(CssPatch::fromArray([
                'file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
                'find' => 'pointer-events: auto;', 'replace' => 'pointer-events: none;',
            ]));
            self::assertSame('INCONCLUSIVE', $report['decision']);
            self::assertSame('ChromeDriver is not configured.', $report['reason']);
            self::assertArrayNotHasKey('candidate', $report['runs'] ?? []);
            self::assertSame($source, file_get_contents($project.'/'.CssPatch::FILE));
        } finally {
            putenv($previous === false ? 'CHECKOUT_DRIVER' : 'CHECKOUT_DRIVER='.$previous);
        }
    }

    private function removeDirectory(string $directory): void
    {
        foreach (new \FilesystemIterator($directory) as $file) {
            if ($file->isDir() && !$file->isLink()) {
                $this->removeDirectory($file->getPathname());
            } else {
                unlink($file->getPathname());
            }
        }
        rmdir($directory);
    }
}
