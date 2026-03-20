<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (Schema::connection($this->connection)->hasTable('gg_consolidado')) {
            Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
                // Increase precision to 12,4 to prevent Out-of-Range 500 errors when 
                // total_gastos_generales vastly exceeds costo_directo (e.g., intermediate entry stages).
                $table->decimal('comp_i_porcentaje', 12, 4)->default(0)->change();
                $table->decimal('comp_ii_porcentaje', 12, 4)->default(0)->change();
                $table->decimal('comp_iii_porcentaje', 12, 4)->default(0)->change();
                $table->decimal('comp_iv_porcentaje', 12, 4)->default(0)->change();
                $table->decimal('comp_v_porcentaje', 12, 4)->default(18.00)->change();
                $table->decimal('comp_vi_porcentaje', 12, 4)->default(0)->change();
                $table->decimal('porcentaje_gg_sobre_cd', 12, 4)->default(0)->change();
                $table->decimal('porcentaje_supervision_sobre_cd', 12, 4)->default(0)->change();
                
                if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'utilidad_porcentaje')) {
                    $table->decimal('utilidad_porcentaje', 12, 4)->default(5.00)->change();
                }
                if (Schema::connection($this->connection)->hasColumn('gg_consolidado', 'igv_porcentaje')) {
                    $table->decimal('igv_porcentaje', 12, 4)->default(18.00)->change();
                }
            });
        }
    }

    public function down(): void
    {
        // No down needed, high precision won't break anything.
    }
};
