<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BalanceItem extends Model
{
    protected $fillable = [
        'balance_id',
        'tipo',
        'categoria',
        'descripcion',
        'ene','feb','mar','abr','may','jun',
        'jul','ago','set','oct','nov','dic',
        'total'
    ];

    public function balance()
    {
        return $this->belongsTo(Balance::class);
    }
}
