<?php

namespace App\Models\GastFin;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GastFinMatCompra extends CostosTenantModel
{
    protected $table = 'gastfin_mat_compras';

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function valores(): HasMany
    {
        return $this->hasMany(GastFinMatCompraValor::class, 'compra_id');
    }
}
