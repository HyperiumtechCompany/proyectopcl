<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('presupuesto_proyectos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre')->nullable();     
            $table->string('codigo')->unique()->nullable(); 
            $table->json('months')->nullable();              
            $table->json('data')->nullable();                
            $table->enum('status', ['draft', 'active', 'archived'])->default('draft'); 
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('presupuesto_proyectos');
    }
};