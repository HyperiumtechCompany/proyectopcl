<?php

namespace App\Models\Dialux;

use App\Models\User;
use Database\Factories\Dialux\DialuxProjectFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DialuxProject extends Model
{
    /** @use HasFactory<DialuxProjectFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'client_name',
        'location',
        'project_code',
        'status',
        'consolidated_summary',
        'data',
        'is_demo',
        'demo_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'consolidated_summary' => 'array',
            'is_demo' => 'boolean',
            'demo_expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function planFiles(): HasMany
    {
        return $this->hasMany(DialuxPlanFile::class);
    }

    public function plans(): HasMany
    {
        return $this->hasMany(DialuxPlan::class);
    }

    public function modules(): HasMany
    {
        return $this->hasMany(DialuxModule::class)->orderBy('sort_order');
    }

    public function electricalNetwork(): HasOne
    {
        return $this->hasOne(DialuxElectricalNetwork::class);
    }
}
