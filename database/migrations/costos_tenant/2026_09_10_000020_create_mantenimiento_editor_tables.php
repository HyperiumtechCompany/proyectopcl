<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        Schema::connection($this->connection)->create('mantenimiento_documentos', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('nombre');
            $table->char('moneda', 3)->default('PEN');
            $table->string('estado', 30)->default('borrador');
            $table->unsignedBigInteger('revision')->default(1);
            $table->string('formula_engine_version', 30)->default('none');
            $table->json('config')->nullable();
            $table->json('parametros')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('mantenimiento_documentos');
    }
};
