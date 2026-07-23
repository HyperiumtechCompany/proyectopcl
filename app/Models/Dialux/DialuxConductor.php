<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DialuxConductor
 *
 * Conductor del catálogo: sección real en mm² (el AWG es solo referencia).
 * user_id null = conductor por defecto del sistema.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $material
 * @property float $section_mm2
 * @property string|null $awg_ref
 * @property string $insulation
 * @property float $ampacity_a
 * @property float|null $price_per_meter
 */
class DialuxConductor extends Model
{
    protected $table = 'dialux_conductors';

    protected $fillable = [
        'user_id',
        'material',
        'section_mm2',
        'awg_ref',
        'insulation',
        'ampacity_a',
        'price_per_meter',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'section_mm2' => 'float',
            'ampacity_a' => 'float',
            'price_per_meter' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
