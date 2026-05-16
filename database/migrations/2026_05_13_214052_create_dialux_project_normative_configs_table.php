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
        Schema::create('dialux_project_normative_configs', function (Blueprint $table) {
            $table->id();

            // Identificador del proyecto DIALux (UUID gestionado en Zustand)
            $table->string('dialux_project_id')->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Ubicación del proyecto
            $table->string('country_code', 2)->default('PE');   // ISO 3166-1 alpha-2
            $table->string('region')->default('americas_peru'); // europe|americas_usa|americas_peru

            // Tipo de instalación seleccionado por el usuario
            $table->string('installation_type')->nullable(); // vivienda, educacion, salud, etc.

            // Norma primaria obligatoria y normas de referencia
            $table->string('primary_standard')->default('rne_peru'); // en_12464|ies_na|rne_peru
            $table->json('reference_standards')->nullable();          // ["en_12464","ies_na"]

            // Orden de prioridad normativa (array ordenado)
            $table->json('priority_order')->nullable();

            // Opciones de configuración del flujo guiado
            $table->boolean('auto_detect_enabled')->default(true);
            $table->boolean('cross_norm_comparison_enabled')->default(true);

            // Resumen de cumplimiento (caché del último cálculo)
            $table->integer('total_rooms')->default(0);
            $table->integer('compliant_rooms')->default(0);
            $table->integer('non_compliant_rooms')->default(0);
            $table->integer('warning_rooms')->default(0);
            $table->integer('needs_review_rooms')->default(0);

            // Trazabilidad normativa
            $table->string('normative_version')->nullable(); // e.g. "EN 12464-1:2021"
            $table->date('norms_consulted_at')->nullable();
            $table->text('disclaimer')->nullable();

            // Notas libres del proyectista
            $table->text('notes')->nullable();

            $table->timestamps();

            // Un proyecto + usuario → una sola configuración normativa activa
            $table->unique(['dialux_project_id', 'user_id'], 'dialux_norm_project_user_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dialux_project_normative_configs');
    }
};
