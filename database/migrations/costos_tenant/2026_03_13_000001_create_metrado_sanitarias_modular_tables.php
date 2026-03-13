<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Configuración del módulo sanitarias ─────────────────────────────────
        Schema::create('metrado_sanitarias_config', function (Blueprint $table) {
            $table->id();
            $table->integer('cantidad_modulos')->default(1);
            $table->string('nombre_proyecto', 255)->nullable();
            $table->timestamps();
        });

        // ─── Módulos dinámicos (N hojas con misma estructura) ────────────────────
        Schema::create('metrado_sanitarias_modulos', function (Blueprint $table) {
            $table->id();
            $table->integer('modulo_numero')->default(1); // 1, 2, 3...
            $table->string('modulo_nombre', 100)->nullable(); // "Módulo 1", "Bloque A"
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('elsim', 12, 4)->default(0);
            $table->decimal('largo', 12, 4)->default(0);
            $table->decimal('ancho', 12, 4)->default(0);
            $table->decimal('alto', 12, 4)->default(0);
            $table->decimal('nveces', 12, 4)->default(0);
            $table->decimal('lon', 12, 4)->default(0);
            $table->decimal('area', 12, 4)->default(0);
            $table->decimal('vol', 12, 4)->default(0);
            $table->decimal('kg', 12, 4)->default(0);
            $table->decimal('und', 14, 4)->default(0);
            $table->decimal('total', 14, 4)->default(0);
            $table->text('observacion')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();

            $table->index(['modulo_numero', 'item_order']);
        });

        // ─── Red Exterior ────────────────────────────────────────────────────────
        Schema::create('metrado_sanitarias_exterior', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('elsim', 12, 4)->default(0);
            $table->decimal('largo', 12, 4)->default(0);
            $table->decimal('ancho', 12, 4)->default(0);
            $table->decimal('alto', 12, 4)->default(0);
            $table->decimal('nveces', 12, 4)->default(0);
            $table->decimal('lon', 12, 4)->default(0);
            $table->decimal('area', 12, 4)->default(0);
            $table->decimal('vol', 12, 4)->default(0);
            $table->decimal('kg', 12, 4)->default(0);
            $table->decimal('und', 14, 4)->default(0);
            $table->decimal('total', 14, 4)->default(0);
            $table->text('observacion')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });

        // ─── Cisterna / Tanque Elevado ───────────────────────────────────────────
        Schema::create('metrado_sanitarias_cisterna', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('elsim', 12, 4)->default(0);
            $table->decimal('largo', 12, 4)->default(0);
            $table->decimal('ancho', 12, 4)->default(0);
            $table->decimal('alto', 12, 4)->default(0);
            $table->decimal('nveces', 12, 4)->default(0);
            $table->decimal('lon', 12, 4)->default(0);
            $table->decimal('area', 12, 4)->default(0);
            $table->decimal('vol', 12, 4)->default(0);
            $table->decimal('kg', 12, 4)->default(0);
            $table->decimal('und', 14, 4)->default(0);
            $table->decimal('total', 14, 4)->default(0);
            $table->text('observacion')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });

        // ─── Resumen Consolidado ─────────────────────────────────────────────────
        Schema::create('metrado_sanitarias_resumen', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('total_modulos', 14, 4)->default(0);
            $table->decimal('total_exterior', 14, 4)->default(0);
            $table->decimal('total_cisterna', 14, 4)->default(0);
            $table->decimal('total_general', 14, 4)->default(0);
            $table->text('observacion')->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrado_sanitarias_resumen');
        Schema::dropIfExists('metrado_sanitarias_cisterna');
        Schema::dropIfExists('metrado_sanitarias_exterior');
        Schema::dropIfExists('metrado_sanitarias_modulos');
        Schema::dropIfExists('metrado_sanitarias_config');
    }
};
