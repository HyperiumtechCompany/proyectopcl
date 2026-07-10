<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Amplía de DECIMAL(x,6) a DECIMAL(x,10) las columnas monetarias que participan
 * en el cálculo de precio_unitario/costo_directo. 6 decimales alcanzan para el
 * parcial de un ítem de ACU, pero costo_unitario_total/precio_unitario se
 * multiplican por el metrado de la partida — con metrados grandes (decenas de
 * miles), un error de redondeo en el séptimo decimal de precio_unitario se
 * amplifica a varios céntimos (ej. metrado=75,500.52 × error 0.00000044 =
 * 0.033 de diferencia entre Costo Directo e Insumos Consolidados, verificado
 * con datos reales). 10 decimales dejan ese error por debajo de un céntimo
 * incluso para metrados de cientos de millones.
 */
return new class extends Migration
{
    protected $connection = 'costos_tenant';

    private function widen(string $table, string $column, int $precision = 20, int $scale = 10): void
    {
        $schema = Schema::connection($this->connection);
        if (! $schema->hasTable($table) || ! $schema->hasColumn($table, $column)) {
            return;
        }

        DB::connection($this->connection)->statement(
            "ALTER TABLE {$table} MODIFY COLUMN {$column} DECIMAL({$precision},{$scale}) NOT NULL DEFAULT 0"
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
                'ALTER TABLE presupuesto_acus MODIFY COLUMN costo_unitario_total DECIMAL(20,10) GENERATED ALWAYS AS (costo_mano_obra + costo_materiales + costo_equipos + costo_subcontratos + costo_subpartidas) STORED'
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
        }

        $this->widen('presupuesto_general', 'precio_unitario');
        $this->widen('presupuesto_general', 'parcial');
    }

    public function down(): void
    {
        // Intencionalmente sin reversión: reducir la precisión perdería datos
        // ya guardados con 10 decimales.
    }
};
