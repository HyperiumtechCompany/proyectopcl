<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // Marca si una valorización (periodo) ya fue "devengada" — trámite
        // administrativo de aprobación para pago, un paso legal que no se
        // puede inferir solo de tener datos de ejecutado: un periodo puede
        // tener avance real ejecutado y aun así seguir "pendiente" de
        // aprobación (ver CONTROL FINANCIERO DE LA OBRA en el Excel de
        // referencia — Jun-2026 devengada al 100%, Jul-2026 con el mismo
        // tipo de dato ejecutado pero 0% devengado).
        if (! Schema::connection($this->connection)->hasTable('valorizacion_estado')) {
            Schema::connection($this->connection)->create('valorizacion_estado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('periodo_key', 20);
                $table->boolean('devengado')->default(false);
                $table->date('fecha_devengado')->nullable();
                $table->timestamps();

                $table->unique(['presupuesto_id', 'periodo_key']);
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('valorizacion_estado');
    }
};
