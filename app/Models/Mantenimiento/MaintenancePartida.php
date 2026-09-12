<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenancePartida extends CostosTenantModel
{
    use SoftDeletes;

    protected $table = 'mantenimiento_partidas';

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    protected function casts(): array
    {
        return [
            'costos_acu' => 'array',
            'item_entero' => 'boolean',
            'source_updated_at' => 'datetime',
        ];
    }

    public function documento(): BelongsTo
    {
        return $this->belongsTo(MaintenanceDocument::class, 'documento_id');
    }

    public function institucion(): BelongsTo
    {
        return $this->belongsTo(MaintenanceInstitution::class, 'institucion_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_public_id', 'public_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_public_id', 'public_id')->orderBy('sort_order');
    }

    public function moPartidas(): HasMany
    {
        return $this->hasMany(MaintenanceMoPartida::class, 'partida_public_id', 'public_id');
    }
}
