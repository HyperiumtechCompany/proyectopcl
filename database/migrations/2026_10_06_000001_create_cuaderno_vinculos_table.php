<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cuaderno_vinculos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('costo_project_id')->constrained('costo_projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('entidad');
            $table->text('obra');
            $table->string('contrato')->nullable();
            $table->string('codigo_cui', 50)->nullable();
            $table->string('rol', 100);
            $table->string('external_id', 120)->nullable();
            $table->string('estado', 40)->default('pendiente_verificacion');
            // NULL for archived links permits history, while 1 is unique per project.
            $table->unsignedTinyInteger('active_slot')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->unique(['costo_project_id', 'active_slot']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cuaderno_vinculos');
    }
};
