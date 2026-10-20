<?php

namespace App\Models\GastFin;

use App\Models\CostosTenantModel;

class GastFinGrupo extends CostosTenantModel
{
    protected $table = 'gastfin_grupos';

    protected function casts(): array
    {
        return ['mo_aprobado_minor' => 'integer', 'mat_aprobado_minor' => 'integer'];
    }
}
