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
 * CURVA S — mismo cálculo que CONTROL GEN. AVAN. OBRA. (en el Excel de
 * referencia, CURVA S literalmente copia sus columnas C/D/H/P), presentado
 * como gráfico de avance acumulado en vez de tabla.
 */
class CurvaSController extends Controller
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

        return Inertia::render('costos/cronogramas/curvas/CurvaS', [
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
