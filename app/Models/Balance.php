<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Balance extends Model
{
    protected $fillable = ['nombre'];

    public function items()
    {
        return $this->hasMany(BalanceItem::class);
    }
}
