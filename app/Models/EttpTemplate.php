<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * ETTP Template — Plantilla reutilizable de especificación técnica.
 * Vive en la BD principal (global), compartida entre todos los proyectos.
 */
class EttpTemplate extends Model
{
    protected $table = 'ettp_templates';

    protected $fillable = [
        'codigo',
        'titulo',
        'especialidad',
        'categoria',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    // ── Relaciones ──

    public function secciones(): HasMany
    {
        return $this->hasMany(EttpTemplateSeccion::class, 'ettp_template_id')->orderBy('orden');
    }

    // ── Scopes ──

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeEspecialidad($query, string $especialidad)
    {
        return $query->where('especialidad', $especialidad);
    }

    public function scopePorCodigo($query, string $codigo)
    {
        return $query->where('codigo', $codigo);
    }

    /**
     * Busca un template por código y especialidad.
     */
    public static function buscarPorPartida(string $codigo, string $especialidad): ?self
    {
        return static::activos()
            ->especialidad($especialidad)
            ->porCodigo($codigo)
            ->with('secciones')
            ->first();
    }
}
