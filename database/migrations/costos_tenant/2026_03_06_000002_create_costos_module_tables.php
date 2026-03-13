<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── METRADOS ────────────────────────────────────────────────────────────────
        // Cada especialidad tiene su propia tabla de metrados

        Schema::create('metrado_arquitectura', function (Blueprint $table) {
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

        Schema::create('metrado_estructura', function (Blueprint $table) {
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

        Schema::create('metrado_sanitarias', function (Blueprint $table) {
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

        Schema::create('metrado_electricas', function (Blueprint $table) {
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

        Schema::create('metrado_comunicaciones', function (Blueprint $table) {
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

        Schema::create('metrado_gas', function (Blueprint $table) {
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

        // ─── PRESUPUESTO ─────────────────────────────────────────────────────────────
        // Todas las tablas de presupuesto se ven en una sola vista pero almacenan separado

        // Presupuesto principal (partidas con precios unitarios del S10/Delfin)
        Schema::create('presupuesto_partidas', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('metrado', 14, 4)->default(0);
            $table->decimal('precio_unitario', 14, 4)->default(0);
            $table->decimal('parcial', 14, 4)->default(0);
            $table->string('especialidad', 30)->nullable(); // arquitectura, estructura, etc.
            $table->unsignedBigInteger('metrado_source_id')->nullable(); // referencia al metrado
            $table->string('metrado_source_table', 50)->nullable(); // tabla de donde viene
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });

        // ACUs - Análisis de Costos Unitarios
        Schema::create('presupuesto_acus', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('partida_id')->nullable();
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('rendimiento', 12, 4)->default(0);
            $table->decimal('costo_unitario', 14, 4)->default(0);
            $table->timestamps();
        });

        // ACU detalles (mano de obra, materiales, equipos, subcontratos)
        Schema::create('presupuesto_acu_detalles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('acu_id');
            $table->string('tipo', 20); // mano_obra, materiales, equipos, subcontratos
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('cantidad', 14, 6)->default(0);
            $table->decimal('precio', 14, 4)->default(0);
            $table->decimal('parcial', 14, 4)->default(0);
            $table->integer('item_order')->default(0);
            $table->timestamps();
        });

        // Insumos consolidados
        Schema::create('presupuesto_insumos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 30)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('cantidad', 14, 6)->default(0);
            $table->decimal('precio_unitario', 14, 4)->default(0);
            $table->decimal('parcial', 14, 4)->default(0);
            $table->string('tipo', 20)->nullable(); // mano_obra, materiales, equipos
            $table->timestamps();
        });

        // Gastos Generales
        Schema::create('presupuesto_gastos_generales', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('cantidad', 12, 4)->default(0);
            $table->decimal('tiempo_meses', 8, 2)->default(0);
            $table->decimal('costo_unitario', 14, 4)->default(0);
            $table->decimal('parcial', 14, 4)->default(0);
            $table->string('categoria', 30)->nullable(); // fijos, variables
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });

        // Remuneraciones (planilla)
        Schema::create('presupuesto_remuneraciones', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('cargo', 100)->nullable();
            $table->text('descripcion')->nullable();
            $table->decimal('cantidad', 8, 2)->default(0);
            $table->decimal('remuneracion_mensual', 14, 4)->default(0);
            $table->decimal('tiempo_meses', 8, 2)->default(0);
            $table->decimal('parcial', 14, 4)->default(0);
            $table->string('categoria', 30)->nullable(); // profesional, tecnico, administrativo
            $table->timestamps();
        });

        // Fórmula Polinómica / Índice Unificado
        Schema::create('presupuesto_indices', function (Blueprint $table) {
            $table->id();
            $table->string('simbolo', 10)->nullable();
            $table->integer('indice_unificado')->nullable();
            $table->text('descripcion')->nullable();
            $table->decimal('coeficiente_incidencia', 10, 6)->default(0);
            $table->decimal('porcentaje', 8, 4)->default(0);
            $table->integer('item_order')->default(0);
            $table->timestamps();
        });

        // ─── CRONOGRAMAS ─────────────────────────────────────────────────────────────

        // Cronograma General (tipo Gantt)
        Schema::create('cronograma_general', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->integer('duracion_dias')->default(0);
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable();
            $table->decimal('avance', 8, 4)->default(0);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->json('predecesoras')->nullable();
            $table->timestamps();
        });

        // Cronograma Valorizado (distribución mensual del presupuesto)
        Schema::create('cronograma_valorizado', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('descripcion')->nullable();
            $table->decimal('presupuesto_total', 14, 4)->default(0);
            $table->json('distribucion_mensual')->nullable(); // {mes1: valor, mes2: valor, ...}
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });

        // Cronograma de Materiales (adquisición de materiales por mes)
        Schema::create('cronograma_materiales', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->text('descripcion')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->decimal('cantidad_total', 14, 4)->default(0);
            $table->decimal('precio_unitario', 14, 4)->default(0);
            $table->decimal('presupuesto_total', 14, 4)->default(0);
            $table->json('distribucion_mensual')->nullable();
            $table->timestamps();
        });

        // ─── ETTs ────────────────────────────────────────────────────────────────────

        Schema::create('especificaciones_tecnicas', function (Blueprint $table) {
            $table->id();
            $table->integer('item_order')->default(0);
            $table->string('partida', 50)->nullable();
            $table->text('titulo')->nullable();
            $table->longText('descripcion')->nullable();
            $table->longText('materiales')->nullable();
            $table->longText('procedimiento')->nullable();
            $table->longText('medicion')->nullable();
            $table->longText('forma_pago')->nullable();
            $table->string('unidad', 20)->nullable();
            $table->string('especialidad', 30)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->integer('nivel')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('especificaciones_tecnicas');
        Schema::dropIfExists('cronograma_materiales');
        Schema::dropIfExists('cronograma_valorizado');
        Schema::dropIfExists('cronograma_general');
        Schema::dropIfExists('presupuesto_indices');
        Schema::dropIfExists('presupuesto_remuneraciones');
        Schema::dropIfExists('presupuesto_gastos_generales');
        Schema::dropIfExists('presupuesto_insumos');
        Schema::dropIfExists('presupuesto_acu_detalles');
        Schema::dropIfExists('presupuesto_acus');
        Schema::dropIfExists('presupuesto_partidas');
        Schema::dropIfExists('metrado_gas');
        Schema::dropIfExists('metrado_comunicaciones');
        Schema::dropIfExists('metrado_electricas');
        Schema::dropIfExists('metrado_sanitarias');
        Schema::dropIfExists('metrado_estructura');
        Schema::dropIfExists('metrado_arquitectura');
    }
};
