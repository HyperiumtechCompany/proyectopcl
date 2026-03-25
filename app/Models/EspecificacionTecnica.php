<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EspecificacionTecnica extends Model
{
    protected $table = 'especificaciones_tecnicas';
    
    protected $fillable = [
        'proyecto_id',
        'data',
    ];
    
    protected $casts = [
        'data' => 'array',
    ];
}