<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetradoElectrico extends Model
{
    protected $table = 'metrados_electricos';
    
    protected $fillable = [
        'project_id',
        'hoja',       
        'orden',
        'partida',
        'descripcion',
        'unidad',
        'elsim', 'largo', 'ancho', 'alto', 'nveces',
        'lon', 'area', 'vol', 'kg', 'und', 'total',
        'observacion',
        '_level',
        '_kind',
    ];
    
    protected $casts = [
        'elsim' => 'decimal:4',
        'largo' => 'decimal:4',
        'ancho' => 'decimal:4',
        'alto'  => 'decimal:4',
        'nveces'=> 'decimal:4',
        'lon'   => 'decimal:4',
        'area'  => 'decimal:4',
        'vol'   => 'decimal:4',
        'kg'    => 'decimal:4',
        'und'   => 'decimal:4',
        'total' => 'decimal:4',
        '_level'=> 'integer',
    ];
    
    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'project_id');
    }
}

