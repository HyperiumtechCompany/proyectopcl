<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Valorización v2 (entorno de pruebas): tablas PROPIAS, sin relación con las del
 * Cronograma Valorizado en producción (valorizacion_estado, pagos_valorizacion…).
 *
 * - documentos: el estado de ENTRADA completo de la obra como JSON (el frontend
 *   solo guarda entradas; todo lo calculado se deriva). `revision` detecta
 *   guardados simultáneos y `schema_version` permite migrar el JSON a futuro.
 * - cortes: copia congelada de los datos al aprobar cada valorización.
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        Schema::connection($this->connection)->create('valorizacion_v2_documentos', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('nombre');
            $table->unsignedInteger('schema_version')->default(1);
            $table->unsignedBigInteger('revision')->default(1);
            $table->json('datos');
            $table->timestamps();
        });

        Schema::connection($this->connection)->create('valorizacion_v2_cortes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('valorizacion_v2_documentos')->cascadeOnDelete();
            $table->unsignedInteger('numero');
            $table->date('mes');
            $table->string('estado', 30)->default('aprobada');
            $table->json('resumen');
            $table->json('datos');
            $table->unsignedBigInteger('aprobado_por')->nullable();
            $table->timestamps();
            $table->unique(['documento_id', 'numero']);
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('valorizacion_v2_cortes');
        Schema::connection($this->connection)->dropIfExists('valorizacion_v2_documentos');
    }
};
