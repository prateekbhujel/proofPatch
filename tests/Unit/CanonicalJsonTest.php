<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ProofPatch\Evidence\CanonicalJson;

final class CanonicalJsonTest extends TestCase
{
    public function testStableNestedBytesAndUnmodifiedInput(): void
    {
        $object = (object) ['z' => true, 'a' => ['y' => null, 'b' => 'नेपाल/checkout']];
        $expected = '{"a":{"b":"नेपाल/checkout","y":null},"z":true}';
        self::assertSame($expected, CanonicalJson::encode($object));
        self::assertSame($expected, CanonicalJson::encode(['a' => ['b' => 'नेपाल/checkout', 'y' => null], 'z' => true]));
        self::assertSame(['z', 'a'], array_keys(get_object_vars($object)));
    }

    public function testListsEmptyContainersAndBytewiseKeys(): void
    {
        self::assertSame('[3,1,2]', CanonicalJson::encode([3, 1, 2]));
        self::assertSame('[]', CanonicalJson::encode([]));
        self::assertSame('{}', CanonicalJson::encode(new \stdClass()));
        self::assertSame('{"A":1,"Z":2,"a":3}', CanonicalJson::encode(['a' => 3, 'Z' => 2, 'A' => 1]));
        self::assertSame('{"0":"zero"}', CanonicalJson::encode((object) ['0' => 'zero']));
    }

    #[DataProvider('invalidValues')]
    public function testRejectsUnsupportedInput(mixed $value): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CanonicalJson::encode($value);
    }

    public static function invalidValues(): iterable
    {
        yield 'float' => [1.0];
        yield 'nan' => [NAN];
        yield 'infinity' => [INF];
        yield 'other class' => [new \DateTimeImmutable()];
        yield 'stdClass subclass' => [new class extends \stdClass {}];
        yield 'integer map key' => [[2 => 'two']];
        yield 'mixed map keys' => [['a' => true, 3 => false]];
        yield 'invalid UTF-8 value' => ["\xFF"];
        yield 'invalid UTF-8 key' => [["\xFF" => 1]];
    }

    public function testRejectsResource(): void
    {
        $stream = fopen('php://memory', 'r+');
        try {
            $this->expectException(\InvalidArgumentException::class);
            CanonicalJson::encode($stream);
        } finally {
            fclose($stream);
        }
    }

    public function testEnforcesTheExactNestingLimit(): void
    {
        $value = 1;
        for ($i = 0; $i < 32; ++$i) {
            $value = [$value];
        }
        self::assertSame(str_repeat('[', 32).'1'.str_repeat(']', 32), CanonicalJson::encode($value));
        $this->expectException(\InvalidArgumentException::class);
        CanonicalJson::encode([$value]);
    }

    public function testRejectsCyclesWithoutMutatingObjects(): void
    {
        $value = new \stdClass();
        $value->self = $value;
        try {
            CanonicalJson::encode($value);
            self::fail('A cyclic object was accepted.');
        } catch (\InvalidArgumentException) {
            self::assertSame($value, $value->self);
        }
    }

    public function testRepeatedObjectsAreNotTreatedAsCycles(): void
    {
        $item = (object) ['b' => 2, 'a' => 1];
        self::assertSame('[{"a":1,"b":2},{"a":1,"b":2}]', CanonicalJson::encode([$item, $item]));
    }

    public function testRejectsAnArrayCycle(): void
    {
        $value = [];
        $value[] = &$value;
        $this->expectException(\InvalidArgumentException::class);
        CanonicalJson::encode($value);
    }
}
