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
        Schema::create('metrado_sanitarias_nodes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('project_id')->constrained('costo_projects')->cascadeOnDelete();
            $table->uuid('parent_id')->nullable();
            $table->enum('node_type', ['titulo', 'subtitulo', 'partida']);
            $table->string('name', 255);
            $table->string('numbering', 50)->nullable();
            $table->string('unit', 50)->nullable();
            $table->integer('level');
            $table->integer('position');
            $table->timestamps();

            // Foreign key constraint for parent_id with cascade delete
            $table->foreign('parent_id')
                ->references('id')
                ->on('metrado_sanitarias_nodes')
                ->cascadeOnDelete();

            // Indexes for performance
            $table->index(['project_id', 'parent_id'], 'idx_project_parent');
            $table->index(['project_id', 'level'], 'idx_project_level');
            $table->index(['parent_id', 'position'], 'idx_position');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('metrado_sanitarias_nodes');
    }
};
