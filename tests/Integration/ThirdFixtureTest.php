<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Integration;

use PHPUnit\Framework\TestCase;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Patch\CssPatch;
use ProofPatch\Support\LocalProcess;
use ProofPatch\Verifier\CheckoutVerifier;

final class ThirdFixtureTest extends TestCase
{
    public function testThirdCheckoutAcceptsRepairAndRejectsBannerShortcut(): void
    {
        $root = sys_get_temp_dir().'/proofpatch-third-'.bin2hex(random_bytes(8));
        mkdir($root, 0700);
        $root = realpath($root);
        $project = dirname(__DIR__, 2);
        try {
            foreach ([CssPatch::THIRD_FILE, 'tests/Locked/CheckoutLockedTest.php', 'app/Browser/CheckoutProbe.php'] as $file) {
                if (!is_dir(dirname($root.'/'.$file))) {
                    mkdir(dirname($root.'/'.$file), 0700, true);
                }
                copy($project.'/'.$file, $root.'/'.$file);
            }
            symlink($project.'/vendor', $root.'/vendor');
            symlink($project.'/drivers', $root.'/drivers');
            LocalProcess::output(['git', 'init', '--quiet', '--initial-branch=main', $root]);
            LocalProcess::output(['git', '-C', $root, 'add', '--', CssPatch::THIRD_FILE, 'tests/Locked/CheckoutLockedTest.php', 'app/Browser/CheckoutProbe.php']);
            LocalProcess::output(['git', '-C', $root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'third fixture']);
            $source = file_get_contents($root.'/'.CssPatch::THIRD_FILE);
            $patch = CssPatch::fromArray(['file' => CssPatch::THIRD_FILE, 'baseSha256' => hash('sha256', $source),
                'find' => 'max-height: 0px;', 'replace' => 'max-height: 60px;']);
            $report = (new CheckoutVerifier($root))->verify($patch);
            self::assertSame('VERIFIED', $report['decision'], $report['reason'] ?? '');
            self::assertSame(CssPatch::THIRD_FILE, $report['proposal']['file']);
            self::assertSame(1, $report['runs']['baseline']['exitCode']);
            self::assertSame(0, $report['runs']['candidate']['exitCode']);
            self::assertSame('Express Next-Day', $report['runs']['candidate']['observation']['selected']);
            self::assertSame(0, $report['visual']['outsideChangedPixels']);
            self::assertSame('VALID', (new Receipt())->verify($report['evidenceDirectory'])['integrity']);
            self::assertSame($source, file_get_contents($root.'/'.CssPatch::THIRD_FILE));

            preg_match('/^    #promo-banner \{.*\}$/m', $source, $match);
            $shortcut = CssPatch::fromArray(['file' => CssPatch::THIRD_FILE, 'baseSha256' => hash('sha256', $source),
                'find' => $match[0], 'replace' => '#promo-banner { display: none; }']);
            $bad = (new CheckoutVerifier($root))->verify($shortcut);
            self::assertSame('FAILED', $bad['decision'], $bad['reason'] ?? '');
            self::assertFalse($bad['gates']['protectedTestsPassed']);
            self::assertFalse($bad['gates']['outsideMaskPreserved']);
            self::assertTrue($bad['gates']['authorityIntact']);
        } finally {
            $this->removeDirectory($root);
        }
    }

    private function removeDirectory(string $path): void
    {
        foreach (new \FilesystemIterator($path) as $item) {
            if ($item->isDir() && !$item->isLink()) {
                $this->removeDirectory($item->getPathname());
            } else {
                unlink($item->getPathname());
            }
        }
        rmdir($path);
    }
}
