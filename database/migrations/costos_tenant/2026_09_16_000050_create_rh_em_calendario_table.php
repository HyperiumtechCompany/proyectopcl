<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('rh_em_calendario')) {
            Schema::connection($this->connection)->create('rh_em_calendario', function (Blueprint $table) {
                $table->id();
                $table->char('mes', 7)->unique();
                $table->json('personal');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('rh_em_calendario');
    }
};
