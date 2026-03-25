<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetradoSanitariasValue extends Model
{
    use HasFactory;
    protected $table = 'metrado_sanitarias_values';
    
    protected $fillable = [
        'node_id',
        'module_id',
        'value',
    ];
    
    protected $casts = [
        'value' => 'decimal:2',
    ];

    // ─── Relationships ───────────────────────────────────────────────────────

    public function node(): BelongsTo
    {
        return $this->belongsTo(MetradoSanitariasNode::class, 'node_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CostoProjectModule::class, 'module_id');
    }
}
