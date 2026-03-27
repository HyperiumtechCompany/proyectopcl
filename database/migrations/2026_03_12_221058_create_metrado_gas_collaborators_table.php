<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metrado_gas_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('metrado_gas_spreadsheet_id')
                  ->constrained('metrado_gas_spreadsheets')
                  ->onDelete('cascade');
            $table->foreignId('user_id')
                  ->constrained()
                  ->onDelete('cascade');
            $table->enum('role', ['viewer', 'editor'])->default('viewer');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['metrado_gas_spreadsheet_id', 'user_id'], 'unique_gas_collab');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrado_gas_collaborators');
    }
};