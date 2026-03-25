<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class MetradoSanitariasNode extends Model
{
    use HasFactory;
    protected $table = 'metrado_sanitarias_nodes';
    
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
        return $this->belongsTo(MetradoSanitariasNode::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(MetradoSanitariasNode::class, 'parent_id')->orderBy('position');
    }

    public function values(): HasMany
    {
        return $this->hasMany(MetradoSanitariasValue::class, 'node_id');
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

    public function isPartida(): bool
    {
        return $this->node_type === 'partida';
    }

    // ─── Hierarchy Methods ───────────────────────────────────────────────────

    public function canHaveChildren(): bool
    {
        return $this->isTitle() || $this->isSubtitle();
    }

    public function getInheritedUnit(): ?string
    {
        // If this node has a unit defined, return it
        if ($this->unit !== null) {
            return $this->unit;
        }

        // If this is a root node, no inherited unit
        if ($this->parent_id === null) {
            return null;
        }

        // Recursively check parent for unit
        $parent = $this->parent;
        if ($parent) {
            return $parent->getInheritedUnit();
        }

        return null;
    }

    public function getDescendants(): Collection
    {
        $descendants = new Collection();

        foreach ($this->children as $child) {
            $descendants->push($child);
            $descendants = $descendants->merge($child->getDescendants());
        }

        return $descendants;
    }
}
