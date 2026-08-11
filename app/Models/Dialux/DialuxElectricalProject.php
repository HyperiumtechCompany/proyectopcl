<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DialuxElectricalProject
 *
 * Documento eléctrico de un proyecto DIALux: pisos, ambientes, luminarias
 * asignadas, tomacorrientes, circuitos, tableros, alimentadores y metrados.
 * Se identifica por el UUID del proyecto (store Zustand) y el usuario.
 *
 * @property int $id
 * @property string $dialux_project_id
 * @property int $user_id
 * @property string $reference_standard
 * @property int $voltage_v
 * @property int $phases
 * @property int $frequency_hz
 * @property array|null $data
 * @property int $total_rooms
 * @property int $total_luminaires
 * @property int $total_outlets
 * @property int $total_panels
 * @property float $installed_power_w
 */
class DialuxElectricalProject extends Model
{
    protected $table = 'dialux_electrical_projects';

    protected $fillable = [
        'dialux_project_id',
        'dialux_module_id',
        'user_id',
        'reference_standard',
        'voltage_v',
        'phases',
        'frequency_hz',
        'data',
        'total_rooms',
        'total_luminaires',
        'total_outlets',
        'total_panels',
        'installed_power_w',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'voltage_v' => 'integer',
            'phases' => 'integer',
            'frequency_hz' => 'integer',
            'data' => 'array',
            'total_rooms' => 'integer',
            'total_luminaires' => 'integer',
            'total_outlets' => 'integer',
            'total_panels' => 'integer',
            'installed_power_w' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(DialuxModule::class, 'dialux_module_id');
    }
}
