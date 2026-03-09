<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class MetradoEstructuraSpreadsheet extends Model
{
    use HasFactory;

    protected $table = 'metrado_estructura_spreadsheets';

    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'project_location',
        'building_type',
        'structural_system',
        'sheet_data',
        'is_collaborative',
        'collab_code',
    ];

    protected $casts = [
        'sheet_data' => 'array',
        'is_collaborative' => 'boolean',
    ];

    // Relación con el propietario
    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Relación con colaboradores (usuarios que tienen acceso)
    public function collaborators()
    {
        return $this->belongsToMany(User::class, 'metrado_estructura_collaborators')
                    ->withPivot('role', 'joined_at')
                    ->withTimestamps();
    }

    // Scope para obtener hojas a las que el usuario tiene acceso (propias o colaboraciones)
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId)
            ->orWhereHas('collaborators', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            });
    }

    // Generar código único de 8 caracteres para colaboración
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

    // Verificar si un usuario puede editar esta hoja
    public function canEdit($user)
    {
        if ($this->user_id === $user->id) {
            return true;
        }

        $collab = $this->collaborators()
            ->where('user_id', $user->id)
            ->first();

        return $collab && $collab->pivot->role === 'editor';
    }
}