<?php

namespace App\Models\Mantenimiento;

use App\Models\CostosTenantModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceOperation extends CostosTenantModel
{
    protected $table = 'mantenimiento_operaciones';

    protected function casts(): array
    {
        return ['payload' => 'array', 'result' => 'array'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(MaintenanceDocument::class, 'documento_id');
    }
}
