<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Unidad extends Model
{
    protected $table = 'unidad';
    protected $fillable = [
        'descripcion',
        'descripcion_singular',
        'orden',
        'informacion_unidad',
        'abreviatura_unidad'
    ];
}
