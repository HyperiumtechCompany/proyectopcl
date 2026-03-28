<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // ══════════════════════════════════════════════════════════════════════
        // 4. ESPECIFICACIONES TÉCNICAS (ETTP) — Normalizado
        //    Flujo: Resúmenes de Metrados → ettp_partidas → secciones → imágenes
        // ══════════════════════════════════════════════════════════════════════

        // 4a. ETTP Partidas — Registro maestro por partida importada
        if (!Schema::connection($this->connection)->hasTable('ettp_partidas')) {
            Schema::connection($this->connection)->create('ettp_partidas', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->string('especialidad', 30)
                    ->comment('arquitectura|estructuras|sanitarias|electricas|comunicaciones|gas');

                $table->string('item', 30)->nullable()
                    ->comment('Código jerárquico: 02.01.01');
                $table->string('partida', 50)->nullable()
                    ->comment('Código de partida del resumen');
                $table->text('descripcion')->nullable()
                    ->comment('Título/nombre de la partida');
                $table->string('unidad', 20)->nullable();

                // ── Trazabilidad al resumen de metrado origen ──
                $table->unsignedBigInteger('resumen_source_id')->nullable()
                    ->comment('ID del registro en la tabla de resumen de metrado');
                $table->string('resumen_source_table', 80)->nullable()
                    ->comment('Tabla resumen origen: metrado_arquitectura_resumen, etc.');

                // ── Jerarquía ──
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->integer('item_order')->default(0);

                // ── Estado y sincronización ──
                $table->string('estado', 20)->default('pendiente')
                    ->comment('pendiente|en_progreso|completado');
                $table->boolean('huerfano')->default(false)
                    ->comment('True si la partida fue eliminada del resumen de metrados');

                $table->timestamps();

                $table->index('presupuesto_id', 'ettp_part_pres_idx');
                $table->index(['especialidad', 'presupuesto_id'], 'ettp_part_esp_pres_idx');
                $table->index('item_order', 'ettp_part_order_idx');
                $table->index('resumen_source_id', 'ettp_part_source_idx');
            });
        }

        // 4b. ETTP Secciones — Secciones variables por partida (1 a N)
        //     Cada partida puede tener secciones como: Descripción, Materiales,
        //     Método de Ejecución, Método de Medición, Condiciones de Pago, etc.
        //     El contenido puede ser texto extenso (500+ chars), listas, HTML.
        if (!Schema::connection($this->connection)->hasTable('ettp_secciones')) {
            Schema::connection($this->connection)->create('ettp_secciones', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('ettp_partida_id');
                $table->foreign('ettp_partida_id')
                    ->references('id')->on('ettp_partidas')
                    ->cascadeOnDelete();

                $table->string('titulo', 150)
                    ->comment('Ej: Descripción, Materiales y Herramientas, Método de Ejecución...');
                $table->string('slug', 100)
                    ->comment('Versión normalizada: descripcion, materiales, metodo_ejecucion...');
                $table->longText('contenido')->nullable()
                    ->comment('Texto enriquecido/HTML. Soporta textos extensos, listas, párrafos largos.');
                $table->string('origen', 20)->default('manual')
                    ->comment('manual|template|importado');
                $table->integer('orden')->default(0);

                $table->timestamps();

                $table->index('ettp_partida_id', 'ettp_secc_partida_idx');
            });
        }

        // 4c. ETTP Imágenes — Imágenes asociadas a cada sección
        //     Se almacenan en storage local, la BD guarda solo el nombre del archivo.
        //     Al eliminar el registro, se debe eliminar el archivo físico.
        if (!Schema::connection($this->connection)->hasTable('ettp_imagenes')) {
            Schema::connection($this->connection)->create('ettp_imagenes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('ettp_seccion_id');
                $table->foreign('ettp_seccion_id')
                    ->references('id')->on('ettp_secciones')
                    ->cascadeOnDelete();

                $table->string('nombre_archivo', 255)
                    ->comment('Nombre único en storage: {uuid}_{original}.{ext}');
                $table->string('nombre_original', 255)->nullable()
                    ->comment('Nombre original del archivo subido por el usuario');
                $table->string('caption', 255)->nullable()
                    ->comment('Descripción opcional de la imagen');
                $table->integer('orden')->default(0);
                $table->unsignedInteger('ancho')->nullable()->comment('Ancho en px');
                $table->unsignedInteger('alto')->nullable()->comment('Alto en px');

                $table->timestamps();

                $table->index('ettp_seccion_id', 'ettp_img_seccion_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('ettp_imagenes');
        Schema::connection($this->connection)->dropIfExists('ettp_secciones');
        Schema::connection($this->connection)->dropIfExists('ettp_partidas');
    }
};
