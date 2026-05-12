<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class MetradoSanitariasSpreadsheet extends Model
{
    use HasFactory;

    protected $table = 'metrado_sanitarias_spreadsheets';

    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'project_location',
        'building_type',
        'plumbing_system',
        'sheet_data',
        'is_collaborative',
        'collab_code',
    ];

    protected $casts = [
        'sheet_data' => 'array',
        'is_collaborative' => 'boolean',
    ];

    protected $appends = [
        'summary',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function collaborators()
    {
        return $this->belongsToMany(User::class, 'metrado_sanitarias_collaborators')
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId)
            ->orWhereHas('collaborators', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            });
    }

    public function generateCollabCode()
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (static::where('collab_code', $code)->exists());

        $this->collab_code = $code;
        $this->is_collaborative = true;
        $this->save();

        return $code;
    }

    public function canEdit(User $user): bool
    {
        if ($this->user_id === $user->id) {
            return true;
        }

        $collab = $this->collaborators()
            ->where('user_id', $user->id)
            ->first();

        return $collab && $collab->pivot->role === 'editor';
    }

    public function getSummaryAttribute(): array
    {
        $data = $this->sheet_data;

        if (! is_array($data) || empty($data)) {
            return [
                'pipes' => 0,
                'fittings' => 0,
                'fixtures' => 0,
                'units' => 0,
            ];
        }

        $pipes = 0;
        $fittings = 0;
        $fixtures = 0;
        $units = 0;

        foreach (array_slice($data, 3) as $row) {
            $unidad = strtolower(trim($row[2] ?? ''));
            $lon = floatval($row[8] ?? 0);
            $area = floatval($row[9] ?? 0);
            $vol = floatval($row[10] ?? 0);
            $elem = floatval($row[12] ?? 0);

            if ($unidad === 'm' || $unidad === 'ml') {
                $pipes += $lon;
            } elseif ($unidad === 'm2') {
                $fixtures += $area;
            } elseif ($unidad === 'und' || $unidad === 'pza') {
                $units += $elem;
            } else {
                $fittings += $elem;
            }
        }

        return [
            'pipes' => round($pipes, 2),
            'fittings' => round($fittings, 0),
            'fixtures' => round($fixtures, 1),
            'units' => round($units, 0),
        ];
    }
}
