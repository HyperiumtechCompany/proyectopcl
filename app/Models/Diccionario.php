<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Diccionario extends Model
{
    protected $table = 'diccionario';
    protected $fillable = ['codigo', 'descripcion'];
}
