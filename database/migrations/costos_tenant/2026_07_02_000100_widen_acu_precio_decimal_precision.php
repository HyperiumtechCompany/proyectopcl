<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Amplía de DECIMAL(x,4) a DECIMAL(x,6) las columnas que participan en el
 * cálculo de precio_unitario/costo_directo. Antes, el ACU redondeaba cada
 * insumo y cada subtotal a 2 decimales antes de sumarlos, así que el
 * precio_unitario que llegaba a Costo Directo (ej. 1.48) no coincidía con
 * el que Insumos Consolidados recomponía a partir de los montos sin ese
 * redondeo intermedio (ej. 1.479333) — la vista seguía mostrando 2
 * decimales, pero el cálculo interno ahora conserva 6.
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    private function widen(string $table, string $column, int $precision = 15): void
    {
        $schema = Schema::connection($this->connection);
        if (! $schema->hasTable($table) || ! $schema->hasColumn($table, $column)) {
            return;
        }

        DB::connection($this->connection)->statement(
            "ALTER TABLE {$table} MODIFY COLUMN {$column} DECIMAL({$precision},6) NOT NULL DEFAULT 0"
        );
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        foreach ([
            'costo_mano_obra',
            'costo_materiales',
            'costo_equipos',
            'costo_subcontratos',
            'costo_subpartidas',
        ] as $column) {
            $this->widen('presupuesto_acus', $column);
        }

        if ($schema->hasTable('presupuesto_acus') && $schema->hasColumn('presupuesto_acus', 'costo_unitario_total')) {
            DB::connection($this->connection)->statement(
                'ALTER TABLE presupuesto_acus MODIFY COLUMN costo_unitario_total DECIMAL(15,6) GENERATED ALWAYS AS (costo_mano_obra + costo_materiales + costo_equipos + costo_subcontratos + costo_subpartidas) STORED'
            );
        }

        foreach ([
            'acu_mano_de_obra' => 'precio_unitario',
            'acu_materiales' => 'precio_unitario',
            'acu_equipos' => 'precio_hora',
            'acu_subcontratos' => 'precio_unitario',
            'acu_subpartidas' => 'precio_unitario',
        ] as $table => $priceColumn) {
            $this->widen($table, $priceColumn);
            $this->widen($table, 'parcial');
            // cantidad (12,4) truncaba fracciones derivadas de rendimiento (ej. 8/120 =
            // 0.0667 en vez de 0.066667), que es otra fuente de la misma divergencia.
            $this->widen($table, 'cantidad', 12);
        }

        $this->widen('presupuesto_general', 'precio_unitario');
        $this->widen('presupuesto_general', 'parcial');
    }

    public function down(): void
    {
        // Intencionalmente sin reversión: reducir la precisión perdería datos
        // ya guardados con 6 decimales.
    }
};
