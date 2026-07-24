<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class OutletProduct extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'manufacturer',
        'catalog_number',
        'device_type',
        'rated_power_w',
        'ip_rating',
        'product_image_path',
        'is_global',
    ];

    protected function casts(): array
    {
        return [
            'rated_power_w' => 'integer',
            'is_global' => 'boolean',
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
     * Productos creados por un usuario específico.
     *
     * @param  mixed  $query
     */
    public function scopeForUser($query, int $userId): mixed
    {
        return $query->where('user_id', $userId)->whereNull('deleted_at');
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
}
