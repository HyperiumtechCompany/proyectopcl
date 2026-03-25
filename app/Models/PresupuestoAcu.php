<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresupuestoAcu extends Model
{
    use HasFactory;

    protected $connection = 'costos_tenant';
    protected $table = 'presupuesto_acus';

    protected $fillable = [
        'presupuesto_id',
        'partida',
        'descripcion',
        'unidad',
        'rendimiento',
        'mano_de_obra',
        'costo_mano_obra',
        'materiales',
        'costo_materiales',
        'equipos',
        'costo_equipos',
        'subcontratos',
        'costo_subcontratos',
        'subpartidas',
        'costo_subpartidas',
        'item_order',
    ];

    protected function casts(): array
    {
        return [
            'mano_de_obra'       => 'json',
            'materiales'         => 'json',
            'equipos'            => 'json',
            'subcontratos'       => 'json',
            'subpartidas'        => 'json',
            'rendimiento'        => 'decimal:4',
            'costo_mano_obra'    => 'decimal:4',
            'costo_materiales'   => 'decimal:4',
            'costo_equipos'      => 'decimal:4',
            'costo_subcontratos' => 'decimal:4',
            'costo_subpartidas'  => 'decimal:4',
            'costo_unitario_total' => 'decimal:4',
        ];
    }

    // ─── Relations ───────────────────────────────────────────────────────────────

    public function manoDeObraItems(): HasMany
    {
        return $this->hasMany(AcuManoDeObra::class, 'acu_id');
    }

    public function materialesItems(): HasMany
    {
        return $this->hasMany(AcuMaterial::class, 'acu_id');
    }

    public function equiposItems(): HasMany
    {
        return $this->hasMany(AcuEquipo::class, 'acu_id');
    }

    public function subcontratosItems(): HasMany
    {
        return $this->hasMany(AcuSubcontrato::class, 'acu_id');
    }

    public function subpartidasItems(): HasMany
    {
        return $this->hasMany(AcuSubpartida::class, 'acu_id');
    }
}
