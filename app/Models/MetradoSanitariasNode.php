<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MetradoSanitariasNode extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

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

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'position' => 'integer',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'project_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('position');
    }

    public function values(): HasMany
    {
        return $this->hasMany(MetradoSanitariasValue::class, 'node_id');
    }

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

    public function canHaveChildren(): bool
    {
        return in_array($this->node_type, ['titulo', 'subtitulo'], true);
    }

    /**
     * Unit for this node, falling back to the nearest ancestor's unit.
     */
    public function getInheritedUnit(): ?string
    {
        if ($this->unit !== null) {
            return $this->unit;
        }

        return $this->parent?->getInheritedUnit();
    }

    /**
     * All descendants (children, grandchildren, ...) flattened.
     */
    public function getDescendants(): Collection
    {
        $descendants = new Collection;

        foreach ($this->children as $child) {
            $descendants->push($child);
            $descendants = $descendants->merge($child->getDescendants());
        }

        return $descendants;
    }
}
