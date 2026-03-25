<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $especialidades = [
            'metrado_sanitarias',
            'metrado_arquitectura',
            'metrado_estructura',
        ];

        foreach ($especialidades as $prefix) {
            
            // 1. Configuración del módulo
            if (!Schema::connection($this->connection)->hasTable("{$prefix}_config")) {
                Schema::connection($this->connection)->create("{$prefix}_config", function (Blueprint $table) {
                    $table->id();
                    $table->integer('cantidad_modulos')->default(1);
                    $table->string('nombre_proyecto', 255)->nullable();
                    $table->timestamps();
                });
            }

            // 2. Módulos dinámicos (N hojas con misma estructura)
            if (!Schema::connection($this->connection)->hasTable("{$prefix}_modulos")) {
                Schema::connection($this->connection)->create("{$prefix}_modulos", function (Blueprint $table) use ($prefix) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->integer('modulo_numero')->default(1);
                    $table->string('modulo_nombre', 100)->nullable();
                    $table->integer('item_order')->default(0);
                    $table->string('node_type', 20)->default('partida');
                    $table->string('titulo', 255)->nullable();
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

                    $table->index('presupuesto_id', "{$prefix}_mod_pres_idx");
                    $table->index(['presupuesto_id', 'modulo_numero', 'item_order'], "{$prefix}_mod_comp_idx");
                });
            }

            // 3. Red Exterior
            if (!Schema::connection($this->connection)->hasTable("{$prefix}_exterior")) {
                Schema::connection($this->connection)->create("{$prefix}_exterior", function (Blueprint $table) use ($prefix) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->integer('item_order')->default(0);
                    $table->string('node_type', 20)->default('partida');
                    $table->string('titulo', 255)->nullable();
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

                    $table->index('presupuesto_id', "{$prefix}_ext_pres_idx");
                });
            }

            // 4. Cisterna / Tanque Elevado
            if (!Schema::connection($this->connection)->hasTable("{$prefix}_cisterna")) {
                Schema::connection($this->connection)->create("{$prefix}_cisterna", function (Blueprint $table) use ($prefix) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->integer('item_order')->default(0);
                    $table->string('node_type', 20)->default('partida');
                    $table->string('titulo', 255)->nullable();
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

                    $table->index('presupuesto_id', "{$prefix}_cis_pres_idx");
                });
            }

            // 5. Resumen Consolidado
            if (!Schema::connection($this->connection)->hasTable("{$prefix}_resumen")) {
                Schema::connection($this->connection)->create("{$prefix}_resumen", function (Blueprint $table) use ($prefix) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->integer('item_order')->default(0);
                    $table->string('node_type', 20)->default('partida');
                    $table->string('titulo', 255)->nullable();
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

                    $table->index('presupuesto_id', "{$prefix}_res_pres_idx");
                });
            }
        }
    }

    public function down(): void
    {
        $especialidades = [
            'metrado_sanitarias',
            'metrado_arquitectura',
            'metrado_estructura',
        ];

        foreach ($especialidades as $prefix) {
            Schema::connection($this->connection)->dropIfExists("{$prefix}_resumen");
            Schema::connection($this->connection)->dropIfExists("{$prefix}_cisterna");
            Schema::connection($this->connection)->dropIfExists("{$prefix}_exterior");
            Schema::connection($this->connection)->dropIfExists("{$prefix}_modulos");
            Schema::connection($this->connection)->dropIfExists("{$prefix}_config");
        }
    }
};
