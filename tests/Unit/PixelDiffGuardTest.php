<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Verifier\PixelDiffGuard;

final class PixelDiffGuardTest extends TestCase
{
    private string $directory;
    private const MASK = ['x' => 0, 'y' => 0, 'width' => 2, 'height' => 2];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/pixel-guard-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.'/*') as $path) {
            unlink($path);
        }
        rmdir($this->directory);
    }

    public function testAllowsChangesInsideTheDeclaredMask(): void
    {
        $result = (new PixelDiffGuard())->compare($this->png('before'), $this->png('after', [0, 0]), self::MASK);
        self::assertTrue($result['passed']);
        self::assertSame(0, $result['outsideChangedPixels']);
    }

    public function testRejectsVisibleChangeOutsideTheMask(): void
    {
        $result = (new PixelDiffGuard())->compare($this->png('before'), $this->png('after', [15, 15]), self::MASK);
        self::assertFalse($result['passed']);
        self::assertSame(1, $result['outsideChangedPixels']);
    }

    public function testRejectsAnOversizedMask(): void
    {
        $a = $this->png('before');
        $this->expectException(\InvalidArgumentException::class);
        (new PixelDiffGuard())->compare($a, $a, ['x' => 0, 'y' => 0, 'width' => 16, 'height' => 16]);
    }

    public function testRejectsMismatchedDimensions(): void
    {
        $a = $this->png('before');
        $b = $this->png('after', null, 8);
        $this->expectException(\InvalidArgumentException::class);
        (new PixelDiffGuard())->compare($a, $b, self::MASK);
    }

    public function testRejectsSymlinkedEvidence(): void
    {
        $a = $this->png('before');
        symlink($a, $this->directory.'/link.png');
        $this->expectException(\InvalidArgumentException::class);
        (new PixelDiffGuard())->compare($a, $this->directory.'/link.png', self::MASK);
    }

    private function png(string $name, ?array $changed = null, int $size = 16): string
    {
        $image = imagecreatetruecolor($size, $size);
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
        if ($changed !== null) {
            imagesetpixel($image, $changed[0], $changed[1], imagecolorallocate($image, 0, 0, 0));
        }
        $path = $this->directory.'/'.$name.'.png';
        imagepng($image, $path);
        imagedestroy($image);
        return $path;
    }
}
