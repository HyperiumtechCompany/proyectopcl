<?php

namespace App\Models\Dialux;

use App\Models\Concerns\InvalidatesDialuxProjectSummary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DialuxPlan extends Model
{
    use InvalidatesDialuxProjectSummary;

    protected $fillable = [
        'dialux_project_id',
        'dialux_module_id',
        'original_name',
        'mime_type',
        'size_bytes',
        'disk',
        'path',
        'light_status',
        'light_path',
        'light_size_bytes',
        'light_error',
    ];

    /** ¿Es un plano CAD que el navegador no puede abrir y necesita su versión ligera? */
    public function needsLightVersion(): bool
    {
        $extension = strtolower(pathinfo($this->path, PATHINFO_EXTENSION));
        $threshold = config("dialux.plan_light.threshold_bytes.{$extension}");

        return is_numeric($threshold) && $this->size_bytes > (int) $threshold;
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(DialuxProject::class, 'dialux_project_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(DialuxModule::class, 'dialux_module_id');
    }

    public function planFiles(): HasMany
    {
        return $this->hasMany(DialuxPlanFile::class);
    }
}
