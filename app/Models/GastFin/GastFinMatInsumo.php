<?php

namespace App\Models\GastFin;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GastFinMatInsumo extends CostosTenantModel
{
    protected $table = 'gastfin_mat_insumos';

    protected function casts(): array
    {
        return ['manual' => 'boolean'];
    }

    public function valores(): HasMany
    {
        return $this->hasMany(GastFinMatCompraValor::class, 'insumo_id');
    }
}
