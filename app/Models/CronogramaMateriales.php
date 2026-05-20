<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CronogramaMateriales extends Model
{
    // Definimos el nombre de la tabla (opcional si sigue la convención de Laravel)
    protected $table = 'cronograma_materiales';

    // Campos que se pueden asignar masivamente
    protected $fillable = [
        'presupuesto_id',
        'item_order',
        'descripcion',
        'unidad',
        'cantidad_total',
        'precio_unitario',
        'presupuesto_total',
        'distribucion_mensual',
    ];

    /** cast de atributos.
     * esto convierte el JSON de la base de datos en un Array de PHP automaticamente.
     */
    protected $casts = [
        'distribucion_mensual' => 'array',
        'cantidad_total' => 'float',
        'precio_unitario' => 'float',
        'presupuesto_total' => 'float',
    ];
}
