<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // Adelanto Directo y Adelanto de Materiales — montos entregados al
        // inicio del contrato, capturados una sola vez por presupuesto (no
        // por periodo). Es el primer dato real del "módulo de pagos"
        // (CONTROL DE PAGOS los usa en la columna "Amortizaciones"); a
        // diferencia de Programado/Ejecutado/Monto de Contrato, quedar en
        // cero es un estado válido (no todo proyecto recibe adelantos), por
        // eso NO entra en CronogramaEstadoService como una alerta.
        if (! Schema::connection($this->connection)->hasTable('adelantos_valorizado')) {
            Schema::connection($this->connection)->create('adelantos_valorizado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->unique();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->decimal('adelanto_directo', 14, 2)->default(0);
                $table->decimal('adelanto_materiales', 14, 2)->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('adelantos_valorizado');
    }
};
