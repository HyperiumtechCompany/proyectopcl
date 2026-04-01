<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ubigeo extends Model
{
    public $timestamps = false;
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'departamento', 'provincia', 'distrito', 'level', 'parent_id'];

    /**
     * Get all departamentos.
     */
    public static function departamentos()
    {
        return static::where('level', 'departamento')->orderBy('departamento')->get();
    }

    /**
     * Get provincias by departamento code (first 2 digits).
     */
    public static function provinciasByDepartamento(string $departamentoId)
    {
        return static::where('level', 'provincia')
            ->where('parent_id', $departamentoId)
            ->orderBy('provincia')
            ->get();
    }

    /**
     * Get distritos by provincia code (first 4 digits).
     */
    public static function distritosByProvincia(string $provinciaId)
    {
        return static::where('level', 'distrito')
            ->where('parent_id', $provinciaId)
            ->orderBy('distrito')
            ->get();
    }
}
