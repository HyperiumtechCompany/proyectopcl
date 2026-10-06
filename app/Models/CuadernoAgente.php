<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CuadernoAgente extends Model
{
    /** Seconds without polling after which a connector counts as off. */
    public const ONLINE_SECONDS = 20;

    protected $hidden = ['token_hash'];

    protected $appends = ['en_linea'];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeActive(Builder $query): void
    {
        $query->whereNull('revoked_at');
    }

    public function scopeOnline(Builder $query): void
    {
        $query->whereNull('revoked_at')->where('last_seen_at', '>=', now()->subSeconds(self::ONLINE_SECONDS));
    }

    public function getEnLineaAttribute(): bool
    {
        return $this->revoked_at === null && $this->last_seen_at?->gte(now()->subSeconds(self::ONLINE_SECONDS)) === true;
    }
}
