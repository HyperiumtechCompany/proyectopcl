<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceMoPartida extends CostosTenantModel
{
    protected $table = 'mantenimiento_mo_partida';

    public function escenario(): BelongsTo
    {
        return $this->belongsTo(MaintenanceScenario::class, 'escenario_id');
    }

    public function partida(): BelongsTo
    {
        return $this->belongsTo(MaintenancePartida::class, 'partida_public_id', 'public_id');
    }
}
