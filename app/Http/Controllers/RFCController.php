<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\AvanceObraCalculoService;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use App\Services\FinancieroContratoService;
use App\Services\RetencionGFCService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * R.F.C. — Retención de Garantía de Fiel Cumplimiento. El "monto
 * valorizado" de cada periodo (columna que usa la cascada de retención) es
 * el ejecutado de ESE periodo (Costo Directo) con GG/Utilidad/IGV ya
 * aplicados — no el Costo Directo puro que ya reporta AvanceObraCalculoService.
 */
class RFCController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly AvanceObraCalculoService $avanceService,
        private readonly FinancieroContratoService $financieroService,
        private readonly RetencionGFCService $retencionService,
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

        $resumenFinanciero = DB::connection('costos_tenant')
            ->table('resumen_financiero_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();
        $sinMontoContrato = ! $resumenFinanciero;
        $montoContrato = $resumenFinanciero ? (float) $resumenFinanciero->monto_contrato : 0.0;

        $avance = $this->avanceService->calcular($costoProject, $presupuestoId, $modoCalculo);
        $pct = $this->financieroService->porcentajes($presupuestoId);

        $filasValorizacion = array_map(function ($fila) use ($pct) {
            $cascada = $this->financieroService->aplicarCascada($fila['ejecutadoMensual'], $pct);

            return [
                'periodo' => $fila['periodo'],
                'periodoCal' => $fila['periodoCal'],
                'montoValorizado' => $cascada['montoTotal'],
            ];
        }, $avance['filas']);

        $retencion = $this->retencionService->calcular($montoContrato, $filasValorizacion);

        return Inertia::render('costos/cronogramas/rfc/RFC', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'modoCalculo' => $modoCalculo,
            ...$retencion,
            'sinMontoContrato' => $sinMontoContrato,
            'sinProgramado' => $avance['sinProgramado'],
            'sinEjecutado' => $avance['sinEjecutado'],
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
