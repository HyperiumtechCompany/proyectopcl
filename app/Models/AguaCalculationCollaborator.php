<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AguaCalculationCollaborator extends Model
{
    protected $table = 'agua_calculation_collaborators';

    protected $fillable = [
        'agua_calculation_id',
        'user_id',
        'role',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    public function calculation(): BelongsTo
    {
        return $this->belongsTo(AguaCalculation::class, 'agua_calculation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
