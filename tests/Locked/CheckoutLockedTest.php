<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Locked;

use PHPUnit\Framework\TestCase;
use ProofPatch\Browser\CheckoutProbe;

final class CheckoutLockedTest extends TestCase
{
    private static array $observation;

    public static function setUpBeforeClass(): void
    {
        $directory = getenv('CHECKOUT_ARTIFACT_DIR') ?: throw new \RuntimeException('Missing artifact directory.');
        $probe = new CheckoutProbe(
            getenv('CHECKOUT_DRIVER') ?: throw new \RuntimeException('Missing driver path.'),
            getenv('PANTHER_CHROME_BINARY') ?: null,
        );
        self::$observation = $probe->inspect(
            getenv('CHECKOUT_URL') ?: throw new \RuntimeException('Missing fixture URL.'),
            $directory.'/checkout.png',
        );
        file_put_contents($directory.'/observation.json', json_encode(self::$observation, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)."\n");
    }

    public function testShippingChangesOnlyAfterTrustedPointerInput(): void
    {
        self::assertSame('Standard', self::$observation['initial']);
        self::assertTrue(self::$observation['pointer']['trusted']);
        self::assertSame(420, self::$observation['pointer']['x']);
        self::assertSame(320, self::$observation['pointer']['y']);
        self::assertSame('Express Next-Day', self::$observation['selected']);
    }

    public function testShippingOfferRemainsVisibleAndInteractive(): void
    {
        self::assertTrue(self::$observation['banner']['visible']);
        self::assertEquals(48, self::$observation['banner']['height']);
        self::assertTrue(self::$observation['neighborWorks']);
    }

    public function testViewportIsDeterministic(): void
    {
        self::assertSame(1280, self::$observation['viewport']['width']);
        self::assertSame(720, self::$observation['viewport']['height']);
        self::assertEquals(1, self::$observation['viewport']['scale']);
    }
}
