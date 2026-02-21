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
        Schema::create('spatt_pararrayo_spreadsheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name')->default('Sin nombre');
            $table->string('project_name')->nullable();
            $table->json('pozo_data')->nullable();
            $table->json('pararrayo_data')->nullable();
            $table->boolean('is_collaborative')->default(false);
            $table->string('collab_code', 16)->nullable()->unique();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('spatt_pararrayo_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('spreadsheet_id')
                ->constrained('spatt_pararrayo_spreadsheets')
                ->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['viewer', 'editor'])->default('editor');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['spreadsheet_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spatt_pararrayo_collaborators');
        Schema::dropIfExists('spatt_pararrayo_spreadsheets');
    }
};
