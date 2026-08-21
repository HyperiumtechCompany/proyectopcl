<?php

namespace App\Models\Dialux;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DialuxElectricalNetwork extends Model
{
    protected $fillable = ['dialux_project_id', 'version', 'data'];

    protected function casts(): array
    {
        return ['version' => 'integer', 'data' => 'array'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(DialuxProject::class, 'dialux_project_id');
    }
}
