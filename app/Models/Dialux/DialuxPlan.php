<?php

namespace App\Models\Dialux;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DialuxPlan extends Model
{
    protected $fillable = [
        'dialux_project_id',
        'original_name',
        'mime_type',
        'size_bytes',
        'disk',
        'path',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(DialuxProject::class, 'dialux_project_id');
    }

    public function planFiles(): HasMany
    {
        return $this->hasMany(DialuxPlanFile::class);
    }
}
