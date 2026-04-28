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
        if (!$project_id) abort(404);

        $costoProject = CostoProject::findOrFail($project_id);
        $db = $costoProject->database_name;

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

        return Inertia::render('costos/cronogramas/general/CronogramaIndex', [
            'project'     => (string)$project_id,
            'initialData' => $initialData,
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
        $request->validate(['tasks' => 'required|array']);

        try {
            $costoProject = CostoProject::findOrFail($project);
            $db = $costoProject->database_name;

            // Obtener presupuesto_id UNA sola vez fuera del foreach
            $presupuestoId = DB::connection('mysql')
                ->table($db . '.presupuestos')
                ->first()?->id;

            DB::connection('mysql')
                ->table($db . '.cronograma_general')
                ->where('project_id', $project)
                ->delete();

            $rows = [];
            foreach ($request->input('tasks') as $i => $t) {
                $rows[] = [
                    'gantt_id'      => (string)($t['id'] ?? ''),
                    'presupuesto_id'=> $presupuestoId,
                    'project_id'    => $project,
                    'partida'       => $t['item'] ?? null,
                    'descripcion'   => $t['text'] ?? null,
                    'duracion_dias' => $t['duration'] ?? 0,
                    'fecha_inicio'  => isset($t['start_date']) ? substr($t['start_date'], 0, 10) : null,
                    'fecha_fin'     => isset($t['end_date'])   ? substr($t['end_date'], 0, 10)   : null,
                    'avance'        => $t['progress'] ?? 0,
                    'costo'         => $t['cost'] ?? 0,
                    'unidad'        => $t['unidad'] ?? null,
                    'owner'         => $t['owner'] ?? null,
                    'parent_id'     => isset($t['parent']) && $t['parent'] != 0 ? (string)$t['parent'] : null,
                    'predecesoras'  => isset($t['predecessors']) && $t['predecessors'] !== ''
                                        ? json_encode($t['predecessors'])
                                        : null,
                    'item_order'    => $i,
                    'nivel'         => substr_count($t['item'] ?? '', '.'),
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ];
            }

            foreach (array_chunk($rows, 500) as $chunk) {
                DB::connection('mysql')
                    ->table($db . '.cronograma_general')
                    ->insert($chunk);
            }

            return response()->json(['status' => 'success'], 200);

        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}