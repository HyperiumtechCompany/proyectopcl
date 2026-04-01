<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CostoProjectModule extends Model
{
    use HasFactory;
    protected $fillable = [
        'costo_project_id',
        'module_type',
        'enabled',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'config'  => 'array',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'costo_project_id');
    }
}
