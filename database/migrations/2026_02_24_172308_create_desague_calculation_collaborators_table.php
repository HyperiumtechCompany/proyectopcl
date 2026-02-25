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
        Schema::create('desague_calculation_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('desague_calculation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('viewer'); // 'editor', 'viewer', etc.
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['desague_calculation_id', 'user_id'], 'desague_collab_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('desague_calculation_collaborators');
    }
};
