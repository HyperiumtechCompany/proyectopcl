<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class InsumoProducto extends Model
{
    use HasFactory;

    protected $table = 'insumo_productos';

    protected $fillable = [
        'codigo_producto',
        'descripcion',
        'especificaciones',
        'unidad',
        'costo_unitario_lista',
        'costo_unitario',
        'costo_flete',
        'fecha_lista',
        'insumo_clase_id',
        'tipo',
        'estado',
    ];

    protected function casts(): array
    {
        return [
            'costo_unitario_lista' => 'decimal:4',
            'costo_unitario'       => 'decimal:4',
            'costo_flete'          => 'decimal:4',
            'fecha_lista'          => 'date',
            'estado'               => 'boolean',
        ];
    }

    // ─── Relations ───────────────────────────────────────────────────────────────

    public function clase(): BelongsTo
    {
        return $this->belongsTo(InsumoClase::class, 'insumo_clase_id');
    }

    // ─── Scopes ──────────────────────────────────────────────────────────────────

    /**
     * Filtrar por tipo (mano_de_obra, materiales, equipos).
     */
    public function scopeOfType(Builder $query, string $tipo): Builder
    {
        return $query->where('tipo', $tipo);
    }

    /**
     * Solo productos activos.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('estado', true);
    }

    /**
     * Buscar por descripción o código.
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where(function (Builder $q) use ($term) {
            $q->where('descripcion', 'like', "%{$term}%")
              ->orWhere('codigo_producto', 'like', "%{$term}%");
        });
    }
}
