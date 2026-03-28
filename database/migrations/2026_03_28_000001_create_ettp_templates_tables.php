<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Templates globales de ETTP — BD principal
     * Compartidos entre todos los proyectos/tenants.
     */
    public function up(): void
    {
        // ══════════════════════════════════════════════════════════════════════
        // ETTP TEMPLATES — Plantillas reutilizables (global)
        // ══════════════════════════════════════════════════════════════════════

        if (!Schema::hasTable('ettp_templates')) {
            Schema::create('ettp_templates', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 50)
                    ->comment('Código de partida para matching: 01.01, 02.03.01, etc.');
                $table->string('titulo', 255)
                    ->comment('Nombre legible del template');
                $table->string('especialidad', 30)
                    ->comment('arquitectura|estructuras|sanitarias|electricas|comunicaciones|gas');
                $table->string('categoria', 50)->nullable()
                    ->comment('Agrupación opcional: cimentaciones, acabados, etc.');
                $table->boolean('activo')->default(true);
                $table->timestamps();

                $table->index(['especialidad', 'codigo'], 'ettp_tmpl_esp_cod_idx');
                $table->index('activo', 'ettp_tmpl_activo_idx');
            });
        }

        if (!Schema::hasTable('ettp_template_secciones')) {
            Schema::create('ettp_template_secciones', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('ettp_template_id');
                $table->foreign('ettp_template_id')
                    ->references('id')->on('ettp_templates')
                    ->cascadeOnDelete();

                $table->string('titulo', 150)
                    ->comment('Nombre de la sección: Descripción, Materiales, etc.');
                $table->string('slug', 100)
                    ->comment('Slug normalizado: descripcion, materiales, etc.');
                $table->longText('contenido_default')->nullable()
                    ->comment('Contenido predefinido del template para esta sección');
                $table->integer('orden')->default(0);

                $table->timestamps();

                $table->index('ettp_template_id', 'ettp_tmpl_secc_tmpl_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ettp_template_secciones');
        Schema::dropIfExists('ettp_templates');
    }
};
