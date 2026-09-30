<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Elección de capas del plano ligero: el DXF ya convertido (para no
     * reconvertir el DWG al cambiar de capas) y el análisis de pesos por capa
     * que el editor muestra para elegir.
     */
    public function up(): void
    {
        Schema::table('dialux_plans', function (Blueprint $table) {
            $table->string('light_converted_path')->nullable()->after('light_path');
            $table->json('light_layers')->nullable()->after('light_error');
        });
    }

    public function down(): void
    {
        Schema::table('dialux_plans', function (Blueprint $table) {
            $table->dropColumn(['light_converted_path', 'light_layers']);
        });
    }
};
