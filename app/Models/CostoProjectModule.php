<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CostoProjectModule extends Model
{
    use HasFactory;
    protected $fillable = [
        'costo_project_id',
        'module_type',
        'enabled',
<<<<<<< HEAD
=======
        'config',
>>>>>>> 92a897fc3b1c7617dcab772f96239d84d45eb1a9
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
<<<<<<< HEAD
=======
            'config'  => 'array',
>>>>>>> 92a897fc3b1c7617dcab772f96239d84d45eb1a9
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(CostoProject::class, 'costo_project_id');
    }
}
