<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ProofPatch\Support\LocalProcess;

final class LocalProcessTest extends TestCase
{
    public function testChildProcessDoesNotInheritPrivateEnvironmentValues(): void
    {
        $key = 'PROOFPATCH_PRIVATE_TEST_SECRET';
        $previous = getenv($key);
        putenv($key.'=test-only-sentinel');
        try {
            $output = LocalProcess::output([PHP_BINARY, '-r', 'echo json_encode([getenv("PROOFPATCH_PRIVATE_TEST_SECRET"), getenv("PATH") !== false]);']);
            self::assertSame([false, true], json_decode($output, true, 8, JSON_THROW_ON_ERROR));
        } finally {
            putenv($previous === false ? $key : $key.'='.$previous);
        }
    }
}
