<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class CronogramaController extends Controller
{
public function index(Request $request) 
{
    $project_id = $request->query('project');

    if (!$project_id) {
        abort(404, "No se recibió el ID del proyecto");
    }

    $costoProject = CostoProject::findOrFail($project_id);
    $databaseName = $costoProject->database_name;

    \Log::info('Buscando cronograma', [
        'database' => $databaseName,
        'project_id' => $project_id
    ]);

    $cronograma = DB::connection('mysql')
        ->table($databaseName . '.cronograma_general')
        ->where('project_id', $project_id)
        ->first();

    \Log::info('Resultado:', ['found' => $cronograma ? 'SI' : 'NO', 'data' => $cronograma]);

    return Inertia::render('costos/cronogramas/general/CronogramaIndex', [  
        'project'     => (string)$project_id,
        'initialData' => $cronograma ? json_decode($cronograma->config_json) : null
    ]);
}

public function store(Request $request, $project)
{
    $request->validate([
        'tasks' => 'required|array',
        'links' => 'array'
    ]);

    try {
        $costoProject = CostoProject::findOrFail($project);
        $databaseName = $costoProject->database_name;

        $config_json = json_encode([
            'tasks' => $request->input('tasks'),
            'links' => $request->input('links')
        ]);

        DB::connection('mysql')
            ->table($databaseName . '.cronograma_general')
            ->updateOrInsert(
                ['project_id' => $project],
                [
                    'config_json' => $config_json,
                    'updated_at'  => now(),
                    'created_at'  => DB::raw('IFNULL(created_at, NOW())')
                ]
            );

        return response()->json([
            'status'  => 'success',
            'message' => '¡Diagrama de Gantt guardado correctamente!'
        ], 200);

    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Error al guardar: ' . $e->getMessage()
        ], 500);
    }
}

    // CRONOGRAMA DE MATERIALES ---
    public function materiales(Request $request)
    {
        $project_id = $request->query('project');

        if (!$project_id) {
            abort(404, "No se recibió el ID del proyecto");
        }

        $costoProject = CostoProject::findOrFail($project_id);
        $databaseName = $costoProject->database_name;

        $cronograma = DB::connection('mysql')
    ->table($databaseName . '.cronograma_general')
    ->where('project_id', $project_id)  // ← CAMBIADO
    ->first();

        $dataGantt = $cronograma ? json_decode($cronograma->config_json) : null;

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project'     => (string)$project_id,
            'ganttData'   => $dataGantt,
            'insumos'     => [] 
        ]);
    }

    /**
     * Obtiene todas las partidas del presupuesto para importar al cronograma
     * Ruta: GET /presupuesto/{project}/partidas
     */
    public function getPartidas($project)
    {
        try {
            $costoProject = CostoProject::findOrFail($project);
            
            if ($costoProject->user_id !== Auth::id()) {
                return response()->json(['error' => 'No autorizado'], 403);
            }
            
            $dbService = app(\App\Services\CostoDatabaseService::class);
            $tenantPresupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);
            
            $databaseName = $costoProject->database_name;
            
            $partidas = DB::connection('mysql')
                ->table($databaseName . '.presupuesto_general')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->whereNotNull('partida')
                ->where('partida', '!=', '')
                ->orderBy('item_order')
                ->orderBy('id')
                ->get()
                ->map(function($item) {
                    return [
                        'descripcion' => $item->descripcion,
                        'total' => (float)($item->parcial ?? 0),
                        'plazo_estimado' => 5,
                        'partida' => $item->partida,
                        'unidad' => $item->unidad,
                        'metrado' => (float)($item->metrado ?? 0),
                        'precio_unitario' => (float)($item->precio_unitario ?? 0),
                    ];
                });
            
            return response()->json($partidas);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener partidas: ' . $e->getMessage()
            ], 500);
        }
    }
}