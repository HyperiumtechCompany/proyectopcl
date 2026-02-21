<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class AguaCalculation extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'project_name',
        'data_sheet',
        'is_collaborative',
        'collab_code',
        'user_id',
    ];

    protected $casts = [
        'data_sheet'       => 'array',
        'is_collaborative' => 'boolean',
    ];

    // ── Relaciones ────────────────────────────────────────────────────────────

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function collaboratorPivots(): HasMany
    {
        return $this->hasMany(AguaCalculationCollaborator::class, 'agua_calculation_id');
    }

    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'agua_calculation_collaborators', 'agua_calculation_id', 'user_id')
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /**
     * Spreadsheets accesibles por el usuario (propias + colaborativas).
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId)
            ->orWhereHas('collaborators', fn($q) => $q->where('users.id', $userId));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function canEdit(User $user): bool
    {
        if ($user->hasRole('cliente')) return false;

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
