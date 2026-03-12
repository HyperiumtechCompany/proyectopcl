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
        Schema::create('costo_project_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('costo_project_id')->constrained('costo_projects')->cascadeOnDelete();

            $table->string('module_type'); // e.g. metrado_arquitectura, crono_general, presupuesto_gg, etts
            $table->boolean('enabled')->default(true);

            $table->timestamps();

            $table->unique(['costo_project_id', 'module_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('costo_project_modules');
    }
};
