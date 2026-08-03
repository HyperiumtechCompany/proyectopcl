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
        Schema::create('dialux_electrical_projects', function (Blueprint $table) {
            $table->id();

            // Identificador del proyecto DIALux (UUID gestionado en Zustand)
            $table->string('dialux_project_id')->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Parámetros eléctricos generales del proyecto
            $table->string('reference_standard')->default('CNE-Utilización'); // norma eléctrica
            $table->unsignedSmallInteger('voltage_v')->default(220);
            $table->unsignedTinyInteger('phases')->default(1);   // 1 = monofásico, 3 = trifásico
            $table->unsignedTinyInteger('frequency_hz')->default(60);

            // Documento eléctrico completo: pisos, ambientes, luminarias asignadas,
            // tomacorrientes, circuitos, tableros, alimentadores y metrados.
            $table->json('data')->nullable();

            // Resumen (caché para listados sin deserializar el documento)
            $table->unsignedInteger('total_rooms')->default(0);
            $table->unsignedInteger('total_luminaires')->default(0);
            $table->unsignedInteger('total_outlets')->default(0);
            $table->unsignedInteger('total_panels')->default(0);
            $table->decimal('installed_power_w', 12, 2)->default(0);

            $table->timestamps();

            // Un proyecto + usuario → un solo documento eléctrico activo
            $table->unique(['dialux_project_id', 'user_id'], 'dialux_elec_project_user_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dialux_electrical_projects');
    }
};
