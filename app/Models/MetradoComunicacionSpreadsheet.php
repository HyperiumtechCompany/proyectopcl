<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MetradoComunicacionSpreadsheet extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'comunicaciones_spreadsheets';

    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'sheet_data',
        'is_collaborative',
        'collab_code',
    ];

    protected $casts = [
        'sheet_data'       => 'array',
        'is_collaborative' => 'boolean',
    ];

    public static function forUser(int $userId)
    {
        return static::where('user_id', $userId)
            ->orWhereHas('collaborators', fn($q) => $q->where('users.id', $userId));
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function collaborators()
    {
        return $this->belongsToMany(User::class, 'comunicaciones_collaborators', 'spreadsheet_id', 'user_id')
            ->withPivot(['role', 'joined_at'])
            ->withTimestamps();
    }

    public function canEdit(User $user): bool
    {
        if ($this->user_id === $user->id) {
            return true;
        }

        $pivot = $this->collaborators()->where('users.id', $user->id)->first()?->pivot;
        return $pivot && $pivot->role === 'editor';
    }

    public function generateCollabCode(): string
    {
        $code = strtoupper(Str::random(8));
        $this->collab_code = $code;
        $this->is_collaborative = true;
        $this->save();

        return $code;
    }
}
