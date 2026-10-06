<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CuadernoVinculo extends Model
{
    protected $hidden = ['session_key'];

    protected $appends = ['tiene_sesion'];

    protected $fillable = [
        'entidad', 'obra', 'contrato', 'codigo_cui', 'rol', 'external_id',
    ];

    protected function casts(): array
    {
        return [
            'active_slot' => 'integer',
            'revoked_at' => 'datetime',
            'session_key' => 'encrypted',
            'cuadernos_disponibles' => 'array',
            'sync_completa' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }

    /** Exposes whether a connector session exists without decrypting or returning its key. */
    protected function tieneSesion(): Attribute
    {
        return Attribute::get(fn (): bool => filled($this->attributes['session_key'] ?? null));
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'costo_project_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function asientos(): HasMany
    {
        return $this->hasMany(CuadernoAsiento::class);
    }
}
