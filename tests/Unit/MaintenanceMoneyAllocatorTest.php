<?php

use App\Domain\Mantenimiento\Money\MoneyAllocator;

it('distributes every cent by largest remainder with stable ties', function () {
    $result = (new MoneyAllocator)->allocate(10, ['a' => '1', 'b' => '1', 'c' => '1']);

    expect($result)->toBe(['a' => 4, 'b' => 3, 'c' => 3])
        ->and(array_sum($result))->toBe(10);
});

it('preserves the exact negative total', function () {
    $result = (new MoneyAllocator)->allocate(-7, ['a' => '2', 'b' => '1']);

    expect($result)->toBe(['a' => -5, 'b' => -2])->and(array_sum($result))->toBe(-7);
});
