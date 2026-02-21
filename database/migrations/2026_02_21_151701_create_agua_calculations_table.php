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
        Schema::create('agua_calculations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('project_name')->nullable();
            $table->json('data_sheet')->nullable();
            $table->boolean('is_collaborative')->default(false);
            $table->string('collab_code')->nullable();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agua_calculations');
    }
};
