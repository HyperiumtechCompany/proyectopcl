<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanRequest extends Model
{
    use HasFactory;

    /** Planes de organización/equipo — no se autoaprovisiona una cuenta al aprobarlos. */
    public const BUSINESS_PLANS = ['negocios', 'empresarial'];

    protected $fillable = [
        'nombre',
        'email',
        'plan',
        'empresa',
        'comprobante_path',
        'status',
        'notas_admin',
        'user_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isBusiness(): bool
    {
        return in_array($this->plan, self::BUSINESS_PLANS, true);
    }
}
