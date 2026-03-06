<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MetradoComunicacionCollaborator extends Model
{
    use HasFactory;

    protected $table = 'comunicaciones_collaborators';

    protected $fillable = ['spreadsheet_id', 'user_id', 'role', 'joined_at'];

    public function spreadsheet()
    {
        return $this->belongsTo(MetradoComunicacionSpreadsheet::class, 'spreadsheet_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
