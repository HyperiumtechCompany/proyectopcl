<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Adelanto Directo y Adelanto de Materiales — primer dato real del módulo
 * de pagos (CONTROL DE PAGOS los usa en "Amortizaciones"). Un solo valor
 * por presupuesto, no por partida ni periodo.
 */
class AdelantosController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly CronogramaEstadoService $estadoService,
    ) {}

    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        $modoCalculo = $request->query('modo', 'calendario');

        if (! $projectId) {
            abort(404, 'ID de proyecto no recibido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        $adelantos = DB::connection('costos_tenant')
            ->table('adelantos_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();

        $resumenFinanciero = DB::connection('costos_tenant')
            ->table('resumen_financiero_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();

        return Inertia::render('costos/cronogramas/adelantos/Adelantos', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'modoCalculo' => $modoCalculo,
            'adelantoDirecto' => $adelantos ? (float) $adelantos->adelanto_directo : 0.0,
            'adelantoMateriales' => $adelantos ? (float) $adelantos->adelanto_materiales : 0.0,
            'montoContrato' => $resumenFinanciero ? (float) $resumenFinanciero->monto_contrato : 0.0,
            'sinMontoContrato' => ! $resumenFinanciero,
            'estado' => $this->estadoService->resumen($presupuestoId),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => 'required',
            'adelanto_directo' => 'required|numeric|min:0',
            'adelanto_materiales' => 'required|numeric|min:0',
        ]);

        $costoProject = CostoProject::findOrFail($validated['project_id']);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        DB::connection('costos_tenant')->table('adelantos_valorizado')->updateOrInsert(
            ['presupuesto_id' => $presupuestoId],
            [
                'adelanto_directo' => round((float) $validated['adelanto_directo'], 2),
                'adelanto_materiales' => round((float) $validated['adelanto_materiales'], 2),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Adelantos guardados correctamente.',
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
