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
}