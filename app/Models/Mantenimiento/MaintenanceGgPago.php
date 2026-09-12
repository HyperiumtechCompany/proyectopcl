<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenanceGgPago extends CostosTenantModel
{
    protected $table = 'mantenimiento_gg_pago';

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

    public function valores(): HasMany
    {
        return $this->hasMany(MaintenanceGgPagoValor::class, 'pago_id');
    }
}
