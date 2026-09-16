<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // "Monto del Contrato Original" (Costo Directo + GG + Utilidad + IGV
        // — el mismo `presupI` que ya usa el Cronograma de Desembolsos, NO
        // el Presupuesto Total con Componentes II/III ni conceptos
        // administrativos) y su reparto mensual. Se guarda al presionar
        // "Guardar" en Valorizado — TablaValorizada.tsx ya lo calcula
        // (calcularResumenFinanciero.ts), acá solo se persiste para que
        // CONTROL AVAN. FISICO y R.F.C. (reportes de solo lectura en el
        // servidor) puedan leerlo sin duplicar esa fórmula en PHP.
        if (! Schema::connection($this->connection)->hasTable('resumen_financiero_valorizado')) {
            Schema::connection($this->connection)->create('resumen_financiero_valorizado', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id')->unique();
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->decimal('monto_contrato', 14, 2)->default(0);
                $table->json('distribucion_mensual')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('resumen_financiero_valorizado');
    }
};
