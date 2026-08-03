<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DialuxOutletRule
 *
 * Regla configurable de tomacorrientes por tipo de ambiente (RN-03).
 * user_id null = regla por defecto del sistema; con user_id = override del usuario.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $room_type
 * @property string $method
 * @property float $value
 * @property string $unit
 * @property float $power_per_outlet_va
 * @property string|null $notes
 */
class DialuxOutletRule extends Model
{
    protected $table = 'dialux_outlet_rules';

    protected $fillable = [
        'user_id',
        'room_type',
        'method',
        'value',
        'unit',
        'power_per_outlet_va',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'float',
            'power_per_outlet_va' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
