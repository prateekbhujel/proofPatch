<?php

declare(strict_types=1);

require __DIR__.'/../src/OrderTotal.php';

$cases = [
    'empty order' => [[], 0],
    'multiple items' => [[['unit_price' => 125, 'quantity' => 2], ['unit_price' => 80, 'quantity' => 1]], 330],
    'zero quantity' => [[['unit_price' => 500, 'quantity' => 0], ['unit_price' => 125, 'quantity' => 2]], 250],
];
$failed = 0;
foreach ($cases as $name => [$items, $expected]) {
    $actual = orderTotal($items);
    if ($actual !== $expected) {
        fwrite(STDERR, "$name: expected $expected, got $actual\n");
        ++$failed;
    }
}
if ($failed > 0) {
    exit(1);
}
echo "All order total cases passed.\n";
