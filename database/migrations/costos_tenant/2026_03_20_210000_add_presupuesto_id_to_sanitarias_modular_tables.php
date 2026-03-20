<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FIX: Agrega presupuesto_id a las tablas de Metrado Sanitarias Modular
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Las tablas metrado_sanitarias_modulos, metrado_sanitarias_exterior,
 * metrado_sanitarias_cisterna y metrado_sanitarias_resumen fueron creadas
 * originalmente SIN presupuesto_id. Esta migración las corrige en bases de
 * datos ya existentes.
 *
 * Bases de datos nuevas ya obtienen presupuesto_id directamente desde
 * 2026_03_16_000001_create_costos_tenant_schema.php (sección 16b-16e).
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // ── 16b. metrado_sanitarias_modulos ──────────────────────────────────
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_modulos')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_modulos', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_modulos', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                    $table->index(['presupuesto_id', 'modulo_numero', 'item_order'], 'idx_san_mod_pres_mod_order');
                }
            });
        }

        // ── 16c. metrado_sanitarias_exterior ─────────────────────────────────
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_exterior')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_exterior', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_exterior', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                }
            });
        }

        // ── 16d. metrado_sanitarias_cisterna ─────────────────────────────────
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_cisterna')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_cisterna', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_cisterna', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                }
            });
        }

        // ── 16e. metrado_sanitarias_resumen ──────────────────────────────────
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_resumen')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_resumen', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_resumen', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                }
            });
        }

        // ── Absorber: gg_consolidado inputs ──────────────────────────────────
        // (Consolida 2026_03_19_000001_add_inputs_to_gg_consolidado.php)
        if (Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('gg_consolidado', 'utilidad_porcentaje')) {
                    $table->decimal('utilidad_porcentaje', 12, 4)->default(5.00)->after('total_control_concurrente');
                }
                if (!Schema::connection($this->connection)->hasColumn('gg_consolidado', 'igv_porcentaje')) {
                    $table->decimal('igv_porcentaje', 12, 4)->default(18.00)->after('utilidad_porcentaje');
                }
                if (!Schema::connection($this->connection)->hasColumn('gg_consolidado', 'componente_ii_monto')) {
                    $table->decimal('componente_ii_monto', 15, 4)->default(0)->after('igv_porcentaje');
                }
                if (!Schema::connection($this->connection)->hasColumn('gg_consolidado', 'componentes_extra_json')) {
                    $table->longText('componentes_extra_json')->nullable()->after('componente_ii_monto');
                }

                // Absorber: precision changes de 2026_03_19_221237
                $table->decimal('comp_i_porcentaje',               12, 4)->default(0)->change();
                $table->decimal('comp_ii_porcentaje',              12, 4)->default(0)->change();
                $table->decimal('comp_iii_porcentaje',             12, 4)->default(0)->change();
                $table->decimal('comp_iv_porcentaje',              12, 4)->default(0)->change();
                $table->decimal('comp_v_porcentaje',               12, 4)->default(18.00)->change();
                $table->decimal('comp_vi_porcentaje',              12, 4)->default(0)->change();
                $table->decimal('porcentaje_gg_sobre_cd',          12, 4)->default(0)->change();
                $table->decimal('porcentaje_supervision_sobre_cd', 12, 4)->default(0)->change();
            });
        }

        // ── Absorber: node_type + item a metrado tables ───────────────────────
        // (Consolida 2026_03_20_000001_add_node_type_to_metrado_tables.php)
        $metradoTables = [
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
        ];

        foreach ($metradoTables as $tbl) {
            if (Schema::connection($this->connection)->hasTable($tbl)) {
                Schema::connection($this->connection)->table($tbl, function (Blueprint $table) use ($tbl) {
                    if (!Schema::connection($this->connection)->hasColumn($tbl, 'node_type')) {
                        $table->string('node_type', 20)->default('partida')->after('item_order');
                    }
                    if (!Schema::connection($this->connection)->hasColumn($tbl, 'titulo')) {
                        $table->string('titulo', 255)->nullable()->after('node_type');
                    }
                    if (!Schema::connection($this->connection)->hasColumn($tbl, 'item')) {
                        $table->string('item', 30)->nullable()->after('titulo');
                    }
                });
            }
        }

        // ── presupuesto_id en metrado_estructuras_metrado y resumen ───────────
        foreach (['metrado_estructuras_metrado', 'metrado_estructuras_resumen'] as $tbl) {
            if (Schema::connection($this->connection)->hasTable($tbl)) {
                Schema::connection($this->connection)->table($tbl, function (Blueprint $table) use ($tbl) {
                    if (!Schema::connection($this->connection)->hasColumn($tbl, 'presupuesto_id')) {
                        $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                        $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                        $table->index('presupuesto_id');
                    }
                    if ($tbl === 'metrado_estructuras_metrado') {
                        if (!Schema::connection($this->connection)->hasColumn($tbl, 'item')) {
                            $table->string('item', 30)->nullable()->after('titulo');
                        }
                    }
                });
            }
        }
    }

    public function down(): void
    {
        // Sanitarias: drop presupuesto_id
        foreach ([
            'metrado_sanitarias_resumen',
            'metrado_sanitarias_cisterna',
            'metrado_sanitarias_exterior',
            'metrado_sanitarias_modulos',
        ] as $tbl) {
            if (Schema::connection($this->connection)->hasTable($tbl)
                && Schema::connection($this->connection)->hasColumn($tbl, 'presupuesto_id')) {
                Schema::connection($this->connection)->table($tbl, function (Blueprint $table) {
                    $table->dropForeign(['presupuesto_id']);
                    $table->dropColumn('presupuesto_id');
                });
            }
        }
    }
};
