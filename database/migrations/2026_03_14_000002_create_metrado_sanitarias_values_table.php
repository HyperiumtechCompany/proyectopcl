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
        Schema::create('metrado_sanitarias_values', function (Blueprint $table) {
            $table->id();
            $table->uuid('node_id');
            $table->foreignId('module_id')->constrained('costo_project_modules')->cascadeOnDelete();
            $table->decimal('value', 10, 2)->default(0);
            $table->timestamps();

            // Foreign key constraint for node_id with cascade delete
            $table->foreign('node_id')
                ->references('id')
                ->on('metrado_sanitarias_nodes')
                ->cascadeOnDelete();

            // Unique constraint to prevent duplicate values for same node and module
            $table->unique(['node_id', 'module_id']);

            // Index for performance
            $table->index('node_id', 'idx_node');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('metrado_sanitarias_values');
    }
};
