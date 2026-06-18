<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Traits\HandleMetradoSpreadsheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MetradoGasController extends Controller
{
    use HandleMetradoSpreadsheet;

    private const TABLE_METRADO = 'metrado_gas';

    private const TABLE_RESUMEN = 'metrado_gas_resumen';

 public function index(Request $request)
{
    $projectId = $request->query('project');
    if (! $projectId) {
        abort(404, 'No se recibió el ID del proyecto');
    }

    $costoProject = CostoProject::findOrFail($projectId);
    $this->dbService->setTenantConnection($costoProject->database_name);

    $presupuestoId = $this->resolvePresupuestoId();

    $rows = DB::connection('costos_tenant')
        ->table('presupuesto_general')
        ->where('presupuesto_id', $presupuestoId)
        ->orderByRaw('COALESCE(item_order, 999999), id')
        ->get()
        ->map(fn ($r) => (array) $r)
        ->toArray();

    $tasks = $this->fetchTasks($presupuestoId);

    $projectParams = $this->dbService->getProjectParams($costoProject->database_name);

    // ═══════════════════════════════════════════════════════════════════
    // 👇 USAR LOS MISMOS NOMBRES QUE EN GasIndex
    // ═══════════════════════════════════════════════════════════════════
    $projectData = [
        'id' => $costoProject->id,
        'nombre' => $costoProject->nombre,
        'codigo_cui' => $costoProject->codigo_cui,
        'codigo_local' => $costoProject->codigo_local,
        'unidad_ejecutora' => $costoProject->unidad_ejecutora,
        'propietario' => $costoProject->unidad_ejecutora,
        'codigos_modulares' => $costoProject->codigos_modulares,
        'plantilla_logo_izq_url' => $costoProject->plantilla_logo_izq 
            ? asset('storage/' . $costoProject->plantilla_logo_izq) 
            : null,
        'plantilla_logo_der_url' => $costoProject->plantilla_logo_der 
            ? asset('storage/' . $costoProject->plantilla_logo_der) 
            : null,
    ];

    return Inertia::render('costos/delphin/DelphinView', [
        'project'        => (string) $projectId,
        'project_id_int' => (int) $projectId,
        'project_name'   => $costoProject->nombre ?? '',
        'initialRows'    => $rows,
        'initialTasks'   => $tasks,
        'projectParams'  => $projectParams ? (array) $projectParams : null,
        'projectData'    => $projectData, // 👈 MISMO FORMATO QUE GasIndex
    ]);
}

    public function updateMetrado(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');

        return $this->updateSheet($costoProject, self::TABLE_METRADO, $request);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');

        return $this->updateSheet($costoProject, self::TABLE_RESUMEN, $request);
    }

    public function syncResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');

        return response()->json([
            'success' => true,
            'message' => 'Sincronización completada (backend stub)',
        ]);
    }
}
