<?php

namespace App\Domain\Mantenimiento\Import;

use App\Models\CostoProject;

interface PresupuestoSource
{
    /** @return array<string, mixed> */
    public function snapshot(CostoProject $project): array;
}
