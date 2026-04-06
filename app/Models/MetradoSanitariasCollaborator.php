<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MetradoSanitariasCollaborator extends Model
{
    use HasFactory;

    protected $table = 'metrado_sanitarias_collaborators';

    protected $fillable = [
        'spreadsheet_id',
        'user_id',
        'role',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    public function spreadsheet(): BelongsTo
    {
        return $this->belongsTo(MetradoSanitariasSpreadsheet::class, 'spreadsheet_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
