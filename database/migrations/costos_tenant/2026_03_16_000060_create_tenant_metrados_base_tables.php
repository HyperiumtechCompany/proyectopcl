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
        // 2. METRADOS — 6 especialidades, todas vinculadas a presupuestos
        // ══════════════════════════════════════════════════════════════════════
        $metradoTables = [
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
        ];

        foreach ($metradoTables as $tableName) {
            if (!Schema::connection($this->connection)->hasTable($tableName)) {
                Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                    $table->integer('item_order')->default(0);
                    $table->string('node_type', 20)->default('partida');
                    $table->string('titulo', 255)->nullable();
                    $table->string('item', 30)->nullable();
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

                    $table->index('presupuesto_id');
                    $table->index('item_order');
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // 2b. RESÚMENES DE METRADOS (Sanitarias de hecho se omite aquí y va en el modular)
        // ══════════════════════════════════════════════════════════════════════
        $resumenMetradoTables = [
            'metrado_electricas_resumen',
            'metrado_comunicaciones_resumen',
            'metrado_gas_resumen',
        ];

        foreach ($resumenMetradoTables as $resumenTable) {
            if (!Schema::connection($this->connection)->hasTable($resumenTable)) {
                Schema::connection($this->connection)->create($resumenTable, function (Blueprint $table) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                    $table->string('item', 30)->nullable()
                        ->comment('Código de ítem (p.ej. 01, 01.01)');

                    $table->string('node_type', 20)->default('partida')
                        ->comment('titulo | partida — para agrupar encabezados');
                    $table->string('titulo', 255)->nullable()
                        ->comment('Texto del encabezado cuando node_type=titulo');
                    $table->text('descripcion')->nullable()
                        ->comment('Descripción de la partida');

                    $table->string('und', 20)->nullable()
                        ->comment('Unidad de medida (m2, m3, kg, gl, etc.)');

                    $table->decimal('parcial', 14, 4)->default(0)
                        ->comment('Metrado parcial de esta fila');
                    $table->decimal('total', 14, 4)->default(0)
                        ->comment('Total acumulado de la partida/título');

                    $table->text('observacion')->nullable();
                    $table->unsignedBigInteger('parent_id')->nullable()
                        ->comment('FK self-referencing para jerarquía');
                    $table->integer('nivel')->default(0);
                    $table->integer('item_order')->default(0);
                    $table->timestamps();

                    $table->index('presupuesto_id');
                    $table->index('parent_id');
                    $table->index('item_order');
                });
            }
        }
    }

    public function down(): void
    {
        // Resúmenes de Metrados
        Schema::connection($this->connection)->dropIfExists('metrado_gas_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_comunicaciones_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_electricas_resumen');

        // Metrados principales
        Schema::connection($this->connection)->dropIfExists('metrado_gas');
        Schema::connection($this->connection)->dropIfExists('metrado_comunicaciones');
        Schema::connection($this->connection)->dropIfExists('metrado_electricas');
    }
};
