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

        Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
            if (! Schema::connection($this->connection)->hasColumn('gg_consolidado', 'control_concurrente_porcentaje')) {
                // Porcentaje configurable de Control Concurrente (varía por tipo de proyecto: 0.5%, 0.6%, 2.0%, etc.)
                // Default 0.5% por ser el más común en proyectos CTAR/GORE Perú
                $table->decimal('control_concurrente_porcentaje', 8, 4)->default(0.6000)->after('total_control_concurrente');
            }
            if (! Schema::connection($this->connection)->hasColumn('gg_consolidado', 'total_control_concurrente_financiado')) {
                // Monto financiado de CC (= total_consolidado * control_concurrente_porcentaje / 100)
                $table->decimal('total_control_concurrente_financiado', 15, 4)->default(0)->after('control_concurrente_porcentaje');
            }
        });

    }

    public function down(): void
    {
        if (! Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            return;
        }

        Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
            $table->dropColumn(['control_concurrente_porcentaje', 'total_control_concurrente_financiado']);
        });

    }
};
