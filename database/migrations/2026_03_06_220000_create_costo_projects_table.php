<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('costo_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // ─── Datos Generales ─────────────────────────────────────
            $table->string('nombre');
            $table->string('uei')->nullable();
            $table->string('unidad_ejecutora')->nullable();
            $table->string('codigo_snip')->nullable();
            $table->string('codigo_cui')->nullable();
            $table->string('codigo_local')->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable();

            // Códigos modulares: {inicial: "123", primaria: "456", secundaria: "789"}
            $table->json('codigos_modulares')->nullable();

            // ─── Ubicación (UBIGEO) ──────────────────────────────────
            $table->string('departamento_id', 6)->nullable();
            $table->string('provincia_id', 6)->nullable();
            $table->string('distrito_id', 6)->nullable();
            $table->string('centro_poblado')->nullable();

            // ─── Base de datos aislada ───────────────────────────────
            $table->string('database_name')->unique();
            $table->enum('status', ['active', 'archived'])->default('active');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('costo_projects');
    }
};
