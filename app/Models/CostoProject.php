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
        'plantilla_logo_izq',
        'plantilla_logo_der',
        'portada_logo_center',
        'plantilla_firma',
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
        'metrado_arquitectura',
        'metrado_estructura',
        'metrado_sanitarias',
        'metrado_electricas',
        'metrado_comunicaciones',
        'metrado_gas',
        'crono_general',
        'crono_valorizado',
        'crono_materiales',
        'presupuesto',
        'etts',
    ];

    private const LEGACY_PRESUPUESTO_MODULE_TYPES = [
        'presupuesto_gg',
        'presupuesto_insumos',
        'presupuesto_remuneraciones',
        'presupuesto_acus',
        'presupuesto_indice',
        'presupuesto_indices',
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

    // ─── Relaciones de Ubicación ─────────────────────────────────────────────

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Ubigeo::class, 'departamento_id');
    }

    public function provincia(): BelongsTo
    {
        return $this->belongsTo(Ubigeo::class, 'provincia_id');
    }

    public function distrito(): BelongsTo
    {
        return $this->belongsTo(Ubigeo::class, 'distrito_id');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Check if a specific module is enabled.
     */
    public function hasModule(string $moduleType): bool
    {
        return $this->belongsTo(Ubigeo::class, 'departamento_id');
    }

    /**
     * Check if the project uses the unified presupuesto module.
     */
    public function hasUnifiedPresupuesto(): bool
    {
        return $this->belongsTo(Ubigeo::class, 'provincia_id');
    }

    /**
     * Generate a unique database name for this project.
     */
    public static function generateDatabaseName(int $userId): string
    {
        return $this->belongsTo(Ubigeo::class, 'distrito_id');
    }

}


