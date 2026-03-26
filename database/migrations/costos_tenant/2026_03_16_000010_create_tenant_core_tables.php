<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // ══════════════════════════════════════════════════════════════════════
        // 0. PROJECT PARAMS — parámetros globales centralizados
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('project_params')) {
            Schema::connection($this->connection)->create('project_params', function (Blueprint $table) {
                $table->id();

                $table->string('nombre');
                $table->string('uei')->nullable();
                $table->string('unidad_ejecutora')->nullable();
                $table->string('codigo_snip')->nullable();
                $table->string('codigo_cui')->nullable();
                $table->string('codigo_local')->nullable();

                $table->date('fecha_inicio')->nullable();
                $table->date('fecha_fin')->nullable();
                $table->unsignedSmallInteger('duracion_dias')->default(0)
                    ->comment('Auto: DATEDIFF(fecha_fin, fecha_inicio)');
                $table->decimal('duracion_meses', 8, 2)->default(0)
                    ->comment('Auto: duracion_dias / 30');

                $table->string('departamento')->nullable();
                $table->string('provincia')->nullable();
                $table->string('distrito')->nullable();
                $table->string('centro_poblado')->nullable();

                $table->decimal('costo_directo', 15, 4)->default(0)
                    ->comment('Sync desde SUM(presupuesto_general.parcial) de raíces');
                $table->decimal('utilidad_porcentaje', 5, 2)->default(10.00);
                $table->decimal('igv_porcentaje', 5, 2)->default(18.00);
                $table->decimal('jornada_laboral_horas', 4, 2)->default(8.00);
                $table->decimal('rmv', 10, 2)->default(1025.00)
                    ->comment('Remuneración Mínima Vital vigente');

                $table->timestamps();
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 1. PRESUPUESTOS — TABLA MAESTRA (padre de todo el sistema)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuestos')) {
            Schema::connection($this->connection)->create('presupuestos', function (Blueprint $table) {
                $table->id();
                $table->string('nombre');
                $table->text('descripcion')->nullable();
                $table->string('moneda', 20)->default('SOLES');
                $table->date('fecha')->nullable();
                $table->string('ubicacion')->nullable();
                $table->string('cliente')->nullable();
                $table->decimal('costo_directo', 15, 4)->default(0);
                $table->decimal('gastos_generales', 15, 4)->default(0);
                $table->decimal('utilidad', 15, 4)->default(0);
                $table->decimal('igv_porcentaje', 5, 2)->default(18.00);
                $table->decimal('total_presupuesto', 15, 4)->default(0);
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('presupuestos');
        Schema::connection($this->connection)->dropIfExists('project_params');
    }
};
