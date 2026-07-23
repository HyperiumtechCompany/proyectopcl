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
        Schema::create('dialux_normative_requirements', function (Blueprint $table) {
            $table->id();

            // Origen normativo (EM.010 RNE Perú por defecto; extensible a otras normas)
            $table->string('standard', 32)->default('rne_peru')->index();

            // Jerarquía: categoría (1..10) y subcategoría opcional (p.ej. "3.4")
            $table->string('category_key', 8);
            $table->string('category');
            $table->string('subcategory_key', 8)->nullable();
            $table->string('subcategory')->nullable();

            // Ambiente/área normada
            $table->string('area_name');

            // Requisitos fotométricos
            $table->unsignedInteger('em_lux')->nullable(); // Iluminancia mantenida mínima (null = definida por requisitos especiales)
            $table->unsignedTinyInteger('ugrl')->nullable();  // Límite de deslumbramiento UGR
            $table->decimal('uo', 4, 2)->nullable();          // Uniformidad mínima
            $table->unsignedTinyInteger('ra')->nullable();    // Índice de reproducción cromática

            // Requisitos adicionales (texto o lista)
            $table->json('requirements')->nullable();

            $table->timestamps();

            $table->index(['standard', 'category_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dialux_normative_requirements');
    }
};
