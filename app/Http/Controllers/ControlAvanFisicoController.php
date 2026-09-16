<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\AvanceObraCalculoService;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * CONTROL AVAN. FISICO — "CONTROL DE AVANCE FÍSICO DE OBRA". En el Excel de
 * referencia esta hoja es, en un 90%, una copia literal de CURVA S (mismas
 * columnas re-vinculadas); lo único nuevo es el bloque de "saldo por
 * ejecutar" = Monto del Contrato Original − Ejecutado Acumulado. Reutiliza
 * AvanceObraCalculoService para lo primero y lee 'resumen_financiero_valorizado'
 * (persistido al guardar Valorizado) para el monto de contrato.
 */
class ControlAvanFisicoController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly AvanceObraCalculoService $calculoService,
        private readonly CronogramaEstadoService $estadoService,
    ) {}

    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        $modoCalculo = $request->query('modo', CronogramaPeriodosService::MODO_CALENDARIO);

        if (! $projectId) {
            abort(404, 'ID de proyecto no recibido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        $resultado = $this->calculoService->calcular($costoProject, $presupuestoId, $modoCalculo);
        $filas = $resultado['filas'];
        $ultima = end($filas) ?: null;

        $resumenFinanciero = DB::connection('costos_tenant')
            ->table('resumen_financiero_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();

        $sinMontoContrato = ! $resumenFinanciero;
        $montoContrato = $resumenFinanciero ? (float) $resumenFinanciero->monto_contrato : 0.0;

        $ejecutadoAcumulado = $ultima ? $ultima['ejecutadoAcumulado'] : 0.0;
        // % ejecutado ya sale sobre totalPresupuesto (Costo Directo oficial)
        // en AvanceObraCalculoService; acá lo re-expresamos sobre el Monto
        // de Contrato real (con GG/Utilidad/IGV) para que el saldo cuadre
        // con la misma base que usa esta hoja en el Excel.
        $pctEjecutadoSobreContrato = $montoContrato > 0 ? round($ejecutadoAcumulado / $montoContrato * 100, 4) : 0.0;
        $saldoMonto = round($montoContrato - $ejecutadoAcumulado, 2);
        $saldoPct = round(100 - $pctEjecutadoSobreContrato, 4);

        return Inertia::render('costos/cronogramas/controlfisico/ControlAvanFisico', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'modoCalculo' => $modoCalculo,
            'montoContrato' => $montoContrato,
            'ejecutadoAcumulado' => $ejecutadoAcumulado,
            'pctEjecutadoAcumulado' => $pctEjecutadoSobreContrato,
            'saldoMonto' => $saldoMonto,
            'saldoPct' => $saldoPct,
            'sinMontoContrato' => $sinMontoContrato,
            'sinProgramado' => $resultado['sinProgramado'],
            'sinEjecutado' => $resultado['sinEjecutado'],
            'estado' => $this->estadoService->resumen($presupuestoId),
        ]);
    }

    private function resolvePresupuestoId(): int
    {
        $id = DB::connection('costos_tenant')
            ->table('presupuestos')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->value('id');

        if (! $id) {
            abort(422, 'No existe un presupuesto para este proyecto.');
        }

        return (int) $id;
    }
}
