<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Specify the tenant database connection.
     */
    protected $connection = 'costos_tenant';

    /**
     * Run the migrations.
     * 
     * Creates the six tenant database tables for the unified 'presupuesto' module.
     * These tables are created when the 'presupuesto' module is enabled for a project.
     */
    public function up(): void
    {
        // ─── PRESUPUESTO GENERAL ─────────────────────────────────────────────────────
        // Main budget table with calculated 'parcial' column (metrado * precio_unitario)
        
        if (!Schema::hasTable('presupuesto_general')) {
            Schema::create('presupuesto_general', function (Blueprint $table) {
            $table->id();
            $table->string('partida', 50);
            $table->text('descripcion');
            $table->string('unidad', 20);
            $table->decimal('metrado', 15, 4)->default(0);
            $table->decimal('precio_unitario', 15, 4)->default(0);
            // Calculated column: parcial = metrado * precio_unitario
            $table->decimal('parcial', 15, 4)
                ->storedAs('metrado * precio_unitario')
                ->comment('Calculated: metrado * precio_unitario');
            $table->string('metrado_source', 50)->nullable()
                ->comment('Reference to source metrado module');
            $table->integer('item_order')->default(0);
            $table->timestamps();
            
            $table->index('partida', 'idx_partida');
            $table->index('item_order', 'idx_item_order');
        });
        }

        // ─── PRESUPUESTO ACUS ────────────────────────────────────────────────────────
        // ACU analysis with JSON fields for components and calculated totals
        
        if (!Schema::hasTable('presupuesto_acus')) {
            Schema::create('presupuesto_acus', function (Blueprint $table) {
            $table->id();
            $table->string('partida', 50);
            $table->text('descripcion');
            $table->string('unidad', 20);
            $table->decimal('rendimiento', 10, 4)->default(1);
            
            // Mano de obra (JSON array)
            $table->json('mano_de_obra')->nullable()
                ->comment('Array of labor components');
            $table->decimal('costo_mano_obra', 15, 4)->default(0);
            
            // Materiales (JSON array)
            $table->json('materiales')->nullable()
                ->comment('Array of material components');
            $table->decimal('costo_materiales', 15, 4)->default(0);
            
            // Equipos (JSON array)
            $table->json('equipos')->nullable()
                ->comment('Array of equipment components');
            $table->decimal('costo_equipos', 15, 4)->default(0);
            
            // Calculated column: total = sum of all costs
            $table->decimal('costo_unitario_total', 15, 4)
                ->storedAs('costo_mano_obra + costo_materiales + costo_equipos')
                ->comment('Calculated: sum of all component costs');
            
            $table->integer('item_order')->default(0);
            $table->timestamps();
            
            $table->index('partida', 'idx_partida');
            $table->index('item_order', 'idx_item_order');
        });
        }

        // ─── PRESUPUESTO GASTOS GENERALES ────────────────────────────────────────────
        // General expenses with calculated 'parcial' column
        
        if (!Schema::hasTable('presupuesto_gastos_generales')) {
            Schema::create('presupuesto_gastos_generales', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 50);
            $table->text('descripcion');
            $table->string('unidad', 20);
            $table->decimal('cantidad', 15, 4)->default(0);
            $table->decimal('precio_unitario', 15, 4)->default(0);
            // Calculated column: parcial = cantidad * precio_unitario
            $table->decimal('parcial', 15, 4)
                ->storedAs('cantidad * precio_unitario')
                ->comment('Calculated: cantidad * precio_unitario');
            $table->string('categoria', 50)->nullable()
                ->comment('E.g.: Gastos Fijos, Gastos Variables');
            $table->integer('item_order')->default(0);
            $table->timestamps();
            
            $table->index('codigo', 'idx_codigo');
            $table->index('categoria', 'idx_categoria');
            $table->index('item_order', 'idx_item_order');
        });
        }

        // ─── PRESUPUESTO INSUMOS ─────────────────────────────────────────────────────
        // Materials/labor/equipment catalog
        
        if (!Schema::hasTable('presupuesto_insumos')) {
            Schema::create('presupuesto_insumos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 50);
            $table->text('descripcion');
            $table->string('unidad', 20);
            $table->decimal('precio_unitario', 15, 4)->default(0);
            $table->string('tipo', 20)
                ->comment('material, mano_obra, equipo');
            $table->string('categoria', 50)->nullable();
            $table->integer('item_order')->default(0);
            $table->timestamps();
            
            $table->index('codigo', 'idx_codigo');
            $table->index('tipo', 'idx_tipo');
            $table->index('item_order', 'idx_item_order');
        });
        }

        // ─── PRESUPUESTO REMUNERACIONES ──────────────────────────────────────────────
        // Payroll with calculated monthly and project totals
        
        if (!Schema::hasTable('presupuesto_remuneraciones')) {
            Schema::create('presupuesto_remuneraciones', function (Blueprint $table) {
            $table->id();
            $table->string('cargo', 100);
            $table->string('categoria', 50)->nullable()
                ->comment('Profesional, Técnico, Auxiliar');
            $table->decimal('sueldo_basico', 15, 4)->default(0);
            $table->decimal('bonificaciones', 15, 4)->default(0);
            $table->decimal('beneficios_sociales', 15, 4)->default(0);
            // Calculated column: total_mensual = sum of salary components
            $table->decimal('total_mensual', 15, 4)
                ->storedAs('sueldo_basico + bonificaciones + beneficios_sociales')
                ->comment('Calculated: sum of salary components');
            $table->integer('meses')->default(1);
            // Calculated column: total_proyecto = total_mensual * meses
            $table->decimal('total_proyecto', 15, 4)
                ->storedAs('(sueldo_basico + bonificaciones + beneficios_sociales) * meses')
                ->comment('Calculated: total_mensual * meses');
            $table->integer('item_order')->default(0);
            $table->timestamps();
            
            $table->index('cargo', 'idx_cargo');
            $table->index('item_order', 'idx_item_order');
        });
        }

        // ─── PRESUPUESTO INDICES ─────────────────────────────────────────────────────
        // Polynomial indices with calculated 'monomio' column
        
        if (!Schema::hasTable('presupuesto_indices')) {
            Schema::create('presupuesto_indices', function (Blueprint $table) {
            $table->id();
            $table->string('simbolo', 10)
                ->comment('E.g.: M, MO, EQ, GG');
            $table->text('descripcion');
            $table->decimal('coeficiente', 10, 6)->default(0);
            $table->decimal('indice_base', 15, 4)->default(100);
            $table->decimal('indice_actual', 15, 4)->default(100);
            // Calculated column: monomio = coeficiente * (indice_actual / indice_base)
            $table->decimal('monomio', 10, 6)
                ->storedAs('coeficiente * (indice_actual / indice_base)')
                ->comment('Calculated: coeficiente * (indice_actual / indice_base)');
            $table->date('fecha_indice_base')->nullable();
            $table->date('fecha_indice_actual')->nullable();
            $table->integer('item_order')->default(0);
            $table->timestamps();
            
            $table->index('simbolo', 'idx_simbolo');
            $table->index('item_order', 'idx_item_order');
        });
        }

        // ─── INSUMO CLASES (Catálogo de clases tipo S10) ────────────────────────────
        if (!Schema::hasTable('insumo_clases')) {
            Schema::create('insumo_clases', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 20)->unique()
                    ->comment('Código de clase (ej: 01, 02, 47)');
                $table->string('descripcion', 255)
                    ->comment('Nombre de la clase');
                $table->timestamps();

                $table->index('codigo', 'idx_insumo_clase_codigo');
            });
        }

        // ─── INSUMO PRODUCTOS (Catálogo de insumos tipo S10/Delfin) ─────────────────
        if (!Schema::hasTable('insumo_productos')) {
            Schema::create('insumo_productos', function (Blueprint $table) {
                $table->id();
                $table->string('codigo_producto', 50)->unique()
                    ->comment('Código único del producto (estilo S10)');
                $table->text('descripcion')
                    ->comment('Descripción del insumo');
                $table->text('especificaciones')->nullable()
                    ->comment('Especificaciones técnicas');
                $table->string('unidad', 20)
                    ->comment('Unidad de medida (hh, m3, bls, kg, etc.)');
                $table->decimal('costo_unitario_lista', 15, 4)->default(0)
                    ->comment('Precio de lista');
                $table->decimal('costo_unitario', 15, 4)->default(0)
                    ->comment('Precio efectivo');
                $table->decimal('costo_flete', 15, 4)->default(0)
                    ->comment('Costo de flete');
                $table->date('fecha_lista')->nullable()
                    ->comment('Fecha de la lista de precios');
                $table->unsignedBigInteger('insumo_clase_id')
                    ->comment('FK a la clase del insumo');
                $table->string('tipo', 20)
                    ->comment('mano_de_obra, materiales, equipos');
                $table->boolean('estado')->default(true)
                    ->comment('Activo/Inactivo');
                $table->timestamps();

                $table->foreign('insumo_clase_id')
                    ->references('id')->on('insumo_clases')
                    ->cascadeOnDelete();
                $table->index('codigo_producto', 'idx_insumo_prod_codigo');
                $table->index('tipo', 'idx_insumo_prod_tipo');
                $table->index('insumo_clase_id', 'idx_insumo_prod_clase');
                $table->index('estado', 'idx_insumo_prod_estado');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('insumo_productos');
        Schema::dropIfExists('insumo_clases');
        Schema::dropIfExists('presupuesto_indices');
        Schema::dropIfExists('presupuesto_remuneraciones');
        Schema::dropIfExists('presupuesto_insumos');
        Schema::dropIfExists('presupuesto_gastos_generales');
        Schema::dropIfExists('presupuesto_acus');
        Schema::dropIfExists('presupuesto_general');
    }
};
