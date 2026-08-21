<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dialux_electrical_networks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dialux_project_id')->unique()->constrained('dialux_projects')->cascadeOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->json('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dialux_electrical_networks');
    }
};
