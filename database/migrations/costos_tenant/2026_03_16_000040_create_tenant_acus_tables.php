<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // ══════════════════════════════════════════════════════════════════════
        // 12. PRESUPUESTO ACUs (Análisis de Costos Unitarios)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_acus')) {
            Schema::connection($this->connection)->create('presupuesto_acus', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('partida', 50);
                $table->text('descripcion');
                $table->string('unidad', 20);
                $table->decimal('rendimiento', 10, 4)->default(1);

                $table->json('mano_de_obra')->nullable();
                $table->decimal('costo_mano_obra',    15, 4)->default(0);
                $table->json('materiales')->nullable();
                $table->decimal('costo_materiales',   15, 4)->default(0);
                $table->json('equipos')->nullable();
                $table->decimal('costo_equipos',      15, 4)->default(0);
                $table->json('subcontratos')->nullable();
                $table->decimal('costo_subcontratos', 15, 4)->default(0);
                $table->json('subpartidas')->nullable();
                $table->decimal('costo_subpartidas',  15, 4)->default(0);

                $table->decimal('costo_unitario_total', 15, 4)->storedAs('
                    costo_mano_obra + costo_materiales + costo_equipos
                    + costo_subcontratos + costo_subpartidas
                ');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_acu_presupuesto');
                $table->index('partida',        'idx_acu_partida');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 15b. ACU COMPONENTES
        // ══════════════════════════════════════════════════════════════════════

        // 15b-1. Mano de Obra
        if (!Schema::connection($this->connection)->hasTable('acu_mano_de_obra')) {
            Schema::connection($this->connection)->create('acu_mano_de_obra', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('acu_id');
                $table->foreign('acu_id')->references('id')->on('presupuesto_acus')->cascadeOnDelete();
                $table->unsignedBigInteger('insumo_id')->nullable();
                $table->foreign('insumo_id')->references('id')->on('insumo_productos')->nullOnDelete();

                $table->text('descripcion');
                $table->string('unidad', 20)->default('hh');
                $table->decimal('cantidad',        12, 4)->default(0);
                $table->decimal('recursos',        12, 4)->default(0)->comment('Nº de recursos/cuadrilla');
                $table->decimal('precio_unitario', 15, 4)->default(0);
                $table->decimal('parcial',         15, 4)->default(0);
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('acu_id',    'idx_amo_acu');
                $table->index('insumo_id', 'idx_amo_insumo');
            });
        }

        // 15b-2. Materiales
        if (!Schema::connection($this->connection)->hasTable('acu_materiales')) {
            Schema::connection($this->connection)->create('acu_materiales', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('acu_id');
                $table->foreign('acu_id')->references('id')->on('presupuesto_acus')->cascadeOnDelete();
                $table->unsignedBigInteger('insumo_id')->nullable();
                $table->foreign('insumo_id')->references('id')->on('insumo_productos')->nullOnDelete();

                $table->text('descripcion');
                $table->string('unidad', 20)->default('und');
                $table->decimal('cantidad',           12, 4)->default(0);
                $table->decimal('precio_unitario',    15, 4)->default(0);
                $table->decimal('factor_desperdicio', 6,  4)->default(1.0000);
                $table->decimal('parcial',            15, 4)->default(0);
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('acu_id',    'idx_amat_acu');
                $table->index('insumo_id', 'idx_amat_insumo');
            });
        }

        // 15b-3. Equipos
        if (!Schema::connection($this->connection)->hasTable('acu_equipos')) {
            Schema::connection($this->connection)->create('acu_equipos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('acu_id');
                $table->foreign('acu_id')->references('id')->on('presupuesto_acus')->cascadeOnDelete();
                $table->unsignedBigInteger('insumo_id')->nullable();
                $table->foreign('insumo_id')->references('id')->on('insumo_productos')->nullOnDelete();

                $table->text('descripcion');
                $table->string('unidad', 20)->default('hm');
                $table->decimal('cantidad',    12, 4)->default(0);
                $table->decimal('recursos',    12, 4)->default(0)->comment('Nº de equipos');
                $table->decimal('precio_hora', 15, 4)->default(0);
                $table->decimal('parcial',     15, 4)->default(0);
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('acu_id',    'idx_aeq_acu');
                $table->index('insumo_id', 'idx_aeq_insumo');
            });
        }

        // 15b-4. Subcontratos
        if (!Schema::connection($this->connection)->hasTable('acu_subcontratos')) {
            Schema::connection($this->connection)->create('acu_subcontratos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('acu_id');
                $table->foreign('acu_id')->references('id')->on('presupuesto_acus')->cascadeOnDelete();
                $table->unsignedBigInteger('insumo_id')->nullable();
                $table->foreign('insumo_id')->references('id')->on('insumo_productos')->nullOnDelete();

                $table->text('descripcion');
                $table->string('unidad', 20)->default('glb');
                $table->decimal('cantidad',        12, 4)->default(0);
                $table->decimal('precio_unitario', 15, 4)->default(0);
                $table->decimal('parcial',         15, 4)->default(0);
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('acu_id',    'idx_asc_acu');
                $table->index('insumo_id', 'idx_asc_insumo');
            });
        }

        // 15b-5. Subpartidas
        if (!Schema::connection($this->connection)->hasTable('acu_subpartidas')) {
            Schema::connection($this->connection)->create('acu_subpartidas', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('acu_id');
                $table->foreign('acu_id')->references('id')->on('presupuesto_acus')->cascadeOnDelete();
                $table->unsignedBigInteger('insumo_id')->nullable();
                $table->foreign('insumo_id')->references('id')->on('insumo_productos')->nullOnDelete();

                $table->text('descripcion');
                $table->string('unidad', 20)->default('und');
                $table->decimal('cantidad',        12, 4)->default(0);
                $table->decimal('precio_unitario', 15, 4)->default(0);
                $table->decimal('parcial',         15, 4)->default(0);
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('acu_id',    'idx_asp_acu');
                $table->index('insumo_id', 'idx_asp_insumo');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('acu_subpartidas');
        Schema::connection($this->connection)->dropIfExists('acu_subcontratos');
        Schema::connection($this->connection)->dropIfExists('acu_equipos');
        Schema::connection($this->connection)->dropIfExists('acu_materiales');
        Schema::connection($this->connection)->dropIfExists('acu_mano_de_obra');
        Schema::connection($this->connection)->dropIfExists('presupuesto_acus');
    }
};
