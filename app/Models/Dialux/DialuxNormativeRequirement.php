<?php

namespace App\Models\Dialux;

use Illuminate\Database\Eloquent\Model;

/**
 * DialuxNormativeRequirement
 *
 * Requisito mínimo de iluminación por ambiente según la norma (EM.010 RNE Perú).
 * Catálogo global sembrado desde database/data/normativa_luminarias_peru.json.
 *
 * @property int $id
 * @property string $standard
 * @property string $category_key
 * @property string $category
 * @property string|null $subcategory_key
 * @property string|null $subcategory
 * @property string $area_name
 * @property float|null $em_lux
 * @property int|null $ugrl
 * @property float|null $uo
 * @property int|null $ra
 * @property array|null $requirements
 */
class DialuxNormativeRequirement extends Model
{
    protected $table = 'dialux_normative_requirements';

    protected $fillable = [
        'standard',
        'category_key',
        'category',
        'subcategory_key',
        'subcategory',
        'area_name',
        'em_lux',
        'ugrl',
        'uo',
        'ra',
        'requirements',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'em_lux' => 'float',
            'ugrl' => 'integer',
            'uo' => 'float',
            'ra' => 'integer',
            'requirements' => 'array',
        ];
    }
}
