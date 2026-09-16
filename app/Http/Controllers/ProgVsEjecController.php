<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use App\Services\ResumenValorizacionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * PROG VS. EJEC — foto por partida a un periodo de corte: cuánto se
 * programó vs. cuánto se ejecutó realmente, ítem por ítem, acumulado hasta
 * ese corte. El cálculo en sí vive en ResumenValorizacionService
 * (compartido con RESUMEN VAL./PAGOS ACUMULADOS, que necesitan la misma
 * tabla por partida y solo le agregan la cascada financiera GG/Utilidad/IGV).
 */
class ProgVsEjecController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly ResumenValorizacionService $resumenService,
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

        $resultado = $this->resumenService->calcular(
            $costoProject,
            $presupuestoId,
            $modoCalculo,
            $request->query('periodo')
        );

        return Inertia::render('costos/cronogramas/progvsejec/ProgVsEjec', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'modoCalculo' => $modoCalculo,
            ...$resultado,
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
