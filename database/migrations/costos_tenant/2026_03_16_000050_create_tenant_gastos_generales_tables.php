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

                // Inputs de porcentaje
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
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('gg_consolidado');
        Schema::connection($this->connection)->dropIfExists('gg_control_concurrente');
        Schema::connection($this->connection)->dropIfExists('supervision_gg_detalle');
        Schema::connection($this->connection)->dropIfExists('gg_supervision');
        Schema::connection($this->connection)->dropIfExists('presupuesto_remuneraciones');
        Schema::connection($this->connection)->dropIfExists('gg_variables');
        Schema::connection($this->connection)->dropIfExists('gg_fijos_polizas');
        Schema::connection($this->connection)->dropIfExists('gg_fijos_fianzas');
        Schema::connection($this->connection)->dropIfExists('gg_fijos');
    }
};
