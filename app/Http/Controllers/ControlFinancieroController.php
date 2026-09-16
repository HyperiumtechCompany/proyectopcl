<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\ControlFinancieroService;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ControlFinancieroController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly ControlFinancieroService $controlFinancieroService,
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

        $resultado = $this->controlFinancieroService->calcular($costoProject, $presupuestoId, $modoCalculo, $montoContrato);

        return Inertia::render('costos/cronogramas/controlfinanciero/ControlFinanciero', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'modoCalculo' => $modoCalculo,
            'montoContrato' => $montoContrato,
            'sinMontoContrato' => $sinMontoContrato,
            ...$resultado,
            'estado' => $this->estadoService->resumen($presupuestoId),
        ]);
    }

    public function toggleDevengado(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => 'required',
            'periodo_key' => 'required|string',
            'devengado' => 'required|boolean',
        ]);

        $costoProject = CostoProject::findOrFail($validated['project_id']);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        DB::connection('costos_tenant')->table('valorizacion_estado')->updateOrInsert(
            ['presupuesto_id' => $presupuestoId, 'periodo_key' => $validated['periodo_key']],
            [
                'devengado' => $validated['devengado'],
                'fecha_devengado' => $validated['devengado'] ? now()->toDateString() : null,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json(['status' => 'success', 'message' => 'Estado actualizado.']);
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
