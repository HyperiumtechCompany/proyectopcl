<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * DialuxNormativeConfig
 *
 * Almacena la configuración normativa de un proyecto DIALux específico.
 * Se identifica por el UUID del proyecto (gestionado en el store Zustand) y el usuario.
 *
 * @property int $id
 * @property string $dialux_project_id
 * @property int $user_id
 * @property string $country_code
 * @property string $region
 * @property string|null $installation_type
 * @property string $primary_standard
 * @property array|null $reference_standards
 * @property array|null $priority_order
 * @property bool $auto_detect_enabled
 * @property bool $cross_norm_comparison_enabled
 * @property int $total_rooms
 * @property int $compliant_rooms
 * @property int $non_compliant_rooms
 * @property int $warning_rooms
 * @property int $needs_review_rooms
 * @property string|null $normative_version
 * @property Carbon|null $norms_consulted_at
 * @property string|null $disclaimer
 * @property string|null $notes
 */
class DialuxNormativeConfig extends Model
{
    protected $table = 'dialux_project_normative_configs';

    protected $fillable = [
        'dialux_project_id',
        'dialux_module_id',
        'user_id',
        'country_code',
        'region',
        'installation_type',
        'primary_standard',
        'reference_standards',
        'priority_order',
        'auto_detect_enabled',
        'cross_norm_comparison_enabled',
        'total_rooms',
        'compliant_rooms',
        'non_compliant_rooms',
        'warning_rooms',
        'needs_review_rooms',
        'normative_version',
        'norms_consulted_at',
        'disclaimer',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reference_standards' => 'array',
            'priority_order' => 'array',
            'auto_detect_enabled' => 'boolean',
            'cross_norm_comparison_enabled' => 'boolean',
            'norms_consulted_at' => 'date',
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
