<?php

namespace App\Models\ValorizacionV2;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Copia congelada de los datos al aprobar una valorización (N°01, N°02…). */
class ValorizacionV2Corte extends CostosTenantModel
{
    protected $table = 'valorizacion_v2_cortes';

    protected function casts(): array
    {
        return ['mes' => 'date:Y-m-d', 'resumen' => 'array', 'datos' => 'array', 'numero' => 'integer'];
    }

    public function documento(): BelongsTo
    {
        return $this->belongsTo(ValorizacionV2Documento::class, 'documento_id');
    }
}
