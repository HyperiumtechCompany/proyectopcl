<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GestorProyecto extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'nombre',
        'descripcion',
        'numero_expediente',
        'responsable',
        'cantidad_modulos',
        'monto_designado',
        'tiempo_estimado_dias',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected function casts(): array
    {
        return [
            'cantidad_modulos' => 'integer',
            'monto_designado' => 'decimal:2',
            'tiempo_estimado_dias' => 'integer',
            'fecha_inicio' => 'date',
            'fecha_fin' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function nodos(): HasMany
    {
        return $this->hasMany(GestorProyectoNodo::class)->orderBy('order');
    }
}
