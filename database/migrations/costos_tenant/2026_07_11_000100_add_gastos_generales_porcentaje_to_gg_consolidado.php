<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            return;
        }

        if (! Schema::connection($this->connection)->hasColumn('gg_consolidado', 'gastos_generales_porcentaje')) {
            Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
                // Nullable: cuando está definido, Gastos Generales se calcula como
                // porcentaje × Costo Directo (igual que Utilidad) en vez de sumar
                // las partidas de gg_fijos/gg_variables — para proyectos que aún no
                // tienen esas partidas desagregadas y solo quieren un % directo.
                $table->decimal('gastos_generales_porcentaje', 12, 4)->nullable()->after('utilidad_porcentaje');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            return;
        }

        if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'gastos_generales_porcentaje')) {
            Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
                $table->dropColumn('gastos_generales_porcentaje');
            });
        }
    }
};
