<?php

namespace App\Models\Dialux;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DialuxProject extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'data',
        'is_demo',
        'demo_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'is_demo' => 'boolean',
            'demo_expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
