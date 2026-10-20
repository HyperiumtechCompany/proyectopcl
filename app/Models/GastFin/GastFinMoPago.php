<?php

namespace App\Models\GastFin;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GastFinMoPago extends CostosTenantModel
{
    protected $table = 'gastfin_mo_pagos';

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function valores(): HasMany
    {
        return $this->hasMany(GastFinMoPagoValor::class, 'pago_id');
    }
}
