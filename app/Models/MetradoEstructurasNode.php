<?php

namespace App\Models\Costos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * MetradoElectricasNode
 * 
 * Representa un nodo (grupo o partida) en la estructura jerárquica del metrado eléctrico.
 * Maneja la relación padre-hijo y los niveles de profundidad.
 */
class MetradoElectricasNode extends Model
{
    protected $table = 'metrados_electricos_nodos';
    
    protected $fillable = [
        'project_id',
        'hoja',              // 'metrado' | 'resumen'
        'parent_id',         // null para root, o ID del padre
        'nivel',             // 1-10 (profundidad)
        'tipo_nodo',         // 'group' | 'leaf'
        'orden',             // orden dentro del mismo nivel
        'partida',           // código: 03, 03.01, etc.
        'descripcion',       // descripción con indentación
        'unidad',            // und, m, m2, m3, kg, etc.
        'observacion',
        'expanded',          // estado UI: true/false
    ];
    
    protected $casts = [
        'nivel' => 'integer',
        'orden' => 'integer',
        'expanded' => 'boolean',
    ];
    

    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'project_id');
    }
    

    public function parent(): BelongsTo
    {
        return $this->belongsTo(MetradoElectricasNode::class, 'parent_id');
    }
    

    public function children()
    {
        return $this->hasMany(MetradoElectricasNode::class, 'parent_id')
            ->orderBy('orden');
    }
    
 
    public function scopeGroups($query)
    {
        return $query->where('tipo_nodo', 'group');
    }
 
    public function scopeLeaves($query)
    {
        return $this->where('tipo_nodo', 'leaf');
    }
    

    public function scopeHoja($query, string $hoja)
    {
        return $query->where('hoja', $hoja);
    }

    public function getAllDescendants()
    {
        $descendants = [];
        $children = $this->children()->get();
        
        foreach ($children as $child) {
            $descendants[] = $child;
            $descendants = array_merge($descendants, $child->getAllDescendants());
        }
        
        return $descendants;
    }
    

    public function isRoot(): bool
    {
        return is_null($this->parent_id);
    }
    

    public function isGroup(): bool
    {
        return $this->tipo_nodo === 'group';
    }

    public function isLeaf(): bool
    {
        return $this->tipo_nodo === 'leaf';
    }

    public function generatePartidaCode(): string
    {
        if ($this->isRoot()) {
            return str_pad((string) $this->orden, 2, '0', STR_PAD_LEFT);
        }
        
        $parentCode = $this->parent->partida ?? $this->parent->generatePartidaCode();
        return $parentCode . '.' . str_pad((string) $this->orden, 2, '0', STR_PAD_LEFT);
    }

    public function getIndentation(): string
    {
        $nbsp = "\u{00A0}\u{00A0}\u{00A0}"; // 3 NBSP
        $level = $this->isGroup() ? max(0, $this->nivel - 1) : $this->nivel;
        return str_repeat($nbsp, $level);
    }
}