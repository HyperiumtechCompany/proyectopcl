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
        Schema::create('gestor_proyecto_nodos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gestor_proyecto_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('gestor_proyecto_nodos')->cascadeOnDelete();
            $table->string('title');
            $table->enum('type', ['text', 'table', 'image', 'video'])->default('text');
            $table->enum('shape', ['circle', 'square'])->default('square');
            $table->enum('color', ['violet', 'sky', 'emerald', 'amber', 'rose', 'fuchsia', 'cyan'])->default('violet');
            $table->enum('status', ['Completo', 'En curso', 'Pendiente'])->default('Pendiente');
            $table->json('content')->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gestor_proyecto_nodos');
    }
};
