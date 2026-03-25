<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metrado_estructura_spreadsheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('project_name')->nullable();
            $table->string('project_location')->nullable();
            $table->string('building_type')->nullable();
            $table->string('structural_system')->nullable();
            $table->json('sheet_data')->nullable();
            $table->boolean('is_collaborative')->default(false);
            $table->string('collab_code', 8)->nullable()->unique();
            $table->timestamps(); // Esto crea created_at y updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrado_estructura_spreadsheets');
    }
};