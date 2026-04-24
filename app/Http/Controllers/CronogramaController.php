<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        // Solo seleccionamos la columna config_json para ahorrar memoria
        $cronograma = DB::connection('mysql')
            ->table($databaseName . '.cronograma_general')
            ->where('project_id', $project_id)
            ->select('config_json')
            ->first();

        return Inertia::render('costos/cronogramas/general/CronogramaIndex', [  
            'project'     => (string)$project_id,
            // Si el JSON es enorme, lo decodificamos solo si existe
            'initialData' => $cronograma ? json_decode($cronograma->config_json) : null
        ]);
    }

    /**
     * IMPORTAR PARTIDAS: Optimizado para carga masiva (10k+)
     */
    public function getPartidas($project)
    {
        try {
            $costoProject = CostoProject::findOrFail($project);
            $dbName = $costoProject->database_name;

            // EXTREMADAMENTE IMPORTANTE: 
            // 1. Solo traemos partida, descripción, unidad y total. 
            // 2. Al quitar metrado y precio unitario el JSON pesa 60% menos.
            $partidas = DB::connection('mysql')
                ->table($dbName . '.presupuesto_general')
                ->select([
                    'partida', 
                    'descripcion', 
                    'unidad', 
                    'parcial as total' 
                ])
                ->whereNull('deleted_at')
                ->where('partida', '<>', '') 
                ->orderBy('item_order', 'asc')
                ->get();

            return response()->json($partidas);

        } catch (\Exception $e) {
            Log::error("Error masivo en proyecto {$project}: " . $e->getMessage());
            return response()->json(['error' => 'Error de conexión masiva.'], 500);
        }
    }

    public function store(Request $request, $project)
    {
        // Validamos rápido
        $request->validate(['tasks' => 'required|array']);

        try {
            $costoProject = CostoProject::findOrFail($project);
            $databaseName = $costoProject->database_name;

            // Guardamos el JSON de forma compacta
            $config_json = json_encode([
                'tasks' => $request->input('tasks'),
                'links' => $request->input('links', [])
            ]);

            DB::connection('mysql')
                ->table($databaseName . '.cronograma_general')
                ->updateOrInsert(
                    ['project_id' => $project],
                    [
                        'config_json' => $config_json,
                        'updated_at'  => now()
                    ]
                );

            return response()->json(['status' => 'success'], 200);

        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}