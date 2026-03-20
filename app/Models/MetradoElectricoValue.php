<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * MetradoElectricasValue
 * 
 * Maneja los cálculos numéricos y totales del metrado eléctrico.
 * Separa los valores calculados de la estructura de nodos.
 */
class MetradoElectricasValue extends Model
{
    protected $table = 'metrados_electricos_valores';
    
    protected $fillable = [
        'node_id',               // referencia al nodo
        'project_id',
        'hoja',                  // 'metrado' | 'resumen'
        
        // Valores de entrada
        'elsim',                 // Elementos similares
        'largo',
        'ancho',
        'alto',
        'nveces',                // Número de veces
        
        // Valores calculados
        'lon',                   // largo × nveces
        'area',                  // largo × ancho × nveces
        'vol',                   // largo × ancho × alto × nveces
        'kg',
        'und',                   // elsim × nveces
        
        // Total según unidad
        'total',
        
        // Totales consolidados (solo para resumen)
        'total_modulos',
        'total_exterior',
        'total_cisterna',
        'total_general',
    ];
    
    protected $casts = [
        'elsim' => 'decimal:4',
        'largo' => 'decimal:4',
        'ancho' => 'decimal:4',
        'alto'  => 'decimal:4',
        'nveces'=> 'decimal:4',
        'lon'   => 'decimal:4',
        'area'  => 'decimal:4',
        'vol'   => 'decimal:4',
        'kg'    => 'decimal:4',
        'und'   => 'decimal:4',
        'total' => 'decimal:4',
        'total_modulos'   => 'decimal:4',
        'total_exterior'  => 'decimal:4',
        'total_cisterna'  => 'decimal:4',
        'total_general'   => 'decimal:4',
    ];
    
    /**
     * Relación con el nodo
     */
    public function node(): BelongsTo
    {
        return $this->belongsTo(MetradoElectricasNode::class, 'node_id');
    }
    
    /**
     * Relación con el proyecto
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'project_id');
    }
    
    /**
     * Mapa de unidad → columna de total
     */
    protected static array $UNIT_TOTAL_COL = [
        'und' => 'und', 'pza' => 'und',
        'm'   => 'lon', 'ml'  => 'lon',
        'm2'  => 'area',
        'm3'  => 'vol', 'lt' => 'vol', 'gl' => 'vol',
        'kg'  => 'kg',
    ];
    
    /**
     * Calcular valores derivados (lon, area, vol, und)
     */
    public function calculateDerivedValues(): void
    {
        $this->und  = $this->round4($this->elsim * $this->nveces);
        $this->lon  = $this->round4($this->largo * $this->nveces);
        $this->area = $this->round4($this->largo * $this->ancho * $this->nveces);
        $this->vol  = $this->round4($this->largo * $this->ancho * $this->alto * $this->nveces);
    }
    
    /**
     * Calcular total según la unidad
     */
    public function calculateTotal(string $unidad): void
    {
        $unidad = strtolower(trim($unidad));
        $columna = self::$UNIT_TOTAL_COL[$unidad] ?? 'total';
        
        $this->total = match($columna) {
            'und'  => $this->und,
            'lon'  => $this->lon,
            'area' => $this->area,
            'vol'  => $this->vol,
            'kg'   => $this->kg,
            default => 0.0,
        };
        
        $this->total = $this->round4($this->total);
    }
    
    /**
     * Calcular totales consolidados para resumen
     * (suma de todos los módulos + exterior + cisterna)
     */
    public function calculateResumenTotal(
        float $totalModulos = 0,
        float $totalExterior = 0,
        float $totalCisterna = 0
    ): void {
        $this->total_modulos  = $this->round4($totalModulos);
        $this->total_exterior = $this->round4($totalExterior);
        $this->total_cisterna = $this->round4($totalCisterna);
        $this->total_general  = $this->round4(
            $totalModulos + $totalExterior + $totalCisterna
        );
    }
    
    /**
     * Roll-up: sumar totales de hijos directos
     */
    public function rollupFromChildren(array $childrenValues): void
    {
        $sum = 0.0;
        
        foreach ($childrenValues as $childValue) {
            $sum += $this->toFloat($childValue->total ?? 0);
        }
        
        $this->total = $this->round4($sum);
    }
    
    /**
     * Helper: redondear a 4 decimales
     */
    protected function round4(float $value): float
    {
        return round($value, 4);
    }
    
    /**
     * Helper: convertir a float seguro
     */
    protected function toFloat(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }
    
    /**
     * Scope: filtrar por hoja
     */
    public function scopeHoja($query, string $hoja)
    {
        return $query->where('hoja', $hoja);
    }
    
    /**
     * Scope: solo grupos (para roll-up)
     */
    public function scopeGroups($query)
    {
        return $query->whereHas('node', function($q) {
            $q->where('tipo_nodo', 'group');
        });
    }
    
    /**
     * Scope: solo hojas/partidas
     */
    public function scopeLeaves($query)
    {
        return $query->whereHas('node', function($q) {
            $q->where('tipo_nodo', 'leaf');
        });
    }
}