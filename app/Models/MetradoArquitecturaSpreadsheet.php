<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class MetradoArquitecturaSpreadsheet extends Model
{
    use HasFactory;

    protected $table = 'metrado_arquitectura_spreadsheets';

    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'project_location',
        'building_type',
        'architectural_system',
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

    // Relación con el propietario
    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Relación con colaboradores (usuarios que tienen acceso)
    public function collaborators()
    {
        return $this->belongsToMany(User::class, 'metrado_arquitectura_collaborators')
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

    /**
     * Accessor: Calcular resumen automático desde sheet_data
     * Se usa en el frontend: sheet.summary.walls, sheet.summary.floors, etc.
     */
    public function getSummaryAttribute(): array
    {
        $data = $this->sheet_data;

        // Si no hay datos, retornar ceros
        if (! is_array($data) || empty($data)) {
            return [
                'walls' => 0,
                'floors' => 0,
                'ceilings' => 0,
                'doors' => 0,
                'windows' => 0,
            ];
        }

        $walls = 0;
        $floors = 0;
        $ceilings = 0;
        $doors = 0;
        $windows = 0;

        // Recorrer filas de datos (saltar headers: filas 0, 1, 2)
        // Cada fila: [ITEM, DESCRIPCION, UNID, ELEM, LARGO, ANCHO, ALTO, N_VECES, LON, AREA, VOL, KG, UNID_METRADO, TOTAL]
        foreach (array_slice($data, 3) as $row) {
            $unidad = strtolower(trim($row[2] ?? '')); // Columna UNID (índice 2)
            $area = floatval($row[9] ?? 0);            // Columna AREA (índice 9)
            $elem = floatval($row[12] ?? 0);           // Columna UNID_METRADO (índice 12)

            if ($unidad === 'm2') {
                $floors += $area;
                $ceilings += $area;
            } elseif ($unidad === 'm') {
                $walls += $area; // Área de paredes
            } elseif ($unidad === 'und' || $unidad === 'pza') {
                if (stripos($row[1] ?? '', 'puerta') !== false) {
                    $doors += $elem;
                } elseif (stripos($row[1] ?? '', 'ventana') !== false) {
                    $windows += $elem;
                }
            }
        }

        return [
            'walls' => round($walls, 2),
            'floors' => round($floors, 2),
            'ceilings' => round($ceilings, 2),
            'doors' => round($doors, 0),
            'windows' => round($windows, 0),
        ];
    }
}
