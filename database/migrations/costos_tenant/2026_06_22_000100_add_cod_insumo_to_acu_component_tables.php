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
                && ! Schema::connection($this->connection)->hasColumn($table, 'cod_insumo')) {
                Schema::connection($this->connection)->table($table, function (Blueprint $t) {
                    $t->string('cod_insumo', 50)->nullable()->after('insumo_id');
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
                && Schema::connection($this->connection)->hasColumn($table, 'cod_insumo')) {
                Schema::connection($this->connection)->table($table, function (Blueprint $t) {
                    $t->dropColumn('cod_insumo');
                });
            }
        }
    }
};
