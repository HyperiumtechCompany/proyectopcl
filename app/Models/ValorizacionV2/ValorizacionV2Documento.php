<?php

namespace App\Models\ValorizacionV2;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Datos de entrada de la Valorización v2 de una obra (JSON). Ver la migración
 * 2026_10_05_000010 en database/migrations/costos_tenant.
 */
class ValorizacionV2Documento extends CostosTenantModel
{
    protected $table = 'valorizacion_v2_documentos';

    protected function casts(): array
    {
        return ['datos' => 'array', 'revision' => 'integer', 'schema_version' => 'integer'];
    }

    public function cortes(): HasMany
    {
        return $this->hasMany(ValorizacionV2Corte::class, 'documento_id')->orderBy('numero');
    }
}
