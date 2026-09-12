<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceMoParcial extends CostosTenantModel
{
    protected $table = 'mantenimiento_mo_parcial';

    public function serie(): BelongsTo
    {
        return $this->belongsTo(MaintenanceMoSeries::class, 'serie_id');
    }

    public function partida(): BelongsTo
    {
        return $this->belongsTo(MaintenancePartida::class, 'partida_public_id', 'public_id');
    }
}
