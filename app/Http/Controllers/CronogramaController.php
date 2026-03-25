<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class CronogramaController extends Controller
{
    public function index(Request $request) 
    {
        $project_id = $request->query('project');

        if (!$project_id) {
            abort(404, "No se recibió el ID del proyecto");
        }

        $cronograma = DB::table('cronogramas')
            ->where('project_id', $project_id)
            ->first();

        return Inertia::render('costos/cronogramas/CronogramaIndex', [
            'project'     => (string)$project_id,
            'initialData' => $cronograma ? json_decode($cronograma->config_json) : null
        ]);
    }

    public function store(Request $request, $project)
    {
        // Validamos que 'data' esté presente (enviado desde Axios)
        $request->validate([
            'data' => 'required'
        ]);

        try {
            DB::table('cronogramas')->updateOrInsert(
                ['project_id' => $project],
                [
                    'config_json' => $request->input('data'), // Se guarda el JSON stringificado
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