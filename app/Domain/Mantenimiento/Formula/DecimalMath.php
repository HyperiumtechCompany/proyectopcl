<?php

namespace App\Domain\Mantenimiento\Formula;

class DecimalMath
{
    public const SCALE = 10;

    public function add(string $left, string $right): string
    {
        return $this->normalize(bcadd($left, $right, self::SCALE));
    }

    public function subtract(string $left, string $right): string
    {
        return $this->normalize(bcsub($left, $right, self::SCALE));
    }

    public function multiply(string $left, string $right): string
    {
        return $this->normalize(bcmul($left, $right, self::SCALE));
    }

    public function divide(string $left, string $right): string
    {
        if (bccomp($right, '0', self::SCALE) === 0) {
            throw new FormulaException('DIV_ZERO', 'No se puede dividir entre cero.');
        }

        return $this->normalize(bcdiv($left, $right, self::SCALE));
    }

    public function compare(string $left, string $right): int
    {
        return bccomp($left, $right, self::SCALE);
    }

    public function round(string $value, int $scale): string
    {
        if ($scale < 0 || $scale > self::SCALE) {
            throw new FormulaException('ARGUMENT_ERROR', 'ROUND acepta entre 0 y 10 decimales.');
        }

        $half = $scale === 0 ? '0.5' : '0.'.str_repeat('0', $scale).'5';
        $adjusted = bccomp($value, '0', self::SCALE) < 0
            ? bcsub($value, $half, self::SCALE + 1)
            : bcadd($value, $half, self::SCALE + 1);

        return $this->normalize(bcdiv($adjusted, '1', $scale));
    }

    public function normalize(string $value): string
    {
        $normalized = bcadd($value, '0', self::SCALE);
        $normalized = rtrim(rtrim($normalized, '0'), '.');

        return $normalized === '' || $normalized === '-0' ? '0' : $normalized;
    }
}
