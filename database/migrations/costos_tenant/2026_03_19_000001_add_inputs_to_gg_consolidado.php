<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (!Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            return;
        }

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
        });
    }

    public function down(): void
    {
        if (!Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            return;
        }

        Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
            if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'componentes_extra_json')) {
                $table->dropColumn('componentes_extra_json');
            }
            if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'componente_ii_monto')) {
                $table->dropColumn('componente_ii_monto');
            }
            if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'igv_porcentaje')) {
                $table->dropColumn('igv_porcentaje');
            }
            if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'utilidad_porcentaje')) {
                $table->dropColumn('utilidad_porcentaje');
            }
        });
    }
};
