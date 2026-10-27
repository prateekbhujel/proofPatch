<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Evidence\Receipt;
use ProofPatch\Evidence\RunEvidence;
use ProofPatch\Evidence\CanonicalJson;

final class RunEvidenceTest extends TestCase
{
    public function testTamperedResultIsNotPresentedAsVerified(): void
    {
        $parent = sys_get_temp_dir().'/proofpatch-evidence-'.bin2hex(random_bytes(8));
        $id = '20261027T040000Z-123456abcdef';
        $dir = $parent.'/'.$id;
        mkdir($dir, 0700, true);
        try {
            $runs = [];
            foreach (['baseline' => 1, 'candidate' => 0] as $name => $exitCode) {
                mkdir($dir.'/'.$name);
                foreach (['checkout.png', 'observation.json', 'phpunit.log', 'junit.xml'] as $file) {
                    file_put_contents($dir.'/'.$name.'/'.$file, 'test evidence '.$file);
                }
                $runs[$name] = ['exitCode' => $exitCode,
                    'observation' => ['screenshotSha256' => hash_file('sha256', $dir.'/'.$name.'/checkout.png')],
                    'logSha256' => hash_file('sha256', $dir.'/'.$name.'/phpunit.log'),
                    'junitSha256' => hash_file('sha256', $dir.'/'.$name.'/junit.xml')];
            }
            file_put_contents($dir.'/patch.diff', 'test patch');
            $report = ['id' => $id, 'decision' => 'VERIFIED', 'baseCommit' => str_repeat('a', 40),
                'gates' => ['baselineReproduced' => true, 'protectedTestsPassed' => true,
                    'outsideMaskPreserved' => true, 'authorityIntact' => true],
                'runs' => $runs, 'patchSha256' => hash_file('sha256', $dir.'/patch.diff'),
                'visual' => ['outsideChangedPixels' => 0]];
            file_put_contents($dir.'/result.json', json_encode($report, JSON_THROW_ON_ERROR));
            file_put_contents($dir.'/receipt.json', json_encode((new Receipt())->create($dir), JSON_THROW_ON_ERROR));
            $original = (new RunEvidence())->read($dir);
            self::assertSame('VERIFIED', $original['report']['decision']);
            self::assertNotNull($original['receipt']);

            $report['visual']['outsideChangedPixels'] = 100;
            file_put_contents($dir.'/result.json', json_encode($report, JSON_THROW_ON_ERROR));
            $damaged = (new RunEvidence())->read($dir);
            self::assertSame('INCONCLUSIVE', $damaged['report']['decision']);
            self::assertSame([], $damaged['report']['gates']);
            self::assertArrayNotHasKey('visual', $damaged['report']);
            self::assertNull($damaged['receipt']);
            self::assertNotNull($damaged['error']);

            // Recompute the stored hashes to imitate a self-consistent but contradictory report.
            $report['gates']['authorityIntact'] = false;
            file_put_contents($dir.'/result.json', json_encode($report, JSON_THROW_ON_ERROR));
            $saved = json_decode((string) file_get_contents($dir.'/receipt.json'), true, 32, JSON_THROW_ON_ERROR);
            $saved['manifest']['files']['result.json'] = hash_file('sha256', $dir.'/result.json');
            $saved['sha256'] = hash('sha256', CanonicalJson::encode($saved['manifest']));
            file_put_contents($dir.'/receipt.json', json_encode($saved, JSON_THROW_ON_ERROR));
            $contradictory = (new RunEvidence())->read($dir);
            self::assertSame('INCONCLUSIVE', $contradictory['report']['decision']);
            self::assertNull($contradictory['receipt']);
        } finally {
            foreach (['baseline', 'candidate'] as $name) {
                foreach (['checkout.png', 'observation.json', 'phpunit.log', 'junit.xml'] as $file) {
                    @unlink($dir.'/'.$name.'/'.$file);
                }
                @rmdir($dir.'/'.$name);
            }
            @unlink($dir.'/patch.diff');
            @unlink($dir.'/receipt.json');
            @unlink($dir.'/result.json');
            @rmdir($dir);
            @rmdir($parent);
        }
    }
}
