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
        // 3. CRONOGRAMAS — 3 tipos, vinculados a presupuestos
        // ══════════════════════════════════════════════════════════════════════

        // 3a. Cronograma General (tipo Gantt)
        if (!Schema::connection($this->connection)->hasTable('cronograma_general')) {
            Schema::connection($this->connection)->create('cronograma_general', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

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

                $table->index('presupuesto_id');
            });
        }

        // 3b. Cronograma Valorizado (distribución mensual del presupuesto)
        if (!Schema::connection($this->connection)->hasTable('cronograma_valorizado')) {
            Schema::connection($this->connection)->create('cronograma_valorizado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->decimal('presupuesto_total', 14, 4)->default(0);
                $table->json('distribucion_mensual')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // 3c. Cronograma de Materiales (adquisición de materiales por mes)
        if (!Schema::connection($this->connection)->hasTable('cronograma_materiales')) {
            Schema::connection($this->connection)->create('cronograma_materiales', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('cantidad_total', 14, 4)->default(0);
                $table->decimal('precio_unitario', 14, 4)->default(0);
                $table->decimal('presupuesto_total', 14, 4)->default(0);
                $table->json('distribucion_mensual')->nullable();
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('cronograma_materiales');
        Schema::connection($this->connection)->dropIfExists('cronograma_valorizado');
        Schema::connection($this->connection)->dropIfExists('cronograma_general');
    }
};
