<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcCalculationCollaborator extends Model
{
    protected $table = 'ac_calculation_collaborators';

    protected $fillable = [
        'ac_calculation_id',
        'user_id',
        'role',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    public function acCalculation(): BelongsTo
    {
        return $this->belongsTo(AcCalculation::class, 'ac_calculation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
