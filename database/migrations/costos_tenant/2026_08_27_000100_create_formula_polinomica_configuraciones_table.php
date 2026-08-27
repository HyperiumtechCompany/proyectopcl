<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (Schema::connection($this->connection)->hasTable('formula_polinomica_configuraciones')) {
            return;
        }

        Schema::connection($this->connection)->create('formula_polinomica_configuraciones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('parent_id')->unique();
            $table->json('estructura');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('formula_polinomica_configuraciones');
    }
};
