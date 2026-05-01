<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PresupuestoProyecto extends Model
{
    protected $fillable = ['nombre', 'data'];

    protected $casts = [
        'data' => 'array'
    ];
}
