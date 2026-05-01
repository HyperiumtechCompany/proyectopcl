<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('presupuesto_proyectos', function (Blueprint $table) {
            $table->string('codigo')->unique()->nullable()->after('nombre');
            $table->json('months')->nullable()->after('codigo');
            $table->enum('status', ['draft', 'active', 'archived'])->default('draft')->after('data');
        });
    }

    public function down(): void
    {
        Schema::table('presupuesto_proyectos', function (Blueprint $table) {
            $table->dropColumn(['codigo', 'months', 'status']);
        });
    }
};