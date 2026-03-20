<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class MetradoElectricasSpreadsheet extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'metrados_electricas';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'sheet_data',
        'is_collaborative',
        'collab_code',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'sheet_data' => 'array',
        'is_collaborative' => 'boolean',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'collab_code',
    ];

    /**
     * Scope: Hojas de un usuario (propietario o colaborador)
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('user_id', $userId) // Propietario
              ->orWhereHas('collaborators', fn($q) => $q->where('users.id', $userId)); // Colaborador
        });
    }

    /**
     * Scope: Solo hojas colaborativas
     */
    public function scopeCollaborative($query)
    {
        return $query->where('is_collaborative', true);
    }

    /**
     * Relación: Usuario propietario
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relación: Colaboradores (usuarios con acceso)
     */
    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'metrados_electricas_collaborators')
                    ->withPivot('role', 'joined_at')
                    ->withTimestamps();
    }

    /**
     * Verificar si un usuario puede editar esta hoja
     */
    public function canEdit(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        // El propietario siempre puede editar
        if ($this->user_id === $user->id) {
            return true;
        }

        // Colaboradores con rol 'editor' o superior pueden editar
        $pivot = $this->collaborators()->where('users.id', $user->id)->first()?->pivot;
        
        return $pivot && in_array($pivot->role, ['editor', 'admin'], true);
    }

    /**
     * Verificar si un usuario puede ver esta hoja
     */
    public function canView(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        // El propietario siempre puede ver
        if ($this->user_id === $user->id) {
            return true;
        }

        // Cualquier colaborador puede ver (incluso 'viewer')
        return $this->collaborators()->where('users.id', $user->id)->exists();
    }

    /**
     * Generar código único de colaboración (8 caracteres alfanuméricos)
     */
    public function generateCollabCode(): string
    {
        // Si ya tiene código, retornarlo
        if ($this->collab_code) {
            return $this->collab_code;
        }

        // Generar código único
        do {
            $code = strtoupper(Str::random(8));
        } while (static::where('collab_code', $code)->exists());

        $this->update(['collab_code' => $code, 'is_collaborative' => true]);

        return $code;
    }

    /**
     * Revocar acceso de colaboración (eliminar código)
     */
    public function revokeCollabCode(): void
    {
        $this->update([
            'collab_code' => null,
            'is_collaborative' => false,
        ]);
    }

    /**
     * Agregar colaborador a la hoja
     */
    public function addCollaborator(User $user, string $role = 'editor'): void
    {
        // No permitir que el propietario se agregue como colaborador
        if ($this->user_id === $user->id) {
            return;
        }

        $this->collaborators()->syncWithoutDetaching([
            $user->id => [
                'role' => $role,
                'joined_at' => now(),
            ],
        ]);
    }

    /**
     * Remover colaborador de la hoja
     */
    public function removeCollaborator(User $user): void
    {
        $this->collaborators()->detach($user->id);
    }

    /**
     * Obtener el rol de un colaborador
     */
    public function getCollaboratorRole(User $user): ?string
    {
        return $this->collaborators()
            ->where('users.id', $user->id)
            ->first()?->pivot?->role;
    }

    /**
     * Boot del modelo: eventos automáticos
     */
    protected static function booted(): void
    {
        // Al crear, generar código si está marcado como colaborativo
        static::creating(function (self $sheet) {
            if ($sheet->is_collaborative && ! $sheet->collab_code) {
                $sheet->collab_code = strtoupper(Str::random(8));
            }
        });

        // Al eliminar, limpiar colaboradores
        static::deleting(function (self $sheet) {
            $sheet->collaborators()->detach();
        });
    }

    /**
     * Serialización para APIs/Frontend
     */
    public function toArray(): array
    {
        $array = parent::toArray();

        // Ocultar collab_code si no es el propietario
        if (auth()->check() && $this->user_id !== auth()->id()) {
            unset($array['collab_code']);
        }

        return $array;
    }

    /**
     * Obtener resumen para listados (performance)
     */
    public function toSummaryArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'project_name' => $this->project_name,
            'is_collaborative' => $this->is_collaborative,
            'updated_at' => $this->updated_at?->format('d/m/Y H:i'),
            'is_owner' => $this->user_id === auth()->id(),
        ];
    }
}

