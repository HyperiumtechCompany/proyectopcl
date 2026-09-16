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
 * CONTROL GEN. AVAN. OBRA. — tablero mensual programado vs. ejecutado.
 * El cálculo en sí vive en AvanceObraCalculoService (compartido con CURVA S,
 * que en el Excel de referencia copia estas mismas columnas).
 */
class ControlAvanceObraController extends Controller
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

        return Inertia::render('costos/cronogramas/control/ControlAvanceObra', [
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
