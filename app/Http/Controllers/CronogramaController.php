<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CronogramaController extends Controller
{
    public function index(Request $request)
    {
        $projectId = $request->query('project');

        if (! $projectId) {
            abort(404, 'No se recibió el ID del proyecto');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();

        $records = DB::connection('costos_tenant')->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')
            ->get();

        $ganttTasks = [];
        $ganttLinks = [];

        foreach ($records as $row) {
            $ganttTasks[] = [
                'id' => $row->id,
                'text' => $row->descripcion,
                'start_date' => $row->fecha_inicio ? date('Y-m-d H:i', strtotime($row->fecha_inicio)) : null,
                'end_date' => $row->fecha_fin ? date('Y-m-d H:i', strtotime($row->fecha_fin)) : null,
                'duration' => $row->duracion_dias,
                'progress' => $row->avance,
                'parent' => $row->parent_id ?? 0,
                'item' => $row->partida,
                'originalItem' => $row->partida,
                'open' => true,
            ];

            if ($row->predecesoras) {
                $decoded = json_decode($row->predecesoras, true);
                if (is_array($decoded)) {
                    foreach ($decoded as $link) {
                        $ganttLinks[] = $link;
                    }
                }
            }
        }

        $cronograma = [
            'tasks' => $ganttTasks,
            'links' => $ganttLinks,
        ];

        return Inertia::render('costos/cronogramas/general/CronogramaIndex', [
            'project' => (string) $projectId,
            'initialData' => count($ganttTasks) > 0 ? $cronograma : null,
        ]);
    }

    public function store(Request $request, $project)
    {
        $request->validate([
            'data' => ['nullable', 'string'],
            'tasks' => ['nullable', 'array'],
            'links' => ['nullable', 'array'],
        ]);

        if (! $request->filled('data') && ! $request->has('tasks') && ! $request->has('links')) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se recibieron datos del cronograma.',
            ], 422);
        }

        // Recuperar tasks y links enviados desde DHTMLX Gantt
        $tasks = $request->input('tasks', []);
        $links = $request->input('links', []);
        if ($request->filled('data')) {
            $parsed = json_decode($request->input('data'), true);
            $tasks = $parsed['tasks'] ?? [];
            $links = $parsed['links'] ?? [];
        }

        try {
            $costoProject = CostoProject::findOrFail($project);
            app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

            $presupuestoId = $this->resolvePresupuestoId();

            DB::connection('costos_tenant')->beginTransaction();

            // Limpiar la tabla de la base de datos tenant
            DB::connection('costos_tenant')->table('cronograma_general')
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $insertData = [];
            foreach ($tasks as $index => $task) {
                $taskId = isset($task['id']) ? (int) $task['id'] : null;
                $parentId = (isset($task['parent']) && $task['parent'] != 0) ? (int) $task['parent'] : null;

                // Extraer los links donde esta tarea es el 'target'
                $taskLinks = array_values(array_filter($links, fn ($l) => isset($l['target']) && $l['target'] == $taskId));

                $insertData[] = [
                    'id' => $taskId,
                    'presupuesto_id' => $presupuestoId,
                    'item_order' => $index + 1,
                    'partida' => $task['item'] ?? '',
                    'descripcion' => $task['text'] ?? '',
                    'duracion_dias' => $task['duration'] ?? 0,
                    'fecha_inicio' => ! empty($task['start_date']) ? date('Y-m-d', strtotime($task['start_date'])) : null,
                    'fecha_fin' => ! empty($task['end_date']) ? date('Y-m-d', strtotime($task['end_date'])) : null,
                    'avance' => $task['progress'] ?? 0,
                    'parent_id' => $parentId,
                    'nivel' => (isset($task['item']) && $task['item'] !== '') ? (substr_count($task['item'], '.') + 1) : 1,
                    'predecesoras' => empty($taskLinks) ? null : json_encode($taskLinks),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            // Insertar todo de golpe
            if (! empty($insertData)) {
                // Laravel chunk insert para evitar errores si son muchos registros
                foreach (array_chunk($insertData, 500) as $chunk) {
                    DB::connection('costos_tenant')->table('cronograma_general')->insert($chunk);
                }
            }

            DB::connection('costos_tenant')->commit();

            return response()->json([
                'status' => 'success',
                'message' => '¡Diagrama de Gantt guardado correctamente!',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error al guardar: '.$e->getMessage(),
            ], 500);
        }
    }

    public function getPartidas($project): JsonResponse
    {
        try {
            $costoProject = CostoProject::findOrFail($project);

            // Set the tenant connection to point to the correct database
            app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

            $partidas = DB::connection('costos_tenant')
                ->table('presupuesto_general')
                ->whereNotNull('descripcion')
                ->select('id', 'partida', 'descripcion', 'unidad', 'metrado', 'precio_unitario', 'parcial')
                ->orderBy('item_order')
                ->orderBy('id')
                ->get()
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'codigo' => $row->partida,
                    'descripcion' => $row->descripcion,
                    'unidad' => $row->unidad,
                    'cantidad' => $row->metrado,
                    'precio_unitario' => $row->precio_unitario,
                    'total' => $row->parcial,
                ])
                ->toArray();

            return response()->json($partidas);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener partidas: '.$e->getMessage(),
            ], 500);
        }
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
