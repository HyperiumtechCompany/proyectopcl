<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CuadernoTarea extends Model
{
    use HasUuids;

    protected $hidden = ['payload', 'sesion'];

    protected function casts(): array
    {
        return [
            // The payload may carry the OECE password: encrypted and erased once taken.
            'payload' => 'encrypted:array',
            'sesion' => 'encrypted',
            'result' => 'array',
            'taken_at' => 'datetime',
            'finished_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function agente(): BelongsTo
    {
        return $this->belongsTo(CuadernoAgente::class, 'cuaderno_agente_id');
    }
}
