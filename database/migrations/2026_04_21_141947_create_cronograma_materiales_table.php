<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cronograma_materiales', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('presupuesto_id');
            $table->integer('item_order')->nullable();
            $table->string('descripcion');
            $table->string('unidad', 50)->nullable();
            $table->decimal('cantidad_total', 15, 4);
            $table->decimal('precio_unitario', 15, 2);
            $table->decimal('presupuesto_total', 15, 2);
            // campo JSON para almacenar la distribución mensual
            $table->json('distribucion_mensual')->nullable();
            $table->timestamps();

            // indice para velocidad de busqueda
            $table->index('presupuesto_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cronograma_materiales');
    }
};
