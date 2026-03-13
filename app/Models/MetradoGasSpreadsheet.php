<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class MetradoGasSpreadsheet extends Model
{
    use HasFactory;

    protected $table = 'metrado_gas_spreadsheets';

    protected $fillable = [
        'user_id',
        'name',
        'project_name',
        'project_location',
        'building_type',
        'gas_type',
        'installation_type',
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
        return $this->belongsToMany(User::class, 'metrado_gas_collaborators')
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
     * Se usa en el frontend: sheet.summary.pipes, sheet.summary.fittings, etc.
     */
    public function getSummaryAttribute(): array
    {
        $data = $this->sheet_data;
        
        // Si no hay datos, retornar ceros
        if (!is_array($data) || empty($data)) {
            return [
                'pipes' => 0,
                'fittings' => 0,
                'valves' => 0,
                'equipment' => 0,
                'pressure_regulators' => 0,
                'meters' => 0,
            ];
        }
        
        $pipes = 0;
        $fittings = 0;
        $valves = 0;
        $equipment = 0;
        $pressure_regulators = 0;
        $meters = 0;
        
        // Recorrer filas de datos (saltar headers: fila 0)
        // Formato: [ITEM, DESCRIPCION, UNID, ELEM, DIAM, LARGO, N_VECES, PERDIDA, PRESION, CAUDAL, VELOCIDAD, LONGITUD, ACCESORIOS, VALVULAS, TOTAL]
        foreach (array_slice($data, 1) as $row) {
            $descripcion = strtolower(trim($row[1] ?? '')); // Columna DESCRIPCION (índice 1)
            $unidad = strtolower(trim($row[2] ?? ''));      // Columna UNID (índice 2)
            $elem = floatval($row[3] ?? 1);                  // Columna ELEM (índice 3)
            $longitud = floatval($row[11] ?? 0);             // Columna LONGITUD (índice 11)
            $accesorios = floatval($row[12] ?? 0);           // Columna ACCESORIOS (índice 12)
            $valvulas = floatval($row[13] ?? 0);             // Columna VALVULAS (índice 13)
            $total = floatval($row[14] ?? 0);                // Columna TOTAL (índice 14)
            
            // Sumar longitudes de tuberías (unidad ml o m)
            if ($unidad === 'ml' || $unidad === 'm') {
                $pipes += $longitud > 0 ? $longitud : $total;
            }
            
            // Sumar accesorios (codos, tes, reducciones)
            if ($accesorios > 0) {
                $fittings += $accesorios;
            } elseif ($unidad === 'und' && 
                     (str_contains($descripcion, 'codo') || 
                      str_contains($descripcion, 'te') || 
                      str_contains($descripcion, 'reduccion') ||
                      str_contains($descripcion, 'union'))) {
                $fittings += $elem;
            }
            
            // Sumar válvulas
            if ($valvulas > 0) {
                $valves += $valvulas;
            } elseif ($unidad === 'und' && str_contains($descripcion, 'valvula')) {
                $valves += $elem;
            }
            
            // Sumar equipos
            if ($unidad === 'und' && 
                (str_contains($descripcion, 'calentador') ||
                 str_contains($descripcion, 'caldera') ||
                 str_contains($descripcion, 'cocina') ||
                 str_contains($descripcion, 'horno') ||
                 str_contains($descripcion, 'secador') ||
                 str_contains($descripcion, 'quemador'))) {
                $equipment += $elem;
            }
            
            // Sumar reguladores de presión
            if ($unidad === 'und' && str_contains($descripcion, 'regulador')) {
                $pressure_regulators += $elem;
            }
            
            // Sumar medidores
            if ($unidad === 'und' && str_contains($descripcion, 'medidor')) {
                $meters += $elem;
            }
        }
        
        return [
            'pipes' => round($pipes, 1),
            'fittings' => round($fittings, 0),
            'valves' => round($valves, 0),
            'equipment' => round($equipment, 0),
            'pressure_regulators' => round($pressure_regulators, 0),
            'meters' => round($meters, 0),
        ];
    }
}   