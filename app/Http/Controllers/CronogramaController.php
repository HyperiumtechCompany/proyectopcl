<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CronogramaController extends Controller
{
    public function index(Request $request)
    {
        $project_id = $request->query('project');
        if (!$project_id) abort(404);

        if (!$project_id) {
            abort(404, "No se recibió el ID del proyecto");
        }

        $filas = DB::connection('mysql')
            ->table($db . '.cronograma_general')
            ->where('project_id', $project_id)
            ->orderBy('item_order')
            ->get();

        $initialData = null;

        if ($filas->isNotEmpty()) {
            $tasks = $filas->map(fn($f) => [
                'id'           => (string)$f->gantt_id,
                'text'         => $f->descripcion,
                'start_date'   => $f->fecha_inicio ? $f->fecha_inicio . ' 00:00' : null,
                'end_date'     => $f->fecha_fin    ? $f->fecha_fin    . ' 00:00' : null,
                'duration'     => $f->duracion_dias,
                'progress'     => (float) $f->avance,
                'cost'         => (float) $f->costo,
                'parent'       => $f->parent_id ? (string)$f->parent_id : 0,
                'item'         => $f->partida,
                'originalItem' => $f->partida,
                'unidad'       => $f->unidad,
                'owner'        => $f->owner,
                'predecessors' => $f->predecesoras,
                'open'         => true,
            ])->values()->toArray();

            $initialData = ['tasks' => $tasks, 'links' => []];
        }

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
