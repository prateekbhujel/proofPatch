<?php

declare(strict_types=1);

namespace ProofPatch\Verifier;

final class PixelDiffGuard
{
    public function compare(string $before, string $after, array $mask): array
    {
        foreach ([$before, $after] as $path) {
            if (!is_file($path) || !is_readable($path) || is_link($path)) {
                throw new \InvalidArgumentException('Expected a readable PNG file.');
            }
            $size = getimagesize($path);
            if ($size === false || $size[2] !== IMAGETYPE_PNG || $size[0] * $size[1] > 1280 * 720) {
                throw new \InvalidArgumentException('Invalid or oversized PNG.');
            }
        }
        [$width, $height] = getimagesize($before);
        [$otherWidth, $otherHeight] = getimagesize($after);
        if ($width !== $otherWidth || $height !== $otherHeight) {
            throw new \InvalidArgumentException('Screenshot dimensions differ.');
        }
        foreach (['x', 'y', 'width', 'height'] as $key) {
            if (!isset($mask[$key]) || !is_int($mask[$key])) {
                throw new \InvalidArgumentException('Mask coordinates must be integers.');
            }
        }
        if ($mask['x'] < 0 || $mask['y'] < 0 || $mask['width'] <= 0 || $mask['height'] <= 0
            || $mask['x'] + $mask['width'] > $width || $mask['y'] + $mask['height'] > $height
            || $mask['width'] * $mask['height'] > $width * $height * 0.18) {
            throw new \InvalidArgumentException('Mask is outside the image or exceeds 18% coverage.');
        }
        $a = imagecreatefrompng($before);
        $b = imagecreatefrompng($after);
        if ($a === false || $b === false) {
            throw new \RuntimeException('PNG decode failed.');
        }
        imagepalettetotruecolor($a);
        imagepalettetotruecolor($b);
        $changed = 0;
        try {
            for ($y = 0; $y < $height; ++$y) {
                for ($x = 0; $x < $width; ++$x) {
                    if ($x >= $mask['x'] && $x < $mask['x'] + $mask['width']
                        && $y >= $mask['y'] && $y < $mask['y'] + $mask['height']) {
                        continue;
                    }
                    $left = imagecolorat($a, $x, $y);
                    $right = imagecolorat($b, $x, $y);
                    foreach ([0, 8, 16, 24] as $shift) {
                        if (abs((($left >> $shift) & 255) - (($right >> $shift) & 255)) > 25) {
                            ++$changed;
                            break;
                        }
                    }
                }
            }
        } finally {
            imagedestroy($a);
            imagedestroy($b);
        }
        $outside = $width * $height - $mask['width'] * $mask['height'];
        $ratio = $changed / $outside;

        return ['outsideChangedPixels' => $changed, 'outsidePixels' => $outside,
            'outsideDriftRatio' => $ratio, 'passed' => $ratio <= 0.0015];
    }
}
