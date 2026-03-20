<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MetradoElectricasSpreadsheet extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'metrados_electricas';

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

    // hojas visibles para el usuario
    public static function forUser(int $userId)
    {
        return static::where('user_id', $userId)
            ->orWhereHas('collaborators', fn($q) => $q->where('users.id', $userId));
    }

    // dueño de la hoja
    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // colaboradores
    public function collaborators()
    {
        return $this->belongsToMany(
                User::class,
                'metrados_electricas_collaborators',
                'metrado_electricas_spreadsheet_id',
                'user_id'
            )
            ->withPivot(['role', 'joined_at'])
            ->withTimestamps();
    }

    // permiso de edición
    public function canEdit(User $user): bool
    {
        if ($this->user_id === $user->id) {
            return true;
        }

        $pivot = $this->collaborators()
            ->where('users.id', $user->id)
            ->first()?->pivot;

        return $pivot && $pivot->role === 'editor';
    }

    // generar código de colaboración
    public function generateCollabCode(): string
    {
        $code = strtoupper(Str::random(8));

        $this->collab_code = $code;
        $this->is_collaborative = true;
        $this->save();

        return $code;
    }
}