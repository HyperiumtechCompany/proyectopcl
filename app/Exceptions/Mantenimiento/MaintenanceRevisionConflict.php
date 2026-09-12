<?php

namespace App\Exceptions\Mantenimiento;

use RuntimeException;

class MaintenanceRevisionConflict extends RuntimeException
{
    public function __construct(public readonly int $serverRevision)
    {
        parent::__construct('El documento cambió en otra sesión.');
    }
}
