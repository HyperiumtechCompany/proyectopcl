<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CuadernoReferencia extends Model
{
    protected $fillable = ['origen_asiento_id', 'destino_asiento_id'];

    public function origen(): BelongsTo
    {
        return $this->belongsTo(CuadernoAsiento::class, 'origen_asiento_id');
    }

    public function destino(): BelongsTo
    {
        return $this->belongsTo(CuadernoAsiento::class, 'destino_asiento_id');
    }
}
