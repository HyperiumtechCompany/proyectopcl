<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dialux_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dialux_project_id')
                ->constrained('dialux_projects')
                ->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('status', 32)->default('draft');
            $table->json('data')->nullable();
            $table->timestamps();

            $table->index(['dialux_project_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dialux_modules');
    }
};
