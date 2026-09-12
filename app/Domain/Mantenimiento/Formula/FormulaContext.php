<?php

namespace App\Domain\Mantenimiento\Formula;

use Closure;

class FormulaContext
{
    public function __construct(
        public readonly Closure $rowValue,
        public readonly Closure $cellValue,
        public readonly Closure $childrenSum,
        public readonly Closure $columnSum,
    ) {}
}
