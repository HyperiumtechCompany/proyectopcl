<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcuManoDeObra extends Model
{
    use HasFactory;

    protected $connection = 'costos_tenant';
    protected $table = 'acu_mano_de_obra';

    protected $fillable = [
        'acu_id',
        'insumo_id',
        'descripcion',
        'unidad',
        'cantidad',
        'recursos',
        'precio_unitario',
        'parcial',
        'item_order',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'        => 'decimal:4',
            'recursos'        => 'decimal:4',
            'precio_unitario' => 'decimal:4',
            'parcial'         => 'decimal:4',
        ];
    }

    public function acu(): BelongsTo
    {
        return $this->belongsTo(PresupuestoAcu::class, 'acu_id');
    }

    public function insumo(): BelongsTo
    {
        return $this->belongsTo(InsumoProducto::class, 'insumo_id');
    }
}
