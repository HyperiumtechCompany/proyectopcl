<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ETTP Template Sección — Sección predefinida de un template global.
 * Vive en la BD principal (global).
 */
class EttpTemplateSeccion extends Model
{
    protected $table = 'ettp_template_secciones';

    protected $fillable = [
        'ettp_template_id',
        'titulo',
        'slug',
        'contenido_default',
        'orden',
    ];

    protected $casts = [
        'orden' => 'integer',
    ];

    // ── Relaciones ──

    public function template(): BelongsTo
    {
        return $this->belongsTo(EttpTemplate::class, 'ettp_template_id');
    }
}
