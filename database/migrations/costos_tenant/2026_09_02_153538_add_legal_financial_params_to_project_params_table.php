<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::connection('costos_tenant')->table('project_params', function (Blueprint $table) {
            $table->decimal('asignacion_familiar_factor', 12, 4)->default(46)->after('rmv');
            $table->decimal('snp_porcentaje', 8, 4)->default(13)->after('asignacion_familiar_factor');
            $table->decimal('essalud_porcentaje', 8, 4)->default(9)->after('snp_porcentaje');
            $table->decimal('cts_porcentaje', 8, 4)->default(8.3333)->after('essalud_porcentaje');
            $table->decimal('gratificacion_porcentaje', 8, 4)->default(8.3333)->after('cts_porcentaje');
            $table->decimal('vacaciones_porcentaje', 8, 4)->default(8.3333)->after('gratificacion_porcentaje');
            $table->decimal('sencico_porcentaje', 8, 4)->default(0.2)->after('vacaciones_porcentaje');
            $table->decimal('itf_porcentaje', 8, 4)->default(0.005)->after('sencico_porcentaje');
            $table->decimal('itf_cargo_adicional', 15, 4)->default(0)->after('itf_porcentaje');
            $table->decimal('control_concurrente_porcentaje', 8, 4)->default(0.6)->after('itf_cargo_adicional');
            $table->decimal('sctr_salud_porcentaje', 8, 4)->default(0.5)->after('control_concurrente_porcentaje');
            $table->decimal('sctr_pension_porcentaje', 8, 4)->default(1.5)->after('sctr_salud_porcentaje');
            $table->decimal('poliza_essalud_vida_porcentaje', 8, 4)->default(0.53)->after('sctr_pension_porcentaje');
            $table->decimal('seguro_car_porcentaje', 8, 4)->default(0.3)->after('poliza_essalud_vida_porcentaje');
            $table->decimal('recargo_administrativo_cc_porcentaje', 8, 4)->default(15)->after('seguro_car_porcentaje');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('costos_tenant')->table('project_params', function (Blueprint $table) {
            $table->dropColumn([
                'asignacion_familiar_factor',
                'snp_porcentaje',
                'essalud_porcentaje',
                'cts_porcentaje',
                'gratificacion_porcentaje',
                'vacaciones_porcentaje',
                'sencico_porcentaje',
                'itf_porcentaje',
                'itf_cargo_adicional',
                'control_concurrente_porcentaje',
                'sctr_salud_porcentaje',
                'sctr_pension_porcentaje',
                'poliza_essalud_vida_porcentaje',
                'seguro_car_porcentaje',
                'recargo_administrativo_cc_porcentaje',
            ]);
        });
    }
};
