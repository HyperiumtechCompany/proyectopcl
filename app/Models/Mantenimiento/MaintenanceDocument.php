<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceDocument extends CostosTenantModel
{
    use SoftDeletes;

    protected $table = 'mantenimiento_documentos';

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    protected function casts(): array
    {
        return ['config' => 'array', 'parametros' => 'array'];
    }

    public function instituciones(): HasMany
    {
        return $this->hasMany(MaintenanceInstitution::class, 'documento_id')->orderBy('sort_order');
    }

    public function partidas(): HasMany
    {
        return $this->hasMany(MaintenancePartida::class, 'documento_id')->orderBy('sort_order');
    }

    public function escenarios(): HasMany
    {
        return $this->hasMany(MaintenanceScenario::class, 'documento_id')->orderBy('sort_order');
    }

    public function matMateriales(): HasMany
    {
        return $this->hasMany(MaintenanceMatMaterial::class, 'documento_id')->orderBy('sort_order');
    }

    public function ggLineas(): HasMany
    {
        return $this->hasMany(MaintenanceGgLinea::class, 'documento_id')->orderBy('sort_order');
    }

    public function operations(): HasMany
    {
        return $this->hasMany(MaintenanceOperation::class, 'documento_id');
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(MaintenanceSnapshot::class, 'documento_id');
    }
}
