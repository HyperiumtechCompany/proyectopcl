<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('pagos_valorizacion')) {
            Schema::connection($this->connection)->create('pagos_valorizacion', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();
                $table->string('periodo_key', 20);
                $table->decimal('reajuste', 14, 2)->nullable();
                $table->decimal('penalidades', 14, 2)->nullable();
                $table->decimal('monto_pagado', 14, 2)->nullable();
                $table->date('fecha_pago')->nullable();
                $table->timestamps();
                $table->unique(['presupuesto_id', 'periodo_key']);
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('pagos_valorizacion');
    }
};
