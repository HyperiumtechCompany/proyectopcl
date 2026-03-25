<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

abstract class CostosTenantModel extends Model
{
    protected $connection = 'costos_tenant';

    protected $guarded = [];
}
