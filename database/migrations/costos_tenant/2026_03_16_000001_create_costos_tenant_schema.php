<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COSTOS TENANT — ESQUEMA UNIFICADO v3
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Migración única que crea TODAS las tablas del tenant de costos en el
 * orden correcto de dependencias:
 *
 *   0. project_params            — parámetros globales centralizados
 *   1. presupuestos              — tabla maestra (padre de todo)
 *   2. Metrados (6 especialidades) — hojas de metrado vinculadas a presupuestos
 *   2b. Resúmenes de Metrados    — tablas de resumen (item, descripcion, und, parcial, total)
 *       · metrado_arquitectura_resumen
 *       · metrado_estructura_resumen
 *       · metrado_electricas_resumen
 *       · metrado_comunicaciones_resumen
 *       · metrado_gas_resumen
 *   3. Cronogramas (3 tipos)     — vinculados a presupuestos
 *   4. Especificaciones Técnicas — vinculados a presupuestos
 *   5. Presupuesto General       — partidas WBS
 *   6. GG Fijos + desagregados   — fianzas, pólizas
 *   7. GG Variables              — gastos variables
 *   8. Presupuesto Remuneraciones
 *   9. GG Supervisión + detalle GG
 *  10. GG Control Concurrente
 *  11. GG Consolidado            — caché de totales
 *  12. Presupuesto ACUs
 *  13. Presupuesto Insumos
 *  14. Presupuesto Índices (fórmula polinómica)
 *  15. Catálogos Insumos (clases + productos)
 *  16. Metrado Sanitarias Modular (config, módulos, exterior, cisterna, resumen)
 *  17. Metrado Estructuras Modular (config, metrado, resumen)
 *
 * Reemplaza las migraciones antiguas:
 *   - 2026_03_06_000001_create_project_meta_table.php
 *   - 2026_03_06_000002_create_costos_module_tables.php
 *   - 2026_03_07_000001_create_presupuesto_unificado_tables.php
 *   - 2026_03_13_000001_create_metrado_sanitarias_modular_tables.php
 *   - 2026_03_13_174330_add_node_type_and_titulo_to_metrado_sanitarias_tables.php
 *   - 2026_03_18_000001_create_metrado_estructuras_tables.php
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // ══════════════════════════════════════════════════════════════════════
        // 0. PROJECT PARAMS — parámetros globales centralizados
        //    Fuente única de verdad para todos los módulos del tenant.
        //    Sincronizado automáticamente desde costo_projects (BD principal).
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('project_params')) {
            Schema::connection($this->connection)->create('project_params', function (Blueprint $table) {
                $table->id();

                // ── Datos Generales (sync desde costo_projects) ──
                $table->string('nombre');
                $table->string('uei')->nullable();
                $table->string('unidad_ejecutora')->nullable();
                $table->string('codigo_snip')->nullable();
                $table->string('codigo_cui')->nullable();
                $table->string('codigo_local')->nullable();

                // ── Fechas y Duración (auto-calculados) ──
                $table->date('fecha_inicio')->nullable();
                $table->date('fecha_fin')->nullable();
                $table->unsignedSmallInteger('duracion_dias')->default(0)
                    ->comment('Auto: DATEDIFF(fecha_fin, fecha_inicio)');
                $table->decimal('duracion_meses', 8, 2)->default(0)
                    ->comment('Auto: duracion_dias / 30');

                // ── Ubicación (nombres resueltos) ──
                $table->string('departamento')->nullable();
                $table->string('provincia')->nullable();
                $table->string('distrito')->nullable();
                $table->string('centro_poblado')->nullable();

                // ── Parámetros Financieros Globales ──
                $table->decimal('costo_directo', 15, 4)->default(0)
                    ->comment('Sync desde SUM(presupuesto_general.parcial) de raíces');
                $table->decimal('utilidad_porcentaje', 5, 2)->default(10.00);
                $table->decimal('igv_porcentaje', 5, 2)->default(18.00);
                $table->decimal('jornada_laboral_horas', 4, 2)->default(8.00);
                $table->decimal('rmv', 10, 2)->default(1025.00)
                    ->comment('Remuneración Mínima Vital vigente');

                $table->timestamps();
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 1. PRESUPUESTOS — TABLA MAESTRA (padre de todo el sistema)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuestos')) {
            Schema::connection($this->connection)->create('presupuestos', function (Blueprint $table) {
                $table->id();
                $table->string('nombre');
                $table->text('descripcion')->nullable();
                $table->string('moneda', 20)->default('SOLES');
                $table->date('fecha')->nullable();
                $table->string('ubicacion')->nullable();
                $table->string('cliente')->nullable();
                $table->decimal('costo_directo', 15, 4)->default(0);
                $table->decimal('gastos_generales', 15, 4)->default(0);
                $table->decimal('utilidad', 15, 4)->default(0);
                $table->decimal('igv_porcentaje', 5, 2)->default(18.00);
                $table->decimal('total_presupuesto', 15, 4)->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 2. METRADOS — 6 especialidades, todas vinculadas a presupuestos
        //    Cada tabla tiene la misma estructura base + presupuesto_id
        // ══════════════════════════════════════════════════════════════════════
        $metradoTables = [
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_sanitarias',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
        ];

        foreach ($metradoTables as $tableName) {
            if (!Schema::connection($this->connection)->hasTable($tableName)) {
                Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                    $table->integer('item_order')->default(0);
                    $table->string('node_type', 20)->default('partida');
                    $table->string('titulo', 255)->nullable();
                    $table->string('item', 30)->nullable();
                    $table->string('partida', 50)->nullable();
                    $table->text('descripcion')->nullable();
                    $table->string('unidad', 20)->nullable();
                    $table->decimal('elsim', 12, 4)->default(0);
                    $table->decimal('largo', 12, 4)->default(0);
                    $table->decimal('ancho', 12, 4)->default(0);
                    $table->decimal('alto', 12, 4)->default(0);
                    $table->decimal('nveces', 12, 4)->default(0);
                    $table->decimal('lon', 12, 4)->default(0);
                    $table->decimal('area', 12, 4)->default(0);
                    $table->decimal('vol', 12, 4)->default(0);
                    $table->decimal('kg', 12, 4)->default(0);
                    $table->decimal('und', 14, 4)->default(0);
                    $table->decimal('total', 14, 4)->default(0);
                    $table->text('observacion')->nullable();
                    $table->unsignedBigInteger('parent_id')->nullable();
                    $table->integer('nivel')->default(0);
                    $table->timestamps();

                    $table->index('presupuesto_id');
                    $table->index('item_order');
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // 2b. RESÚMENES DE METRADOS — item, descripcion, und, parcial, total
        //     Una tabla por especialidad (arquitectura, estructura, electricas,
        //     comunicaciones, gas). Sanitarias tiene su propio módulo (#16).
        // ══════════════════════════════════════════════════════════════════════
        $resumenMetradoTables = [
            'metrado_arquitectura_resumen',
            'metrado_estructura_resumen',
            'metrado_electricas_resumen',
            'metrado_comunicaciones_resumen',
            'metrado_gas_resumen',
        ];

        foreach ($resumenMetradoTables as $resumenTable) {
            if (!Schema::connection($this->connection)->hasTable($resumenTable)) {
                Schema::connection($this->connection)->create($resumenTable, function (Blueprint $table) {
                    $table->id();
                    $table->unsignedBigInteger('presupuesto_id')->nullable();
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                    // Numeración / código de ítem (ej: 01, 01.01, 01.01.01)
                    $table->string('item', 30)->nullable()
                        ->comment('Código de ítem (p.ej. 01, 01.01)');

                    $table->string('node_type', 20)->default('partida')
                        ->comment('titulo | partida — para agrupar encabezados');
                    $table->string('titulo', 255)->nullable()
                        ->comment('Texto del encabezado cuando node_type=titulo');
                    $table->text('descripcion')->nullable()
                        ->comment('Descripción de la partida');

                    $table->string('und', 20)->nullable()
                        ->comment('Unidad de medida (m2, m3, kg, gl, etc.)');

                    // Parcial = cantidad de una sub-fila (sin FK cruzada)
                    $table->decimal('parcial', 14, 4)->default(0)
                        ->comment('Metrado parcial de esta fila');

                    // Total = suma de parciales hijos, o valor directo en hoja
                    $table->decimal('total', 14, 4)->default(0)
                        ->comment('Total acumulado de la partida/título');

                    $table->text('observacion')->nullable();
                    $table->unsignedBigInteger('parent_id')->nullable()
                        ->comment('FK self-referencing para jerarquía');
                    $table->integer('nivel')->default(0);
                    $table->integer('item_order')->default(0);
                    $table->timestamps();

                    $table->index('presupuesto_id');
                    $table->index('parent_id');
                    $table->index('item_order');
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // 3. CRONOGRAMAS — 3 tipos, vinculados a presupuestos
        // ══════════════════════════════════════════════════════════════════════

        // 3a. Cronograma General (tipo Gantt)
        if (!Schema::connection($this->connection)->hasTable('cronograma_general')) {
            Schema::connection($this->connection)->create('cronograma_general', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->integer('duracion_dias')->default(0);
                $table->date('fecha_inicio')->nullable();
                $table->date('fecha_fin')->nullable();
                $table->decimal('avance', 8, 4)->default(0);
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->json('predecesoras')->nullable();
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // 3b. Cronograma Valorizado (distribución mensual del presupuesto)
        if (!Schema::connection($this->connection)->hasTable('cronograma_valorizado')) {
            Schema::connection($this->connection)->create('cronograma_valorizado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->decimal('presupuesto_total', 14, 4)->default(0);
                $table->json('distribucion_mensual')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // 3c. Cronograma de Materiales (adquisición de materiales por mes)
        if (!Schema::connection($this->connection)->hasTable('cronograma_materiales')) {
            Schema::connection($this->connection)->create('cronograma_materiales', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('cantidad_total', 14, 4)->default(0);
                $table->decimal('precio_unitario', 14, 4)->default(0);
                $table->decimal('presupuesto_total', 14, 4)->default(0);
                $table->json('distribucion_mensual')->nullable();
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 4. ESPECIFICACIONES TÉCNICAS — vinculadas a presupuestos
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('especificaciones_tecnicas')) {
            Schema::connection($this->connection)->create('especificaciones_tecnicas', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();

                $table->integer('item_order')->default(0);
                $table->string('partida', 50)->nullable();
                $table->text('titulo')->nullable();
                $table->longText('descripcion')->nullable();
                $table->longText('materiales')->nullable();
                $table->longText('procedimiento')->nullable();
                $table->longText('medicion')->nullable();
                $table->longText('forma_pago')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->string('especialidad', 30)->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 5. PRESUPUESTO GENERAL — partidas WBS
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_general')) {
            Schema::connection($this->connection)->create('presupuesto_general', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('partida', 50);
                $table->text('descripcion');
                $table->string('unidad', 20)->nullable();
                $table->decimal('metrado', 15, 4)->default(0);
                $table->decimal('precio_unitario', 15, 4)->default(0);
                $table->decimal('parcial', 15, 4)->storedAs('metrado * precio_unitario')
                    ->comment('metrado × precio_unitario');

                $table->string('metrado_source', 50)->nullable();
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id', 'idx_pg_presupuesto');
                $table->index('partida',        'idx_pg_partida');
                $table->index('item_order',     'idx_pg_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 6. GG FIJOS — árbol principal (seccion → grupo → detalle)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_fijos')) {
            Schema::connection($this->connection)->create('gg_fijos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('parent_id')->nullable();
                $table->foreign('parent_id')->references('id')->on('gg_fijos')->nullOnDelete();
                $table->enum('tipo_fila', ['seccion', 'grupo', 'detalle'])->default('detalle')
                    ->comment('seccion=nivel1, grupo=nivel2, detalle=fila editable');

                $table->enum('tipo_calculo', [
                    'manual',
                    'fianza_fiel_cumplimiento',
                    'fianza_adelanto_efectivo',
                    'fianza_adelanto_materiales',
                    'poliza_car',
                    'poliza_sctr',
                    'poliza_essalud_vida',
                    'sencico',
                    'itf',
                ])->default('manual')->comment('Tipo de tabla desagregada vinculada');

                $table->string('item_codigo', 20)->nullable();
                $table->text('descripcion');
                $table->string('unidad', 20)->nullable();

                $table->decimal('cantidad',       15, 4)->default(0);
                $table->decimal('costo_unitario', 15, 4)->default(0);
                $table->decimal('parcial',        15, 4)->storedAs('cantidad * costo_unitario')
                    ->comment('cantidad × costo_unitario');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id', 'idx_ggf_presupuesto');
                $table->index('parent_id',      'idx_ggf_parent');
                $table->index('tipo_calculo',   'idx_ggf_tipo');
                $table->index('item_order',     'idx_ggf_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 6a. GG FIJOS DESAGREGADO — FIANZAS
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_fijos_fianzas')) {
            Schema::connection($this->connection)->create('gg_fijos_fianzas', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('gg_fijos_id')->nullable();
                $table->foreign('gg_fijos_id')->references('id')->on('gg_fijos')->nullOnDelete();

                $table->enum('tipo_fianza', [
                    'fiel_cumplimiento',
                    'adelanto_efectivo',
                    'adelanto_materiales',
                ])->comment('Tipo de fianza que aplica');

                $table->text('descripcion');

                $table->decimal('base_calculo',          15, 4)->default(0)
                    ->comment('Monto del contrato (sub-total sin IGV)');
                $table->decimal('garantia_porcentaje',    5, 2)->default(10.00)
                    ->comment('% de garantía exigida');
                $table->decimal('tea_porcentaje',         8, 6)->default(0)
                    ->comment('TEA % anual');
                $table->decimal('tea_360_dias',          10, 8)->storedAs('tea_porcentaje / 360')
                    ->comment('TEA diaria = TEA% / 360');

                $table->unsignedSmallInteger('duracion_obra_dias')->nullable()
                    ->comment('Duración de la obra en días');
                $table->unsignedSmallInteger('duracion_liquidacion_dias')->nullable()
                    ->comment('Plazo de liquidación en días');

                $table->decimal('factor_porcentaje',  5, 2)->nullable()
                    ->comment('Factor del tramo');
                $table->decimal('avance_porcentaje',  5, 2)->nullable()
                    ->comment('% de avance comprometido');
                $table->unsignedSmallInteger('renovacion_dias')->nullable()
                    ->comment('Días de renovación c/3 meses');

                $table->decimal('garantia_fc_sin_igv', 15, 4)->default(0)
                    ->comment('Garantía FC calculada sin IGV — actualizado por service');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_fianza_presupuesto');
                $table->index('gg_fijos_id',    'idx_fianza_gg_fijos');
                $table->index('tipo_fianza',    'idx_fianza_tipo');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 6b. GG FIJOS DESAGREGADO — PÓLIZAS DE SEGUROS
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_fijos_polizas')) {
            Schema::connection($this->connection)->create('gg_fijos_polizas', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('gg_fijos_id')->nullable();
                $table->foreign('gg_fijos_id')->references('id')->on('gg_fijos')->nullOnDelete();

                $table->enum('tipo_poliza', [
                    'car',
                    'sctr_salud',
                    'sctr_pension',
                    'essalud_vida',
                    'sencico',
                    'itf',
                ])->comment('Tipo de póliza/tributo');

                $table->text('descripcion');

                $table->decimal('base_calculo',   15, 4)->default(0)
                    ->comment('Monto sobre el que se aplica la tasa');
                $table->decimal('tea_porcentaje', 8, 6)->default(0)
                    ->comment('Tasa % aplicable');
                $table->decimal('tea_360_dias', 10, 8)->storedAs('tea_porcentaje / 360')
                    ->comment('Tasa diaria = tea% / 360');
                $table->unsignedSmallInteger('duracion_dias')->default(0)
                    ->comment('Vigencia en días');

                $table->decimal('poliza_sin_igv', 15, 4)->default(0)
                    ->comment('Monto póliza/tributo sin IGV — actualizado por service');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_poliza_presupuesto');
                $table->index('gg_fijos_id',    'idx_poliza_gg_fijos');
                $table->index('tipo_poliza',    'idx_poliza_tipo');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 7. GG VARIABLES — árbol con vínculo opcional a remuneraciones
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_variables')) {
            Schema::connection($this->connection)->create('gg_variables', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('parent_id')->nullable();
                $table->foreign('parent_id')->references('id')->on('gg_variables')->nullOnDelete();
                $table->enum('tipo_fila', ['seccion', 'grupo', 'detalle'])->default('detalle');
                $table->string('item_codigo', 20)->nullable();
                $table->text('descripcion');
                $table->string('unidad', 20)->nullable();

                $table->decimal('cantidad_descripcion', 15, 4)->default(0)
                    ->comment('Cantidad del insumo/recurso');
                $table->decimal('cantidad_tiempo',      15, 4)->default(0)
                    ->comment('N° de meses o períodos');
                $table->decimal('participacion',         5, 2)->default(100.00)
                    ->comment('% participación en el proyecto');
                $table->decimal('precio',               15, 4)->default(0)
                    ->comment('Precio unitario');

                $table->decimal('parcial', 15, 4)->storedAs('
                    cantidad_descripcion * cantidad_tiempo * (participacion / 100) * precio
                ')->comment('cant_desc × cant_tiempo × part% × precio');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id',  'idx_ggv_presupuesto');
                $table->index('parent_id',       'idx_ggv_parent');
                $table->index('item_order',      'idx_ggv_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 8. PRESUPUESTO REMUNERACIONES (Detalle de GG Variables)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_remuneraciones')) {
            Schema::connection($this->connection)->create('presupuesto_remuneraciones', function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('gg_variable_id')->nullable();
                $table->foreign('gg_variable_id')->references('id')->on('gg_variables')->nullOnDelete();

                $table->string('cargo', 100);
                $table->string('categoria', 50)->nullable()->comment('Profesional | Técnico | Auxiliar');

                $table->decimal('participacion', 5, 2)->default(100.00);
                $table->decimal('cantidad',      15, 4)->default(1);
                $table->decimal('meses',         15, 4)->default(1);

                $table->decimal('sueldo_basico',       15, 2)->default(0);
                $table->decimal('asignacion_familiar', 15, 2)->default(0);
                $table->decimal('snp',                 15, 2)->default(0);
                $table->decimal('essalud',             15, 2)->default(0);
                $table->decimal('cts',                 15, 2)->default(0);
                $table->decimal('vacaciones',          15, 2)->default(0);
                $table->decimal('gratificacion',       15, 2)->default(0);

                $table->decimal('total_mensual_unitario', 15, 4)->storedAs('
                    sueldo_basico + asignacion_familiar + essalud + cts + vacaciones + gratificacion
                ');

                $table->decimal('total_proyecto', 15, 4)->storedAs('
                    (sueldo_basico + asignacion_familiar + essalud + cts + vacaciones + gratificacion)
                    * cantidad * meses * (participacion / 100)
                ');

                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id', 'idx_rem_presupuesto');
                $table->index('gg_variable_id', 'idx_rem_ggv');
                $table->index('categoria',      'idx_rem_categoria');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 9. GG SUPERVISIÓN
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_supervision')) {
            Schema::connection($this->connection)->create('gg_supervision', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('parent_id')->nullable();
                $table->foreign('parent_id')->references('id')->on('gg_supervision')->nullOnDelete();
                $table->enum('tipo_fila', ['etapa', 'seccion', 'detalle'])->default('detalle')
                    ->comment('etapa=I Supervisión / II Recepción, seccion=A/B/C, detalle=fila');

                $table->string('item_codigo', 20)->nullable()
                    ->comment('Ej: I, I.A, I.A.1');
                $table->text('concepto');
                $table->string('unidad', 20)->nullable();

                $table->decimal('cantidad', 15, 4)->default(0);
                $table->decimal('meses',    15, 4)->default(0)->comment('Tiempo en meses');
                $table->decimal('importe',  15, 4)->default(0)->comment('Precio/importe unitario');

                $table->decimal('subtotal', 15, 4)->storedAs('cantidad * meses * importe')
                    ->comment('cantidad × meses × importe');

                $table->decimal('total_seccion', 15, 4)->default(0)
                    ->comment('SUM(subtotal hijos) — actualizado por GgSupervisionService');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id', 'idx_ggsup_presupuesto');
                $table->index('parent_id',      'idx_ggsup_parent');
                $table->index('item_order',     'idx_ggsup_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 9b. SUPERVISIÓN — DETALLE GASTOS GENERALES (Sección IV)
        //     Árbol: seccion (A/B/C) → detalle (filas editables)
        //     El total global alimenta el campo IV del presupuesto supervisión.
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('supervision_gg_detalle')) {
            Schema::connection($this->connection)->create('supervision_gg_detalle', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('parent_id')->nullable();
                $table->foreign('parent_id')->references('id')->on('supervision_gg_detalle')->nullOnDelete();

                $table->enum('tipo_fila', ['seccion', 'detalle'])->default('detalle')
                    ->comment('seccion=A/B/C header, detalle=fila editable');

                $table->string('item_codigo', 20)->nullable()
                    ->comment('Ej: A, B, C, A.1, B.2');
                $table->text('concepto');
                $table->string('unidad', 20)->nullable();

                $table->decimal('cantidad', 15, 4)->default(0);
                $table->decimal('meses',    15, 4)->default(0)->comment('Tiempo en meses');
                $table->decimal('importe',  15, 4)->default(0)->comment('Importe unitario S/.');

                $table->decimal('subtotal', 15, 4)->storedAs('cantidad * meses * importe')
                    ->comment('cantidad × meses × importe');

                $table->decimal('total_seccion', 15, 4)->default(0)
                    ->comment('SUM(subtotal de hijos detalle) — actualizado al guardar');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id', 'idx_sgd_presupuesto');
                $table->index('parent_id',      'idx_sgd_parent');
                $table->index('item_order',     'idx_sgd_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 10. GG CONTROL CONCURRENTE
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_control_concurrente')) {
            Schema::connection($this->connection)->create('gg_control_concurrente', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->unsignedBigInteger('parent_id')->nullable();
                $table->foreign('parent_id')->references('id')->on('gg_control_concurrente')->nullOnDelete();
                $table->enum('tipo_fila', ['seccion', 'detalle'])->default('detalle');

                $table->string('item_codigo', 20)->nullable();
                $table->text('descripcion');
                $table->string('unidad', 20)->nullable();

                $table->decimal('cantidad_descripcion', 15, 4)->default(0)
                    ->comment('Cantidad del concepto');
                $table->decimal('cantidad_tiempo',      15, 4)->default(0)
                    ->comment('Período/meses');
                $table->decimal('participacion',         5, 2)->default(100.00)
                    ->comment('% participación');
                $table->decimal('precio_unitario',      15, 4)->default(0)
                    ->comment('Precio unitario');

                $table->decimal('sub_total', 15, 4)->storedAs('
                    cantidad_descripcion * cantidad_tiempo * (participacion / 100) * precio_unitario
                ')->comment('cant_desc × cant_tiempo × part% × precio');

                $table->decimal('total_seccion', 15, 4)->default(0)
                    ->comment('SUM(sub_total hijos) — actualizado por service');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_ggcc_presupuesto');
                $table->index('parent_id',      'idx_ggcc_parent');
                $table->index('item_order',     'idx_ggcc_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 11. GG CONSOLIDADO — caché de totales + resumen
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            Schema::connection($this->connection)->create('gg_consolidado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->unique();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                // Totales fuente
                $table->decimal('total_costo_directo',       15, 4)->default(0);
                $table->decimal('total_gg_fijos',            15, 4)->default(0);
                $table->decimal('total_gg_variables',        15, 4)->default(0);
                $table->decimal('total_supervision',         15, 4)->default(0);
                $table->decimal('total_control_concurrente', 15, 4)->default(0);

                // Inputs de porcentaje (absorbido de 2026_03_19_000001)
                $table->decimal('utilidad_porcentaje',    12, 4)->default(5.00);
                $table->decimal('igv_porcentaje',         12, 4)->default(18.00);
                $table->decimal('componente_ii_monto',    15, 4)->default(0);
                $table->longText('componentes_extra_json')->nullable();

                // Componentes I–VI
                $table->decimal('comp_i_costo_directo',            15, 4)->default(0);
                $table->decimal('comp_i_porcentaje',               12, 4)->default(0);
                $table->decimal('comp_ii_gastos_generales',        15, 4)->default(0);
                $table->decimal('comp_ii_porcentaje',              12, 4)->default(0);
                $table->decimal('comp_iii_utilidad',               15, 4)->default(0);
                $table->decimal('comp_iii_porcentaje',             12, 4)->default(0);
                $table->decimal('comp_iv_subtotal_sin_igv',        15, 4)->default(0);
                $table->decimal('comp_iv_porcentaje',              12, 4)->default(0);
                $table->decimal('comp_v_igv',                      15, 4)->default(0);
                $table->decimal('comp_v_porcentaje',               12, 4)->default(18.00);
                $table->decimal('comp_vi_valor_con_igv',           15, 4)->default(0);
                $table->decimal('comp_vi_porcentaje',              12, 4)->default(0);

                // Totales finales
                $table->decimal('total_presupuesto_obra',          15, 4)->default(0);
                $table->decimal('total_con_igv',                   15, 4)->default(0);
                $table->decimal('total_inversion_obra',            15, 4)->default(0);

                // Conversión a letras
                $table->string('total_letras', 500)->nullable();
                $table->string('total_inversion_obra_letras', 500)->nullable();

                // Indicadores
                $table->decimal('porcentaje_gg_sobre_cd',          12, 4)->default(0);
                $table->decimal('porcentaje_supervision_sobre_cd', 12, 4)->default(0);

                $table->timestamp('calculado_at')->nullable();
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_ggcon_presupuesto');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 12. PRESUPUESTO ACUs (Análisis de Costos Unitarios)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_acus')) {
            Schema::connection($this->connection)->create('presupuesto_acus', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('partida', 50);
                $table->text('descripcion');
                $table->string('unidad', 20);
                $table->decimal('rendimiento', 10, 4)->default(1);

                $table->json('mano_de_obra')->nullable();
                $table->decimal('costo_mano_obra',    15, 4)->default(0);
                $table->json('materiales')->nullable();
                $table->decimal('costo_materiales',   15, 4)->default(0);
                $table->json('equipos')->nullable();
                $table->decimal('costo_equipos',      15, 4)->default(0);
                $table->json('subcontratos')->nullable();
                $table->decimal('costo_subcontratos', 15, 4)->default(0);
                $table->json('subpartidas')->nullable();
                $table->decimal('costo_subpartidas',  15, 4)->default(0);

                $table->decimal('costo_unitario_total', 15, 4)->storedAs('
                    costo_mano_obra + costo_materiales + costo_equipos
                    + costo_subcontratos + costo_subpartidas
                ');

                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_acu_presupuesto');
                $table->index('partida',        'idx_acu_partida');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 13. PRESUPUESTO INSUMOS (catálogo por proyecto)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_insumos')) {
            Schema::connection($this->connection)->create('presupuesto_insumos', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 50)->unique();
                $table->text('descripcion');
                $table->string('unidad', 20);
                $table->decimal('precio_unitario', 15, 4)->default(0);
                $table->string('tipo', 20)->comment('material | mano_obra | equipo');
                $table->string('categoria', 50)->nullable();
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('codigo', 'idx_ins_codigo');
                $table->index('tipo',   'idx_ins_tipo');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 14. PRESUPUESTO ÍNDICES (fórmula polinómica)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_indices')) {
            Schema::connection($this->connection)->create('presupuesto_indices', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('simbolo', 10)->comment('M, MO, EQ, GG');
                $table->text('descripcion');
                $table->decimal('coeficiente',   10, 6)->default(0);
                $table->decimal('indice_base',   15, 4)->default(100);
                $table->decimal('indice_actual', 15, 4)->default(100);
                $table->decimal('monomio',       10, 6)
                    ->storedAs('coeficiente * (indice_actual / indice_base)');
                $table->date('fecha_indice_base')->nullable();
                $table->date('fecha_indice_actual')->nullable();
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_idx_presupuesto');
                $table->index('simbolo',        'idx_idx_simbolo');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 15. CATÁLOGOS GLOBALES DE INSUMOS (sin presupuesto_id)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('insumo_clases')) {
            Schema::connection($this->connection)->create('insumo_clases', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 20)->unique();
                $table->string('descripcion', 255);
                $table->timestamps();

                $table->index('codigo', 'idx_ic_codigo');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('insumo_productos')) {
            Schema::connection($this->connection)->create('insumo_productos', function (Blueprint $table) {
                $table->id();
                $table->string('codigo_producto', 50)->unique();
                $table->text('descripcion');
                $table->text('especificaciones')->nullable();
                $table->string('unidad', 20);
                $table->decimal('costo_unitario_lista', 15, 4)->default(0);
                $table->decimal('costo_unitario',       15, 4)->default(0);
                $table->decimal('costo_flete',          15, 4)->default(0);
                $table->date('fecha_lista')->nullable();
                $table->unsignedBigInteger('insumo_clase_id');
                $table->foreign('insumo_clase_id')->references('id')->on('insumo_clases')->cascadeOnDelete();
                $table->string('tipo', 20)->comment('mano_de_obra | materiales | equipos');
                $table->boolean('estado')->default(true);
                $table->timestamps();

                $table->index('codigo_producto', 'idx_ip_codigo');
                $table->index('tipo',            'idx_ip_tipo');
                $table->index('insumo_clase_id', 'idx_ip_clase');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 16. METRADO SANITARIAS MODULAR
        // ══════════════════════════════════════════════════════════════════════

        // 16a. Configuración del módulo sanitarias
        if (!Schema::connection($this->connection)->hasTable('metrado_sanitarias_config')) {
            Schema::connection($this->connection)->create('metrado_sanitarias_config', function (Blueprint $table) {
                $table->id();
                $table->integer('cantidad_modulos')->default(1);
                $table->string('nombre_proyecto', 255)->nullable();
                $table->timestamps();
            });
        }

        // 16b. Módulos dinámicos (N hojas con misma estructura)
        if (!Schema::connection($this->connection)->hasTable('metrado_sanitarias_modulos')) {
            Schema::connection($this->connection)->create('metrado_sanitarias_modulos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                $table->integer('modulo_numero')->default(1);
                $table->string('modulo_nombre', 100)->nullable();
                $table->integer('item_order')->default(0);
                $table->string('node_type', 20)->default('partida');
                $table->string('titulo', 255)->nullable();
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('elsim', 12, 4)->default(0);
                $table->decimal('largo', 12, 4)->default(0);
                $table->decimal('ancho', 12, 4)->default(0);
                $table->decimal('alto', 12, 4)->default(0);
                $table->decimal('nveces', 12, 4)->default(0);
                $table->decimal('lon', 12, 4)->default(0);
                $table->decimal('area', 12, 4)->default(0);
                $table->decimal('vol', 12, 4)->default(0);
                $table->decimal('kg', 12, 4)->default(0);
                $table->decimal('und', 14, 4)->default(0);
                $table->decimal('total', 14, 4)->default(0);
                $table->text('observacion')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
                $table->index(['presupuesto_id', 'modulo_numero', 'item_order']);
            });
        }

        // 16c. Red Exterior
        if (!Schema::connection($this->connection)->hasTable('metrado_sanitarias_exterior')) {
            Schema::connection($this->connection)->create('metrado_sanitarias_exterior', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                $table->integer('item_order')->default(0);
                $table->string('node_type', 20)->default('partida');
                $table->string('titulo', 255)->nullable();
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('elsim', 12, 4)->default(0);
                $table->decimal('largo', 12, 4)->default(0);
                $table->decimal('ancho', 12, 4)->default(0);
                $table->decimal('alto', 12, 4)->default(0);
                $table->decimal('nveces', 12, 4)->default(0);
                $table->decimal('lon', 12, 4)->default(0);
                $table->decimal('area', 12, 4)->default(0);
                $table->decimal('vol', 12, 4)->default(0);
                $table->decimal('kg', 12, 4)->default(0);
                $table->decimal('und', 14, 4)->default(0);
                $table->decimal('total', 14, 4)->default(0);
                $table->text('observacion')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // 16d. Cisterna / Tanque Elevado
        if (!Schema::connection($this->connection)->hasTable('metrado_sanitarias_cisterna')) {
            Schema::connection($this->connection)->create('metrado_sanitarias_cisterna', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                $table->integer('item_order')->default(0);
                $table->string('node_type', 20)->default('partida');
                $table->string('titulo', 255)->nullable();
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('elsim', 12, 4)->default(0);
                $table->decimal('largo', 12, 4)->default(0);
                $table->decimal('ancho', 12, 4)->default(0);
                $table->decimal('alto', 12, 4)->default(0);
                $table->decimal('nveces', 12, 4)->default(0);
                $table->decimal('lon', 12, 4)->default(0);
                $table->decimal('area', 12, 4)->default(0);
                $table->decimal('vol', 12, 4)->default(0);
                $table->decimal('kg', 12, 4)->default(0);
                $table->decimal('und', 14, 4)->default(0);
                $table->decimal('total', 14, 4)->default(0);
                $table->text('observacion')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // 16e. Resumen Consolidado
        if (!Schema::connection($this->connection)->hasTable('metrado_sanitarias_resumen')) {
            Schema::connection($this->connection)->create('metrado_sanitarias_resumen', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                $table->integer('item_order')->default(0);
                $table->string('node_type', 20)->default('partida');
                $table->string('titulo', 255)->nullable();
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('total_modulos', 14, 4)->default(0);
                $table->decimal('total_exterior', 14, 4)->default(0);
                $table->decimal('total_cisterna', 14, 4)->default(0);
                $table->decimal('total_general', 14, 4)->default(0);
                $table->text('observacion')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 17. METRADO ESTRUCTURAS
        //     Dos tablas: metrado_estructuras (hoja principal) + resumen.
        //     Ambas vinculadas a presupuesto_id.
        // ══════════════════════════════════════════════════════════════════════

        // 17a. Hoja principal de metrado estructuras
        if (!Schema::connection($this->connection)->hasTable('metrado_estructuras_metrado')) {
            Schema::connection($this->connection)->create('metrado_estructuras_metrado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                $table->integer('item_order')->default(0);
                $table->string('node_type', 20)->default('partida');
                $table->string('titulo', 255)->nullable();
                $table->string('item', 30)->nullable();
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('elsim', 12, 4)->default(0);
                $table->decimal('largo', 12, 4)->default(0);
                $table->decimal('ancho', 12, 4)->default(0);
                $table->decimal('alto', 12, 4)->default(0);
                $table->decimal('nveces', 12, 4)->default(0);
                $table->decimal('lon', 12, 4)->default(0);
                $table->decimal('area', 12, 4)->default(0);
                $table->decimal('vol', 12, 4)->default(0);
                $table->decimal('kg', 12, 4)->default(0);
                $table->decimal('und', 14, 4)->default(0);
                $table->decimal('total', 14, 4)->default(0);
                $table->text('observacion')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
                $table->index('item_order');
            });
        }

        // 17b. Resumen Consolidado de Estructuras
        if (!Schema::connection($this->connection)->hasTable('metrado_estructuras_resumen')) {
            Schema::connection($this->connection)->create('metrado_estructuras_resumen', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->nullable();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                $table->integer('item_order')->default(0);
                $table->string('node_type', 20)->default('partida');
                $table->string('titulo', 255)->nullable();
                $table->string('partida', 50)->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad', 20)->nullable();
                $table->decimal('total', 14, 4)->default(0);
                $table->text('observacion')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->integer('nivel')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id');
            });
        }
    }

    public function down(): void
    {
        // Orden inverso estricto respetando todas las FKs

        // 17. Metrado Estructuras
        Schema::connection($this->connection)->dropIfExists('metrado_estructuras_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_estructuras_metrado');

        // 16. Metrado Sanitarias Modular
        Schema::connection($this->connection)->dropIfExists('metrado_sanitarias_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_sanitarias_cisterna');
        Schema::connection($this->connection)->dropIfExists('metrado_sanitarias_exterior');
        Schema::connection($this->connection)->dropIfExists('metrado_sanitarias_modulos');
        Schema::connection($this->connection)->dropIfExists('metrado_sanitarias_config');

        // 15. Catálogos Insumos
        Schema::connection($this->connection)->dropIfExists('insumo_productos');
        Schema::connection($this->connection)->dropIfExists('insumo_clases');

        // 14–12. Índices, Insumos, ACUs
        Schema::connection($this->connection)->dropIfExists('presupuesto_indices');
        Schema::connection($this->connection)->dropIfExists('presupuesto_insumos');
        Schema::connection($this->connection)->dropIfExists('presupuesto_acus');

        // 11–9. GG Consolidado, Control Concurrente, Supervisión
        Schema::connection($this->connection)->dropIfExists('gg_consolidado');
        Schema::connection($this->connection)->dropIfExists('gg_control_concurrente');
        Schema::connection($this->connection)->dropIfExists('supervision_gg_detalle');
        Schema::connection($this->connection)->dropIfExists('gg_supervision');

        // 8–6. Remuneraciones, GG Variables, GG Fijos
        Schema::connection($this->connection)->dropIfExists('presupuesto_remuneraciones');
        Schema::connection($this->connection)->dropIfExists('gg_variables');
        Schema::connection($this->connection)->dropIfExists('gg_fijos_polizas');
        Schema::connection($this->connection)->dropIfExists('gg_fijos_fianzas');
        Schema::connection($this->connection)->dropIfExists('gg_fijos');

        // 5. Presupuesto General
        Schema::connection($this->connection)->dropIfExists('presupuesto_general');

        // 4–3. Especificaciones y Cronogramas
        Schema::connection($this->connection)->dropIfExists('especificaciones_tecnicas');
        Schema::connection($this->connection)->dropIfExists('cronograma_materiales');
        Schema::connection($this->connection)->dropIfExists('cronograma_valorizado');
        Schema::connection($this->connection)->dropIfExists('cronograma_general');

        // 2b. Resúmenes de Metrados
        Schema::connection($this->connection)->dropIfExists('metrado_gas_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_comunicaciones_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_electricas_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_estructura_resumen');
        Schema::connection($this->connection)->dropIfExists('metrado_arquitectura_resumen');

        // 2. Metrados principales
        Schema::connection($this->connection)->dropIfExists('metrado_gas');
        Schema::connection($this->connection)->dropIfExists('metrado_comunicaciones');
        Schema::connection($this->connection)->dropIfExists('metrado_electricas');
        Schema::connection($this->connection)->dropIfExists('metrado_sanitarias');
        Schema::connection($this->connection)->dropIfExists('metrado_estructura');
        Schema::connection($this->connection)->dropIfExists('metrado_arquitectura');

        // 1–0. Presupuestos y parámetros
        Schema::connection($this->connection)->dropIfExists('presupuestos');
        Schema::connection($this->connection)->dropIfExists('project_params');
    }
};
