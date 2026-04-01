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
        Schema::create('metrado_sanitarias_user_state', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('costo_projects')->cascadeOnDelete();
            $table->json('expanded_nodes')->nullable();
            $table->timestamp('updated_at')->useCurrent();

            // Unique constraint to ensure one state per user per project
            $table->unique(['user_id', 'project_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('metrado_sanitarias_user_state');
    }
};
