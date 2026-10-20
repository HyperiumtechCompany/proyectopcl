<?php

namespace App\Domain\GastFin;

use App\Domain\Mantenimiento\Formula\DecimalMath;

/**
 * Montos de salida a 2 decimales fijos. No usar DecimalMath::round() directo para salida: recorta
 * ceros de cola ("2000.00" → "2000"), mismo gotcha documentado en las calculators de Mantenimiento.
 */
final class Cents
{
    public static function of(?string $decimal): int
    {
        if ($decimal === null || $decimal === '') {
            return 0;
        }

        $rounded = (new DecimalMath)->round($decimal, 2);
        $negative = str_starts_with($rounded, '-');
        [$units, $frac] = array_pad(explode('.', ltrim($rounded, '-'), 2), 2, '0');
        $cents = (int) $units * 100 + (int) substr($frac.'00', 0, 2);

        return $negative ? -$cents : $cents;
    }

    public static function format(int $cents): string
    {
        $negative = $cents < 0;
        $cents = abs($cents);

        return ($negative ? '-' : '').intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    /** Decimal con escala fija (cantidades a 4, precios a 4) para mostrar sin recortar ceros. */
    public static function fixed(?string $decimal, int $scale): ?string
    {
        if ($decimal === null || $decimal === '') {
            return null;
        }

        return bcadd((new DecimalMath)->round($decimal, $scale), '0', $scale);
    }
}
