<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceMatMaterial extends CostosTenantModel
{
    use SoftDeletes;

    protected $table = 'mantenimiento_mat_material';

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function documento(): BelongsTo
    {
        return $this->belongsTo(MaintenanceDocument::class, 'documento_id');
    }

    public function partida(): BelongsTo
    {
        return $this->belongsTo(MaintenancePartida::class, 'partida_public_id', 'public_id');
    }
}
