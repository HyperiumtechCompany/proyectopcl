<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Patch legacy bases: agrega presupuesto_id a las tablas del módulo
 * "Metrado Sanitarias Modular". Para instalaciones nuevas ya está
 * resuelto en 2026_03_16_000001_create_costos_tenant_schema.php.
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // 16b. metrado_sanitarias_modulos
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

        // 16c. metrado_sanitarias_exterior
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_exterior')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_exterior', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_exterior', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                }
            });
        }

        // 16d. metrado_sanitarias_cisterna
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_cisterna')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_cisterna', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_cisterna', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                }
            });
        }

        // 16e. metrado_sanitarias_resumen
        if (Schema::connection($this->connection)->hasTable('metrado_sanitarias_resumen')) {
            Schema::connection($this->connection)->table('metrado_sanitarias_resumen', function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn('metrado_sanitarias_resumen', 'presupuesto_id')) {
                    $table->unsignedBigInteger('presupuesto_id')->nullable()->after('id');
                    $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->nullOnDelete();
                    $table->index('presupuesto_id');
                }
            });
        }
    }

    public function down(): void
    {
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
