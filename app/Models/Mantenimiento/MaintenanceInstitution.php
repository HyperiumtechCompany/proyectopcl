<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenanceInstitution extends CostosTenantModel
{
    protected $table = 'mantenimiento_instituciones';

    public function documento(): BelongsTo
    {
        return $this->belongsTo(MaintenanceDocument::class, 'documento_id');
    }

    public function partidas(): HasMany
    {
        return $this->hasMany(MaintenancePartida::class, 'institucion_id')->orderBy('sort_order');
    }
}
