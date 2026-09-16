<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // Avance real ejecutado en campo (VAL. MENSUAL) — tabla independiente
        // de cronograma_valorizado (que es SOLO lo programado, en sus dos
        // modos). Nunca se escribe una en la otra: los reportes que comparan
        // programado vs. ejecutado (PROG VS. EJEC, CONTROL GEN. AVAN. OBRA.)
        // hacen JOIN entre ambas al leer, sin tocar ninguna.
        if (! Schema::connection($this->connection)->hasTable('cronograma_ejecutado')) {
            Schema::connection($this->connection)->create('cronograma_ejecutado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->decimal('metrado_contratado', 14, 4)->default(0);
                $table->decimal('precio_unitario', 14, 4)->default(0);
                // Por periodo: { "<periodoKey>": { "metrado": 0, "monto": 0 } }
                $table->json('ejecucion_mensual')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('cronograma_ejecutado');
    }
};
