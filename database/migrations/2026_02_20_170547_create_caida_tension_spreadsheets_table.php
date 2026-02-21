<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caida_tension_spreadsheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name')->default('Sin nombre');
            $table->string('project_name')->nullable();
            $table->json('td_data')->nullable();       // Árbol de Tableros de Distribución
            $table->json('tg_data')->nullable();       // Datos de Tablero General (sobreescritos por TD)
            $table->json('selection_data')->nullable(); // Datos de Selección de Grupo Electrógeno
            // Colaboración
            $table->boolean('is_collaborative')->default(false);
            $table->string('collab_code', 16)->nullable()->unique();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('caida_tension_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('spreadsheet_id')
                ->constrained('caida_tension_spreadsheets')
                ->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['viewer', 'editor'])->default('editor');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['spreadsheet_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('caida_tension_collaborators');
        Schema::dropIfExists('caida_tension_spreadsheets');
    }
};
