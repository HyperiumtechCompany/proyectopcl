<?php

namespace App\Models\Dialux;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DialuxPlanFile extends Model
{
    protected $fillable = [
        'dialux_project_id',
        'dialux_module_id',
        'scene_id',
        'dialux_plan_id',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(DialuxProject::class, 'dialux_project_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(DialuxModule::class, 'dialux_module_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(DialuxPlan::class, 'dialux_plan_id');
    }
}
