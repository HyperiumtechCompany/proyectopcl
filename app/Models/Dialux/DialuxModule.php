<?php

namespace App\Models\Dialux;

use App\Services\Dialux\V2\ProjectSummaryService;
use Database\Factories\Dialux\DialuxModuleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DialuxModule extends Model
{
    public const MAX_PER_PROJECT = 25;

    public const STATUSES = ['draft', 'in_progress', 'completed', 'archived'];

    /** @use HasFactory<DialuxModuleFactory> */
    use HasFactory;

    protected $fillable = [
        'dialux_project_id',
        'name',
        'description',
        'sort_order',
        'status',
        'data',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn (DialuxModule $module) => app(ProjectSummaryService::class)
            ->invalidateForModule($module));
        static::deleted(fn (DialuxModule $module) => app(ProjectSummaryService::class)
            ->invalidateForModule($module));
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(DialuxProject::class, 'dialux_project_id');
    }

    public function plans(): HasMany
    {
        return $this->hasMany(DialuxPlan::class);
    }

    public function planFiles(): HasMany
    {
        return $this->hasMany(DialuxPlanFile::class);
    }

    public function normativeConfig(): HasOne
    {
        return $this->hasOne(DialuxNormativeConfig::class);
    }

    public function electricalProject(): HasOne
    {
        return $this->hasOne(DialuxElectricalProject::class);
    }
}
