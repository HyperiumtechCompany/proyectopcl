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
            if (!Schema::connection($this->connection)->hasColumn('gg_consolidado', 'ggf_porcentaje')) {
                $table->decimal('ggf_porcentaje', 12, 4)->default(0)->after('comp_vi_monto');
            }
            if (!Schema::connection($this->connection)->hasColumn('gg_consolidado', 'ggv_porcentaje')) {
                $table->decimal('ggv_porcentaje', 12, 4)->default(0)->after('ggf_porcentaje');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            return;
        }

        Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
            if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'ggv_porcentaje')) {
                $table->dropColumn('ggv_porcentaje');
            }
            if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'ggf_porcentaje')) {
                $table->dropColumn('ggf_porcentaje');
            }
        });
    }
};
