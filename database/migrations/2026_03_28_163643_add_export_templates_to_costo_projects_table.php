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
        Schema::table('costo_projects', function (Blueprint $table) {
            $table->string('plantilla_logo_izq')->nullable()->after('status');
            $table->string('plantilla_logo_der')->nullable()->after('plantilla_logo_izq');
            $table->string('portada_logo_center')->nullable()->after('plantilla_logo_der');
            $table->string('plantilla_firma')->nullable()->after('portada_logo_center');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('costo_projects', function (Blueprint $table) {
            $table->dropColumn(['plantilla_logo_izq', 'plantilla_logo_der', 'portada_logo_center', 'plantilla_firma']);
        });
    }
};
