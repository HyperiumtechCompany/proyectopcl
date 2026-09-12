<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenanceScenario extends CostosTenantModel
{
    protected $table = 'mantenimiento_escenarios';

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    protected function casts(): array
    {
        return ['es_activo' => 'boolean'];
    }

    public function documento(): BelongsTo
    {
        return $this->belongsTo(MaintenanceDocument::class, 'documento_id');
    }

    public function moPartidas(): HasMany
    {
        return $this->hasMany(MaintenanceMoPartida::class, 'escenario_id');
    }

    public function moSeries(): HasMany
    {
        return $this->hasMany(MaintenanceMoSeries::class, 'escenario_id')->orderBy('indice');
    }

    public function matCotizaciones(): HasMany
    {
        return $this->hasMany(MaintenanceMatCotizacion::class, 'escenario_id');
    }

    public function matCompras(): HasMany
    {
        return $this->hasMany(MaintenanceMatCompra::class, 'escenario_id')->orderBy('indice');
    }

    public function ggPagos(): HasMany
    {
        return $this->hasMany(MaintenanceGgPago::class, 'escenario_id')->orderBy('indice');
    }
}
