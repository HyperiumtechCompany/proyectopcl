<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GestorProyectoNodo extends Model
{
    use HasFactory;

    protected $fillable = [
        'gestor_proyecto_id',
        'parent_id',
        'title',
        'type',
        'shape',
        'color',
        'status',
        'content',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'order' => 'integer',
        ];
    }

    public function proyecto(): BelongsTo
    {
        return $this->belongsTo(GestorProyecto::class, 'gestor_proyecto_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('order');
    }
}
