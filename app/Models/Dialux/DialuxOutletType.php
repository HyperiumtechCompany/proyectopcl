<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DialuxOutletType
 *
 * Tipo de tomacorriente con altura de instalación configurable (RN-04).
 * user_id null = tipo por defecto del sistema; con user_id = tipo del usuario.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $name
 * @property string $code
 * @property float|null $height_m
 * @property string|null $height_label
 * @property string|null $use_description
 * @property string|null $ip_rating
 * @property string|null $box_type
 * @property string|null $notes
 */
class DialuxOutletType extends Model
{
    protected $table = 'dialux_outlet_types';

    protected $fillable = [
        'user_id',
        'name',
        'code',
        'height_m',
        'height_label',
        'use_description',
        'ip_rating',
        'box_type',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'height_m' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
