<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Versión LIGERA de un plano CAD pesado (DXF sin sombreados, imágenes ni
     * objetos proxy), generada en segundo plano por la cola: el navegador no
     * puede abrir un DWG/DXF de decenas de MB sin quedarse sin memoria.
     */
    public function up(): void
    {
        Schema::table('dialux_plans', function (Blueprint $table) {
            $table->string('light_status', 20)->nullable()->after('path');
            $table->string('light_path')->nullable()->after('light_status');
            $table->unsignedBigInteger('light_size_bytes')->nullable()->after('light_path');
            $table->text('light_error')->nullable()->after('light_size_bytes');
        });
    }

    public function down(): void
    {
        Schema::table('dialux_plans', function (Blueprint $table) {
            $table->dropColumn(['light_status', 'light_path', 'light_size_bytes', 'light_error']);
        });
    }
};
