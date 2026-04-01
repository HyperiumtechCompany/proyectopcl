<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * ETTP Partida — Registro maestro por partida de especificación técnica.
 * Vive en la BD del tenant (costos_tenant).
 * Se importa desde los resúmenes de metrados por especialidad.
 */
class EttpPartida extends Model
{
    protected $connection = 'costos_tenant';
    protected $table = 'ettp_partidas';

    protected $fillable = [
        'presupuesto_id',
        'especialidad',
        'item',
        'partida',
        'descripcion',
        'unidad',
        'resumen_source_id',
        'resumen_source_table',
        'parent_id',
        'nivel',
        'item_order',
        'estado',
        'huerfano',
    ];

    protected $casts = [
        'huerfano' => 'boolean',
        'nivel'    => 'integer',
        'item_order' => 'integer',
    ];

    // ── Relaciones ──

    /**
     * Obtiene los datos del presupuesto asociado desde la BD tenant.
     */
    public function getPresupuestoAttribute()
    {
        if (!$this->presupuesto_id) return null;
        return DB::connection('costos_tenant')
            ->table('presupuestos')
            ->where('id', $this->presupuesto_id)
            ->first();
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('item_order');
    }

    public function secciones(): HasMany
    {
        return $this->hasMany(EttpSeccion::class, 'ettp_partida_id')->orderBy('orden');
    }

    // ── Scopes ──

    public function scopeEspecialidad($query, string $especialidad)
    {
        return $query->where('especialidad', $especialidad);
    }

    public function scopeHuerfanas($query)
    {
        return $query->where('huerfano', true);
    }

    public function scopeActivas($query)
    {
        return $query->where('huerfano', false);
    }

    public function scopeRaices($query)
    {
        return $query->whereNull('parent_id');
    }
}
