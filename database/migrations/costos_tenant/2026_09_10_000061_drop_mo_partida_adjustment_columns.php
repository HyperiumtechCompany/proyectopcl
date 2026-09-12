<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        // Adelanto y "herramientas y equipos" dejan de ser columnas fijas:
        // ahora son parciales P.M.O etiquetados (mismo tipo de movimiento).
        foreach (['adelanto_minor', 'herramientas_minor'] as $column) {
            if ($schema->hasColumn('mantenimiento_mo_partida', $column)) {
                $schema->table('mantenimiento_mo_partida', function (Blueprint $table) use ($column) {
                    $table->dropColumn($column);
                });
            }
        }
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        $schema->table('mantenimiento_mo_partida', function (Blueprint $table) use ($schema) {
            if (! $schema->hasColumn('mantenimiento_mo_partida', 'adelanto_minor')) {
                $table->bigInteger('adelanto_minor')->default(0);
            }
            if (! $schema->hasColumn('mantenimiento_mo_partida', 'herramientas_minor')) {
                $table->bigInteger('herramientas_minor')->default(0);
            }
        });
    }
};
