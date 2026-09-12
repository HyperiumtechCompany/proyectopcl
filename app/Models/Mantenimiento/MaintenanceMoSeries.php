<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenanceMoSeries extends CostosTenantModel
{
    protected $table = 'mantenimiento_mo_serie';

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function escenario(): BelongsTo
    {
        return $this->belongsTo(MaintenanceScenario::class, 'escenario_id');
    }

    public function parciales(): HasMany
    {
        return $this->hasMany(MaintenanceMoParcial::class, 'serie_id');
    }
}
