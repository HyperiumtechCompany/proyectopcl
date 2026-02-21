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
        Schema::create('ac_calculation_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ac_calculation_id')
                ->constrained('ac_calculations')
                ->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['viewer', 'editor'])->default('editor');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['ac_calculation_id', 'user_id'], 'ac_calcs_collab_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ac_calculation_collaborators');
    }
};
