<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ubigeos', function (Blueprint $table) {
            $table->string('id', 6)->primary(); // Código UBIGEO: 2 dígitos dep, 4 prov, 6 dist
            $table->string('departamento', 100);
            $table->string('provincia', 100)->nullable();
            $table->string('distrito', 100)->nullable();
            // Nivel: departamento, provincia, distrito
            $table->enum('level', ['departamento', 'provincia', 'distrito']);
            $table->string('parent_id', 6)->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ubigeos');
    }
};
