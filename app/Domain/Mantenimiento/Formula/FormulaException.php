<?php

namespace App\Domain\Mantenimiento\Formula;

use RuntimeException;

class FormulaException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}
