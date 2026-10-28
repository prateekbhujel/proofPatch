<?php

declare(strict_types=1);

function orderTotal(array $items): int
{
    $total = 0;
    foreach ($items as $item) {
        $total += $item['unit_price'] * max(1, $item['quantity']);
    }

    return $total;
}
