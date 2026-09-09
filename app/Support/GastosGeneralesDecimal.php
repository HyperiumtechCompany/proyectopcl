<?php

namespace App\Support;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final class GastosGeneralesDecimal
{
    public static function of(mixed $value): BigDecimal
    {
        if ($value instanceof BigDecimal) {
            return $value;
        }

        if (! is_numeric($value)) {
            return BigDecimal::zero();
        }

        return BigDecimal::of((string) $value);
    }

    public static function add(mixed ...$values): BigDecimal
    {
        $total = BigDecimal::zero();

        foreach ($values as $value) {
            $total = $total->plus(self::of($value));
        }

        return $total;
    }

    public static function percent(mixed $base, mixed $percentage): BigDecimal
    {
        return self::of($base)
            ->multipliedBy(self::of($percentage))
            ->dividedBy(100, 12, RoundingMode::HALF_UP);
    }

    public static function percentageOf(mixed $amount, mixed $base): BigDecimal
    {
        $baseDecimal = self::of($base);

        if ($baseDecimal->isZero()) {
            return BigDecimal::zero();
        }

        return self::of($amount)
            ->dividedBy($baseDecimal, 12, RoundingMode::HALF_UP)
            ->multipliedBy(100);
    }

    public static function storage(mixed $value): string
    {
        return self::of($value)->toScale(4, RoundingMode::HALF_UP)->__toString();
    }
}
