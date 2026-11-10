<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class CostoProject extends Model
{
    use HasFactory;

    /** Los códigos de invitación solo se entregan al dueño, vía CostoProjectShareController. */
    protected $hidden = ['share_code_editor', 'share_code_viewer'];

    /** @var array<int, string|null> rol por user_id, ver accessRoleFor() */
    private array $accessRoleCache = [];

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
        'is_demo',
        'demo_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'codigos_modulares' => 'array',
            'fecha_inicio' => 'date',
            'fecha_fin' => 'date',
            'is_demo' => 'boolean',
            'demo_expires_at' => 'datetime',
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
        'mantenimiento',
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

    public function cuadernoVinculos(): HasMany
    {
        return $this->hasMany(CuadernoVinculo::class);
    }

    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'costo_project_collaborators')
            ->withPivot('role', 'invited_by', 'joined_at')
            ->withTimestamps();
    }

    // ─── Acceso (dueño / colaborador) ────────────────────────────────────────────

    /**
     * Rol de $user sobre el proyecto: 'owner', 'editor', 'viewer' o null (sin acceso).
     * Se memoriza en la instancia para no consultar la tabla en cada chequeo.
     */
    public function accessRoleFor(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        if ($this->user_id === $user->id) {
            return 'owner';
        }

        if (! array_key_exists($user->id, $this->accessRoleCache)) {
            $this->accessRoleCache[$user->id] = CostoProjectCollaborator::query()
                ->where('costo_project_id', $this->id)
                ->where('user_id', $user->id)
                ->value('role');
        }

        return $this->accessRoleCache[$user->id];
    }

    /** Invalida el rol memorizado (tras compartir, quitar o transferir). */
    public function forgetAccessRoles(): void
    {
        $this->accessRoleCache = [];
    }

    public function canBeViewedBy(?User $user): bool
    {
        return $this->accessRoleFor($user) !== null;
    }

    public function canBeEditedBy(?User $user): bool
    {
        return in_array($this->accessRoleFor($user), ['owner', CostoProjectCollaborator::ROLE_EDITOR], true);
    }

    public function isOwnedBy(?User $user): bool
    {
        return $user !== null && $this->user_id === $user->id;
    }

    /**
     * Código de invitación (8 caracteres, único en todo el sistema) para el rol dado.
     * Reutiliza el existente; $regenerate invalida el anterior.
     */
    public function shareCodeFor(string $role, bool $regenerate = false): string
    {
        $column = $role === CostoProjectCollaborator::ROLE_EDITOR ? 'share_code_editor' : 'share_code_viewer';

        if (! $regenerate && filled($this->{$column})) {
            return $this->{$column};
        }

        do {
            $code = strtoupper(Str::random(8));
        } while (self::where('share_code_editor', $code)->orWhere('share_code_viewer', $code)->exists());

        $this->forceFill([$column => $code])->save();

        return $code;
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
        if ($moduleType === 'presupuesto') {
            return $this->hasUnifiedPresupuesto();
        }

        return $this->enabledModules()
            ->where('module_type', $moduleType)
            ->exists();
    }

    /**
     * Check if the project uses the unified presupuesto module.
     */
    public function hasUnifiedPresupuesto(): bool
    {
        return $this->enabledModules()
            ->whereIn('module_type', [
                'presupuesto',
                ...self::LEGACY_PRESUPUESTO_MODULE_TYPES,
            ])
            ->exists();
    }

    /**
     * Generate a unique database name for this project.
     */
    public static function generateDatabaseName(int $userId): string
    {
        return 'costos_user_'.$userId.'_'.time().'_'.bin2hex(random_bytes(4));
    }
}
