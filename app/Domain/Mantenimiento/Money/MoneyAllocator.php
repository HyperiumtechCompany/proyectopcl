<?php

namespace App\Domain\Mantenimiento\Money;

use InvalidArgumentException;

class MoneyAllocator
{
    /** @param array<string, string> $weights */
    public function allocate(int $totalMinor, array $weights): array
    {
        if ($weights === []) {
            return [];
        }
        foreach ($weights as $weight) {
            if (! preg_match('/^\d+(?:\.\d+)?$/', $weight) || bccomp($weight, '0', 10) < 0) {
                throw new InvalidArgumentException('Los pesos deben ser decimales no negativos.');
            }
        }
        $weightTotal = array_reduce($weights, fn (string $sum, string $weight) => bcadd($sum, $weight, 10), '0');
        if (bccomp($weightTotal, '0', 10) === 0) {
            throw new InvalidArgumentException('La suma de pesos debe ser mayor que cero.');
        }

        $absolute = abs($totalMinor);
        $allocated = [];
        $remainders = [];
        foreach ($weights as $id => $weight) {
            $quota = bcdiv(bcmul((string) $absolute, $weight, 20), $weightTotal, 20);
            $base = (int) bcdiv($quota, '1', 0);
            $allocated[$id] = $base;
            $remainders[$id] = bcsub($quota, (string) $base, 20);
        }
        $remaining = $absolute - array_sum($allocated);
        $position = array_flip(array_keys($weights));
        uksort($remainders, fn (string $left, string $right) => bccomp($remainders[$right], $remainders[$left], 20) ?: $position[$left] <=> $position[$right]);
        foreach (array_slice(array_keys($remainders), 0, $remaining) as $id) {
            $allocated[$id]++;
        }
        if ($totalMinor < 0) {
            $allocated = array_map(fn (int $value) => -$value, $allocated);
        }

        return $allocated;
    }
}
