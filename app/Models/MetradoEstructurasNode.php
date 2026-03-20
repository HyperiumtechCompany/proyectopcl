<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class MetradoEstructurasNode extends Model
{
    use HasFactory;
    protected $table = 'metrado_estructuras_nodes';
    
    protected $keyType = 'string';
    
    public $incrementing = false;
    
    protected $fillable = [
        'project_id',
        'parent_id',
        'node_type',
        'name',
        'numbering',
        'unit',
        'level',
        'position',
    ];
    
    protected $casts = [
        'level' => 'integer',
        'position' => 'integer',
    ];

    // ─── Boot ────────────────────────────────────────────────────────────────

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function parent(): BelongsTo
    {
        return $this->belongsTo(MetradoEstructurasNode::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(MetradoEstructurasNode::class, 'parent_id')->orderBy('position');
    }

    public function values(): HasMany
    {
        return $this->hasMany(MetradoEstructurasValue::class, 'node_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'project_id');
    }

    // ─── Scopes ──────────────────────────────────────────────────────────────

    public function scopeRootNodes(Builder $query): Builder
    {
        return $query->whereNull('parent_id');
    }

    public function scopeByLevel(Builder $query, int $level): Builder
    {
        return $query->where('level', $level);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('position');
    }

    // ─── Type Check Methods ──────────────────────────────────────────────────

    public function isTitle(): bool
    {
        return $this->node_type === 'titulo';
    }

    public function isSubtitle(): bool
    {
        return $this->node_type === 'subtitulo';
    }
}
