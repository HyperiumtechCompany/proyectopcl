<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class AcCalculation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'data',
        'is_collaborative',
        'collab_code',
    ];

    protected $casts = [
        'data'             => 'array',
        'is_collaborative' => 'boolean',
    ];

    // ── Relaciones ────────────────────────────────────────────────────────────

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function collaboratorPivots(): HasMany
    {
        return $this->hasMany(AcCalculationCollaborator::class, 'ac_calculation_id');
    }

    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ac_calculation_collaborators', 'ac_calculation_id', 'user_id')
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /**
     * Calculations accesibles por el usuario (propias + colaborativas).
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId)
            ->orWhereHas('collaborators', fn($q) => $q->where('users.id', $userId));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function canEdit(User $user): bool
    {
        if ($this->user_id === $user->id) return true;

        $pivot = $this->collaboratorPivots()
            ->where('user_id', $user->id)
            ->first();

        return $pivot && $pivot->role === 'editor';
    }

    public function generateCollabCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (self::where('collab_code', $code)->exists());

        $this->update(['collab_code' => $code, 'is_collaborative' => true]);

        return $code;
    }
}
