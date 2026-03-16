<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CostoProject extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'nombre',
        'uei',
        'unidad_ejecutora',
        'codigo_snip',
        'codigo_cui',
        'codigo_local',
        'fecha_inicio',
        'fecha_fin',
        'codigos_modulares',
        'departamento_id',
        'provincia_id',
        'distrito_id',
        'centro_poblado',
        'database_name',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'codigos_modulares' => 'array',
            'fecha_inicio' => 'date',
            'fecha_fin' => 'date',
        ];
    }

    // ─── Tipos de módulos disponibles ────────────────────────────────────────────
    public const MODULE_TYPES = [
        // Metrados
        'metrado_arquitectura',
        'metrado_estructura',
        'metrado_sanitarias',
        'metrado_electricas',
        'metrado_comunicaciones',
        'metrado_gas',
        // Cronogramas
        'crono_general',
        'crono_valorizado',
        'crono_materiales',
        // Presupuesto Unificado (incluye: general, ACUs, GG, remuneraciones, insumos, índices)
        'presupuesto',
        // Especificaciones Técnicas
        'etts',
    ];

    // ─── Relations ───────────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function modules(): HasMany
    {
        return $this->hasMany(CostoProjectModule::class);
    }

    public function enabledModules(): HasMany
    {
        return $this->modules()->where('enabled', true);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Generate a unique database name for this project.
     */
    public static function generateDatabaseName(int $userId): string
    {
        return 'costos_' . $userId . '_' . now()->format('YmdHis') . '_' . mt_rand(100, 999);
    }

    /**
     * Check if a specific module is enabled.
     */
    public function hasModule(string $moduleType): bool
    {
        return $this->modules()->where('module_type', $moduleType)->where('enabled', true)->exists();
    }

    /**
     * Check if the project uses the unified presupuesto module.
     */
    public function hasUnifiedPresupuesto(): bool
    {
        return $this->hasModule('presupuesto');
    }

}
