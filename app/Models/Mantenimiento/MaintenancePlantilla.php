<?php

namespace App\Models\Mantenimiento;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// A diferencia del resto de modelos de Mantenimiento, este vive en la conexión DEFAULT (no
// costos_tenant): una plantilla debe poder reutilizarse en cualquier proyecto del usuario, y cada
// CostoProject tiene su propia base de datos de tenant aislada.
class MaintenancePlantilla extends Model
{
    protected $table = 'mantenimiento_plantillas';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['estructura' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
