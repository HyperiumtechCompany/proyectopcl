<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Estado de llenado de las 3 fuentes de datos que alimentan todo el módulo
 * de valorización de campo: Valorizado (programado), Avance Real
 * (ejecutado), y el Monto de Contrato (resumen financiero). Cada
 * controlador de las hojas derivadas (Control Avance, Curva S, Prog vs
 * Ejec, Avance Físico) lo consulta y se lo pasa a CronogramaNavTabs, para
 * que la barra de navegación alerte en qué pestaña falta llenar algo —
 * incluso estando parado en OTRA hoja.
 */
class CronogramaEstadoService
{
    public function resumen(int $presupuestoId): array
    {
        return [
            'sinProgramado' => ! DB::connection('costos_tenant')
                ->table('cronograma_valorizado')
                ->where('presupuesto_id', $presupuestoId)
                ->exists(),
            'sinEjecutado' => ! DB::connection('costos_tenant')
                ->table('cronograma_ejecutado')
                ->where('presupuesto_id', $presupuestoId)
                ->exists(),
            'sinMontoContrato' => ! DB::connection('costos_tenant')
                ->table('resumen_financiero_valorizado')
                ->where('presupuesto_id', $presupuestoId)
                ->exists(),
        ];
    }
}
