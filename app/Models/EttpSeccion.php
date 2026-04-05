<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ETTP Sección — Sección variable de una partida de especificación técnica.
 * Cada partida tiene N secciones (Descripción, Materiales, Método, etc.)
 * El contenido puede ser texto extenso, listas, HTML.
 */
class EttpSeccion extends Model
{
    protected $connection = 'costos_tenant';
    protected $table = 'ettp_secciones';

    protected $fillable = [
        'ettp_partida_id',
        'titulo',
        'slug',
        'contenido',
        'origen',
        'orden',
    ];

    protected $casts = [
        'orden' => 'integer',
    ];

    protected static function booted(): void
    {
        static::deleting(function (EttpSeccion $seccion) {
            foreach ($seccion->imagenes()->get() as $imagen) {
                $imagen->delete();
            }
        });
    }

    // ── Relaciones ──

    public function partida(): BelongsTo
    {
        return $this->belongsTo(EttpPartida::class, 'ettp_partida_id');
    }

    public function imagenes(): HasMany
    {
        return $this->hasMany(EttpImagen::class, 'ettp_seccion_id')->orderBy('orden');
    }

    // ── Helpers ──

    /**
     * Genera el slug a partir del título.
     */
    public static function generarSlug(string $titulo): string
    {
        $slug = mb_strtolower($titulo, 'UTF-8');
        $slug = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'],
            ['a', 'e', 'i', 'o', 'u', 'n', 'u'],
            $slug
        );
        $slug = preg_replace('/[^a-z0-9]+/', '_', $slug);
        return trim($slug, '_');
    }

    /**
     * Secciones default que se crean al importar una partida.
     */
    public static function seccionesDefault(): array
    {
        return [
            ['titulo' => 'Descripción',               'slug' => 'descripcion',      'orden' => 1],
            ['titulo' => 'Materiales y Herramientas',  'slug' => 'materiales',       'orden' => 2],
            ['titulo' => 'Método de Ejecución',        'slug' => 'metodo_ejecucion', 'orden' => 3],
            ['titulo' => 'Método de Medición',         'slug' => 'metodo_medicion',  'orden' => 4],
            ['titulo' => 'Condiciones de Pago',        'slug' => 'condiciones_pago', 'orden' => 5],
        ];
    }
}
