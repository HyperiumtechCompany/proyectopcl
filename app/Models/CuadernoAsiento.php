<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CuadernoAsiento extends Model
{
    protected $fillable = [
        'numero', 'titulo', 'tipo', 'fecha_oficial', 'usuario', 'rol', 'estado',
    ];

    /** The private file path is never sent to the browser; `tiene_pdf` says if it exists. */
    protected $hidden = ['pdf_path'];

    protected $appends = ['tiene_pdf'];

    protected function casts(): array
    {
        return [
            'detalle_at' => 'datetime',
            'pdf_at' => 'datetime',
            'pdf_bytes' => 'integer',
        ];
    }

    protected function tienePdf(): Attribute
    {
        return Attribute::get(fn (): bool => filled($this->attributes['pdf_path'] ?? null));
    }

    public function vinculo(): BelongsTo
    {
        return $this->belongsTo(CuadernoVinculo::class, 'cuaderno_vinculo_id');
    }

    public function referencias(): HasMany
    {
        return $this->hasMany(CuadernoReferencia::class, 'origen_asiento_id');
    }

    public function referenciadoPor(): HasMany
    {
        return $this->hasMany(CuadernoReferencia::class, 'destino_asiento_id');
    }
}
