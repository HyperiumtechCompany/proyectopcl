<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceGgLinea extends CostosTenantModel
{
    use SoftDeletes;

    protected $table = 'mantenimiento_gg_linea';

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function documento(): BelongsTo
    {
        return $this->belongsTo(MaintenanceDocument::class, 'documento_id');
    }
}
