<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ProofPatch\Patch\CssPatch;

final class CssPatchTest extends TestCase
{
    private const SOURCE = '<style>.box { pointer-events: auto; }</style><button>Submit</button>';

    private function input(): array
    {
        return ['file' => CssPatch::FILE, 'baseSha256' => hash('sha256', self::SOURCE),
            'find' => 'pointer-events: auto;', 'replace' => 'pointer-events: none;'];
    }

    public function testAppliesOneBoundedStylesheetChange(): void
    {
        $patch = CssPatch::fromArray($this->input());
        self::assertSame('<style>.box { pointer-events: none; }</style><button>Submit</button>', $patch->apply(self::SOURCE));
        self::assertSame($this->input(), $patch->toArray());
    }

    #[DataProvider('unsafeInputs')]
    public function testRejectsUnsafeOrMalformedInput(array $changes): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CssPatch::fromArray(array_merge($this->input(), $changes));
    }

    public static function unsafeInputs(): iterable
    {
        yield 'path traversal' => [['file' => '../tests/Locked/CheckoutLockedTest.php']];
        yield 'protected test' => [['file' => 'tests/Locked/CheckoutLockedTest.php']];
        yield 'unknown field' => [['allowedMask' => ['width' => 1280]]];
        yield 'bad hash' => [['baseSha256' => 'guess']];
        yield 'HTML injection' => [['replace' => '</style><script>alert(1)</script>']];
        yield 'external CSS' => [['replace' => 'background: url(https://example.com/);']];
        yield 'CSS import' => [['replace' => '@import "https://example.com/";']];
        yield 'escaped CSS' => [['replace' => 'background: u\\rl(test);']];
        yield 'oversized text' => [['replace' => str_repeat('a', 4097)]];
        yield 'non-string text' => [['replace' => ['pointer-events' => 'none']]];
        yield 'no change' => [['replace' => 'pointer-events: auto;']];
    }

    public function testRejectsAStaleBase(): void
    {
        $patch = CssPatch::fromArray($this->input());
        $this->expectException(\InvalidArgumentException::class);
        $patch->apply(self::SOURCE.' ');
    }

    public function testRejectsAnAmbiguousReplacement(): void
    {
        $source = '<style>.a{color:red;}.b{color:red;}</style>';
        $patch = CssPatch::fromArray(['file' => CssPatch::FILE, 'baseSha256' => hash('sha256', $source),
            'find' => 'color:red;', 'replace' => 'color:blue;']);
        $this->expectException(\InvalidArgumentException::class);
        $patch->apply($source);
    }

    public function testRejectsChangesOutsideTheStylesheet(): void
    {
        $patch = CssPatch::fromArray(array_merge($this->input(), ['find' => 'Submit', 'replace' => 'Continue']));
        $this->expectException(\InvalidArgumentException::class);
        $patch->apply(self::SOURCE);
    }
}
