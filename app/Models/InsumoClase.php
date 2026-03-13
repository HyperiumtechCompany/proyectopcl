<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InsumoClase extends Model
{
    use HasFactory;

    protected $table = 'insumo_clases';

    protected $fillable = [
        'codigo',
        'descripcion',
    ];

    // ─── Relations ───────────────────────────────────────────────────────────────

    public function productos(): HasMany
    {
        return $this->hasMany(InsumoProducto::class, 'insumo_clase_id');
    }
}
