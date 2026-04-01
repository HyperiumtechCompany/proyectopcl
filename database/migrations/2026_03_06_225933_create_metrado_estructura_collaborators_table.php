<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metrado_estructura_collaborators', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('metrado_estructura_spreadsheet_id');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('role', ['viewer', 'editor'])->default('viewer');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            // Clave foránea con nombre corto
            $table->foreign('metrado_estructura_spreadsheet_id', 'fk_estru_collab_spreadsheet')
                  ->references('id')
                  ->on('metrado_estructura_spreadsheets')
                  ->onDelete('cascade');

            // Índice único con nombre corto
            $table->unique(['metrado_estructura_spreadsheet_id', 'user_id'], 'unique_estru_collab');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrado_estructura_collaborators');
    }
};