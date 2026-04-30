<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LuminaireProduct extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'manufacturer',
        'catalog_number',
        'article_number',
        'ean_code',
        'description',
        'source_format',
        'source_file_path',
        'source_file_name',
        'product_image_path',
        'brand_logo_path',
        'total_lumens',
        'power_watts',
        'cct',
        'cri_ra',
        'beam_angle_50',
        'beam_angle_10',
        'max_candela',
        'fixture_type',
        'fixture_shape',
        'normative_standard',
        'photometric_summary',
        'photometric_web',
        'report_data',
        'report_assets',
        'dimensions',
        'luminous_opening',
        'metadata',
        'is_global',
    ];

    protected function casts(): array
    {
        return [
            'total_lumens' => 'float',
            'power_watts' => 'float',
            'cri_ra' => 'float',
            'beam_angle_50' => 'float',
            'beam_angle_10' => 'float',
            'max_candela' => 'float',
            'is_global' => 'boolean',
            'photometric_summary' => 'array',
            'photometric_web' => 'array',
            'report_data' => 'array',
            'report_assets' => 'array',
            'dimensions' => 'array',
            'luminous_opening' => 'array',
            'metadata' => 'array',
        ];
    }

    // ─── Relaciones ────────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Solo productos del catálogo global (admin curados).
     */
    public function scopeGlobal($query): mixed
    {
        return $query->where('is_global', true)->whereNull('deleted_at');
    }

    /**
     * Productos importados por un usuario específico.
     *
     * @param  mixed  $query
     */
    public function scopeForUser($query, int $userId): mixed
    {
        return $query->where('user_id', $userId)->whereNull('deleted_at');
    }

    /**
     * Filtra por formato de archivo fuente.
     *
     * @param  mixed  $query
     */
    public function scopeByFormat($query, string $format): mixed
    {
        return $query->where('source_format', $format);
    }

    /**
     * Productos disponibles para un usuario: globales + los propios.
     *
     * @param  mixed  $query
     */
    public function scopeAvailableFor($query, ?int $userId): mixed
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('is_global', true);
            if ($userId) {
                $q->orWhere('user_id', $userId);
            }
        })->whereNull('deleted_at');
    }

    // ─── Accessors ────────────────────────────────────────────────────────────

    /**
     * Eficiencia lumínica derivada (lm/W).
     */
    public function getEfficiencyAttribute(): float
    {
        if (! $this->power_watts || $this->power_watts <= 0.0) {
            return 0.0;
        }

        return round(($this->total_lumens ?? 0) / $this->power_watts, 1);
    }

    /**
     * Tipo de distribución derivada del ángulo de haz.
     */
    public function getDistributionTypeAttribute(): string
    {
        $angle = $this->beam_angle_50;

        if (! $angle) {
            return 'unknown';
        }

        return match (true) {
            $angle <= 20 => 'very-narrow',
            $angle <= 40 => 'narrow',
            $angle <= 70 => 'medium',
            $angle <= 100 => 'wide',
            default => 'very-wide',
        };
    }
}
