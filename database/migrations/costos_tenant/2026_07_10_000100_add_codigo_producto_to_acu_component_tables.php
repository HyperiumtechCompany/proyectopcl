<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $tables = [
            'acu_mano_de_obra',
            'acu_materiales',
            'acu_equipos',
            'acu_subcontratos',
            'acu_subpartidas',
        ];

        foreach ($tables as $table) {
            if (Schema::connection($this->connection)->hasTable($table)
                && ! Schema::connection($this->connection)->hasColumn($table, 'codigo_producto')) {
                Schema::connection($this->connection)->table($table, function (Blueprint $t) {
                    // cod_insumo guarda el código INEI corto (diccionario.codigo, ej. "47"),
                    // usado por la Fórmula Polinómica para agrupar. codigo_producto guarda el
                    // código compuesto completo del catálogo (insumo_productos.codigo_producto,
                    // ej. "021060001") para referencia futura (búsqueda exacta del insumo,
                    // re-sincronización de precios, exportaciones), sin perderlo al resolver
                    // el código corto en cod_insumo.
                    $t->string('codigo_producto', 50)->nullable()->after('cod_insumo');
                });
            }
        }
    }

    public function down(): void
    {
        $tables = [
            'acu_mano_de_obra',
            'acu_materiales',
            'acu_equipos',
            'acu_subcontratos',
            'acu_subpartidas',
        ];

        foreach ($tables as $table) {
            if (Schema::connection($this->connection)->hasTable($table)
                && Schema::connection($this->connection)->hasColumn($table, 'codigo_producto')) {
                Schema::connection($this->connection)->table($table, function (Blueprint $t) {
                    $t->dropColumn('codigo_producto');
                });
            }
        }
    }
};
