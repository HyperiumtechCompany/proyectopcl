<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metrados_electricas_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('metrado_electricas_id')
                  ->constrained('metrados_electricas')
                  ->cascadeOnDelete();
            $table->foreignId('user_id')
                  ->constrained('users')
                  ->cascadeOnDelete();
            
            // Rol del colaborador: 'viewer' (solo lectura) o 'editor' (puede editar)
            $table->enum('role', ['viewer', 'editor'])->default('viewer');
            $table->timestamp('joined_at')->useCurrent();
            
            $table->unique(['metrado_electricas_id', 'user_id']);
            $table->index(['user_id', 'joined_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrados_electricas_collaborators');
    }
};

