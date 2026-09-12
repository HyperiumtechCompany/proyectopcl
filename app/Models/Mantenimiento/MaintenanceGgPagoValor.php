<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceGgPagoValor extends CostosTenantModel
{
    protected $table = 'mantenimiento_gg_pago_valor';

    public function pago(): BelongsTo
    {
        return $this->belongsTo(MaintenanceGgPago::class, 'pago_id');
    }
}
