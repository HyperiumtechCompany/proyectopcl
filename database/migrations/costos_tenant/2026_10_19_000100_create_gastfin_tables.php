<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gast. Fin. (Gastos Financieros, modo de Delphin). Reutiliza mantenimiento_documentos como
 * cabecera (origen = 'delphin', un documento por presupuesto) y solo guarda la EJECUCIÓN: el
 * Expediente Técnico se consolida en vivo desde presupuesto_general + presupuesto_acus.
 *
 * grupo_ref = código raíz normalizado del padre de nivel 1 ("04"; "_" = SIN NIVEL). NO es
 * presupuesto_general.id: guardar el presupuesto desde Delphin borra y reinserta todas las filas,
 * así que los ids cambian en cada guardado (ver _000110). insumo_key = tipo|descripción|unidad
 * normalizados, la misma clave de consolidateInsumos() — los ids de acu_* tampoco sirven porque se
 * borran y reinsertan en cada guardado del ACU.
 *
 * Idempotente (hasTable/hasColumn): ver incidente _000090 del módulo Mantenimiento.
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (! $schema->hasColumn('mantenimiento_documentos', 'origen')) {
            $schema->table('mantenimiento_documentos', function (Blueprint $table) {
                $table->string('origen', 20)->default('mantenimiento')->after('public_id');
                $table->unsignedBigInteger('presupuesto_id')->nullable()->after('origen');
                $table->unique(['presupuesto_id', 'origen'], 'uq_mdoc_presupuesto_origen'); // NULLs (Mantenimiento) no colisionan
            });
        }

        if (! $schema->hasTable('gastfin_grupos')) {
            $schema->create('gastfin_grupos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
                $table->string('grupo_ref', 20)->comment('código raíz normalizado del nivel 1, p. ej. 04');
                $table->string('tipo', 20)->nullable()->comment('modulo | institucion | piso');
                $table->bigInteger('mo_aprobado_minor')->nullable();
                $table->bigInteger('mat_aprobado_minor')->nullable();
                $table->timestamps();
                $table->unique(['documento_id', 'grupo_ref'], 'uq_gf_grupo');
            });
        }

        if (! $schema->hasTable('gastfin_mo_pagos')) {
            $schema->create('gastfin_mo_pagos', function (Blueprint $table) {
                $table->id();
                $table->char('public_id', 26)->unique();
                $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
                $table->string('nombre', 60);
                $table->date('fecha')->nullable();
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (! $schema->hasTable('gastfin_mo_pago_valores')) {
            $schema->create('gastfin_mo_pago_valores', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pago_id')->constrained('gastfin_mo_pagos')->cascadeOnDelete();
                $table->string('grupo_ref', 20)->comment('código raíz normalizado del nivel 1, p. ej. 04');
                $table->string('franja', 20)->comment('valorizacion | adelanto');
                $table->string('etiqueta', 40)->nullable();
                $table->bigInteger('monto_minor')->nullable();
                $table->timestamps();
                $table->unique(['pago_id', 'grupo_ref', 'franja'], 'uq_gf_mo_valor');
            });
        }

        if (! $schema->hasTable('gastfin_mat_insumos')) {
            $schema->create('gastfin_mat_insumos', function (Blueprint $table) {
                $table->id();
                $table->char('public_id', 26)->unique();
                $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
                $table->string('grupo_ref', 20)->comment('código raíz normalizado del nivel 1, p. ej. 04');
                $table->string('insumo_key', 255);
                $table->text('descripcion');
                $table->string('unidad', 20)->nullable();
                $table->boolean('manual')->default(false);
                $table->decimal('cot_cantidad', 15, 4)->nullable();
                $table->decimal('cot_precio', 15, 4)->nullable();
                $table->integer('sort_order')->default(0);
                $table->timestamps();
                $table->unique(['documento_id', 'grupo_ref', 'insumo_key'], 'uq_gf_mat_insumo');
            });
        }

        if (! $schema->hasTable('gastfin_mat_compras')) {
            $schema->create('gastfin_mat_compras', function (Blueprint $table) {
                $table->id();
                $table->char('public_id', 26)->unique();
                $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
                $table->string('grupo_ref', 20)->comment('código raíz normalizado del nivel 1, p. ej. 04');
                $table->date('fecha')->nullable();
                $table->integer('sort_order')->default(0);
                $table->timestamps();
                $table->index(['documento_id', 'grupo_ref'], 'idx_gf_mat_compra_grupo');
            });
        }

        if (! $schema->hasTable('gastfin_mat_compra_valores')) {
            $schema->create('gastfin_mat_compra_valores', function (Blueprint $table) {
                $table->id();
                $table->foreignId('compra_id')->constrained('gastfin_mat_compras')->cascadeOnDelete();
                $table->foreignId('insumo_id')->constrained('gastfin_mat_insumos')->cascadeOnDelete();
                $table->decimal('cantidad', 15, 4)->nullable();
                $table->decimal('precio', 15, 4)->nullable();
                $table->string('proveedor', 120)->nullable();
                $table->timestamps();
                $table->unique(['compra_id', 'insumo_id'], 'uq_gf_mat_compra_valor');
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        $schema->dropIfExists('gastfin_mat_compra_valores');
        $schema->dropIfExists('gastfin_mat_compras');
        $schema->dropIfExists('gastfin_mat_insumos');
        $schema->dropIfExists('gastfin_mo_pago_valores');
        $schema->dropIfExists('gastfin_mo_pagos');
        $schema->dropIfExists('gastfin_grupos');

        if ($schema->hasColumn('mantenimiento_documentos', 'origen')) {
            $schema->table('mantenimiento_documentos', function (Blueprint $table) {
                $table->dropUnique('uq_mdoc_presupuesto_origen');
                $table->dropColumn(['origen', 'presupuesto_id']);
            });
        }
    }
};
