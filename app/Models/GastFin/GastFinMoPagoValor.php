<?php

namespace App\Models\GastFin;

use App\Models\CostosTenantModel;

class GastFinMoPagoValor extends CostosTenantModel
{
    protected $table = 'gastfin_mo_pago_valores';

    protected function casts(): array
    {
        return ['monto_minor' => 'integer'];
    }
}
