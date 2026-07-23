<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DialuxCircuitDefault
 *
 * Sección mínima y parámetros por defecto según tipo de circuito (RN-05).
 * user_id null = valores por defecto del sistema; con user_id = override.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $circuit_type
 * @property string $installation_category
 * @property float $min_section_mm2
 * @property float $max_voltage_drop_pct
 * @property float $demand_factor
 * @property int $breaker_poles
 */
class DialuxCircuitDefault extends Model
{
    protected $table = 'dialux_circuit_defaults';

    protected $fillable = [
        'user_id',
        'circuit_type',
        'installation_category',
        'min_section_mm2',
        'max_voltage_drop_pct',
        'demand_factor',
        'breaker_poles',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'min_section_mm2' => 'float',
            'max_voltage_drop_pct' => 'float',
            'demand_factor' => 'float',
            'breaker_poles' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
