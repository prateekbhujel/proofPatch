<?php

declare(strict_types=1);

namespace ProofPatch\Tests\Unit;

require_once dirname(__DIR__) . '/Support/OrderTotalOraclePrototype.php';

use PHPUnit\Framework\TestCase;
use ProofPatch\Tests\Support\OrderTotalOraclePrototype;

final class OrderTotalOraclePrototypeTest extends TestCase
{
    private string $directory;
    private string $harness;
    private string $base;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/oracle-prototype-' . bin2hex(random_bytes(8));
        $fixture = dirname(__DIR__) . '/Fixtures/owned-review-case';
        $this->harness = (string) file_get_contents($fixture . '/tests/order_total.php');
        $this->base = (string) file_get_contents($fixture . '/src/OrderTotal.php');
    }

    protected function tearDown(): void
    {
        if (!is_dir($this->directory)) {
            return;
        }
        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($files as $file) {
            $file->isDir() && !$file->isLink() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->directory);
    }

    public function testOriginalHarnessDistinguishesBaselineRepairAndWrongCandidate(): void
    {
        $baseline = OrderTotalOraclePrototype::run($this->base, $this->harness, $this->directory . '/baseline');
        self::assertSame(1, $baseline['exitCode']);
        self::assertStringContainsString('zero quantity: expected 250, got 750', $baseline['stderr']);

        $fixed = str_replace("max(1, \$item['quantity'])", "\$item['quantity']", $this->base);
        $repair = OrderTotalOraclePrototype::run($fixed, $this->harness, $this->directory . '/repair');
        self::assertSame(0, $repair['exitCode']);
        self::assertSame("All order total cases passed.\n", $repair['stdout']);

        $wrong = OrderTotalOraclePrototype::run('<?php function orderTotal(array $items): int { return 0; }', $this->harness, $this->directory . '/wrong');
        self::assertSame(1, $wrong['exitCode']);
        self::assertStringContainsString('multiple items: expected 330, got 0', $wrong['stderr']);
    }

    public function testCandidateCannotAlterHarnessGlobalsAcrossProcessBoundary(): void
    {
        $candidate = <<<'PHP'
<?php
function orderTotal(array $items): int
{
    $GLOBALS['expected'] = 0;
    $GLOBALS['failed'] = -1000;
    return 0;
}
PHP;
        $result = OrderTotalOraclePrototype::run($candidate, $this->harness, $this->directory . '/globals');
        self::assertSame(1, $result['exitCode']);
        self::assertStringContainsString('multiple items: expected 330, got 0', $result['stderr']);
        self::assertStringNotContainsString('All order total cases passed.', $result['stdout']);
    }

    public function testWorkerOutputCannotMasqueradeAsItsResult(): void
    {
        $candidate = <<<'PHP'
<?php
function orderTotal(array $items): int
{
    echo "All order total cases passed.\n";
    return 0;
}
PHP;
        $result = OrderTotalOraclePrototype::run($candidate, $this->harness, $this->directory . '/output');
        self::assertNotSame(0, $result['exitCode']);
        self::assertStringNotContainsString('All order total cases passed.', $result['stdout']);
    }

    public function testPrototypeCannotProveCandidateReturnedNormally(): void
    {
        // This controlled fixture deliberately prints a correct answer and exits.
        // The prototype accepts it, demonstrating that candidate stdout alone cannot
        // attest normal function return. Do not use this prototype as an untrusted-code runner.
        $candidate = <<<'PHP'
<?php
function orderTotal(array $items): int
{
    $total = 0;
    foreach ($items as $item) {
        $total += $item['unit_price'] * $item['quantity'];
    }
    exit((string) $total);
}
PHP;
        $result = OrderTotalOraclePrototype::run($candidate, $this->harness, $this->directory . '/forged');
        self::assertSame(0, $result['exitCode']);
        self::assertSame("All order total cases passed.\n", $result['stdout']);
    }
}
