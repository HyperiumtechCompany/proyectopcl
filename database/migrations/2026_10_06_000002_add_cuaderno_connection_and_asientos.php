<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cuaderno_vinculos', function (Blueprint $table): void {
            $table->text('session_key')->nullable();
            $table->string('conexion_estado', 40)->default('desconectada');
            $table->text('conexion_mensaje')->nullable();
            $table->json('cuadernos_disponibles')->nullable();
            $table->unsignedInteger('total_oficial')->nullable();
            $table->boolean('sync_completa')->default(false);
            $table->timestamp('last_synced_at')->nullable();
        });
        Schema::create('cuaderno_asientos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cuaderno_vinculo_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('numero');
            $table->text('titulo');
            $table->string('tipo');
            $table->string('fecha_oficial', 100);
            $table->string('usuario');
            $table->string('rol', 100);
            $table->string('estado', 100);
            $table->timestamps();
            $table->unique(['cuaderno_vinculo_id', 'numero']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cuaderno_asientos');
        Schema::table('cuaderno_vinculos', function (Blueprint $table): void {
            $table->dropColumn(['session_key', 'conexion_estado', 'conexion_mensaje', 'cuadernos_disponibles', 'total_oficial', 'sync_completa', 'last_synced_at']);
        });
    }
};
