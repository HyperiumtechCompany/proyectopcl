<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * ETTP Imagen — Imagen asociada a una sección de especificación técnica.
 * Los archivos se almacenan localmente en storage/app/public/ettp/{presupuesto_id}/
 * La BD guarda solo el nombre del archivo.
 * Al eliminar el registro, se elimina el archivo físico.
 */
class EttpImagen extends Model
{
    protected $connection = 'costos_tenant';
    protected $table = 'ettp_imagenes';

    protected $fillable = [
        'ettp_seccion_id',
        'nombre_archivo',
        'nombre_original',
        'caption',
        'orden',
        'ancho',
        'alto',
    ];

    protected $casts = [
        'orden' => 'integer',
        'ancho' => 'integer',
        'alto'  => 'integer',
    ];

    // ── Relaciones ──

    public function seccion(): BelongsTo
    {
        return $this->belongsTo(EttpSeccion::class, 'ettp_seccion_id');
    }

    // ── Accessors ──

    /**
     * Retorna la ruta completa del directorio de almacenamiento.
     */
    public function getStoragePathAttribute(): string
    {
        $presupuestoId = $this->seccion?->partida?->presupuesto_id ?? 'sin_presupuesto';
        return "ettp/{$presupuestoId}";
    }

    /**
     * Retorna la ruta completa del archivo.
     */
    public function getFullPathAttribute(): string
    {
        return $this->storage_path . '/' . $this->nombre_archivo;
    }

    /**
     * Retorna la URL pública del archivo.
     */
    public function getUrlAttribute(): string
    {
        $presupuestoId = $this->seccion?->partida?->presupuesto_id ?? 'sin_presupuesto';
        return asset("storage/ettp/{$presupuestoId}/{$this->nombre_archivo}");
    }

    // ── Lifecycle ──

    protected static function booted(): void
    {
        // Eliminar archivo físico al eliminar el registro
        static::deleting(function (EttpImagen $imagen) {
            if (\Illuminate\Support\Facades\Storage::disk('public')->exists($imagen->full_path)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($imagen->full_path);
            }
        });
    }
}
