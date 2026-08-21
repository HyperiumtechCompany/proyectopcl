<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Database\ConcurrencyErrorDetector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CronogramaV2Controller extends Controller
{
    // ──────────────────────────────────────────────────────────────────────────
    // GET /module/crono_general_v2  → página Inertia con initialTasks
    // ──────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $projectId = $request->query('project');
        if (! $projectId) {
            abort(404, 'No se recibió el ID del proyecto');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();
        $tasks = $this->fetchTasks($presupuestoId);

        return Inertia::render('costos/cronogramas/v2/views/CronogramaGeneralV2', [
            'project' => (string) $projectId,
            'project_name' => $costoProject->nombre ?? '',
            'initialTasks' => $tasks,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /cronograma/v2/{project}/tasks  → JSON de tareas
    // ──────────────────────────────────────────────────────────────────────────
    public function getTasks(Request $request, string $project): JsonResponse
    {
        $costoProject = CostoProject::findOrFail($project);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();

        return response()->json(['tasks' => $this->fetchTasks($presupuestoId)]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /cronograma/v2/{project}/save  → guardar tareas
    // ──────────────────────────────────────────────────────────────────────────
    public function store(Request $request, string $project): JsonResponse
    {
        $request->validate(['tasks' => 'required|array']);

        $costoProject = CostoProject::findOrFail($project);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();

        // Delphin dispara este guardado en paralelo con el guardado de Presupuesto
        // General y el flush de ACUs (ver DelphinView.tsx handleSaveBudget/handleSaveAll,
        // Promise.all de saveTasks + saveBudget + flushPendingAcus): el clear+reinsert de
        // abajo puede chocar en deadlock (SQLSTATE 40001) con esas otras transacciones
        // concurrentes. Mismo patrón de reintento que PresupuestoController::update()/
        // calculateACU() — reintentar la transacción completa, no tratarlo como error fatal.
        $maxAttempts = 5;
        $concurrencyDetector = new ConcurrencyErrorDetector;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            DB::connection('costos_tenant')->beginTransaction();

            try {
                // Limpiar registros anteriores
                DB::connection('costos_tenant')
                    ->table('cronograma_general')
                    ->where('presupuesto_id', $presupuestoId)
                    ->delete();

                $insertData = [];
                foreach ($request->input('tasks') as $task) {
                    $taskId = isset($task['id']) && $task['id'] > 0 ? (int) $task['id'] : null;
                    $parentId = (isset($task['parent_id']) && $task['parent_id'] !== null && $task['parent_id'] > 0)
                        ? (int) $task['parent_id']
                        : null;

                    // El frontend envía el formato DHTMLX: {source, target, type, lag}
                    $links = [];
                    foreach ($task['predecesoras'] ?? [] as $pred) {
                        $source = (int) ($pred['source'] ?? 0);
                        if ($source <= 0) {
                            continue;
                        }
                        $links[] = [
                            'source' => $source,
                            'target' => (int) ($pred['target'] ?? $taskId),
                            'type' => (string) ($pred['type'] ?? '0'),
                            'lag' => (int) ($pred['lag'] ?? 0),
                        ];
                    }

                    $row = [
                        // Siempre presente (aunque sea null para tareas nuevas): un INSERT
                        // masivo de Laravel arma la lista de columnas a partir de las claves
                        // de la PRIMERA fila del chunk y luego solo toma array_values() de
                        // cada fila — si una fila no tiene esta clave le faltará un valor y
                        // el INSERT completo del chunk falla con "Column count doesn't match
                        // value count" (SQLSTATE 21S01). NULL en una columna AUTO_INCREMENT
                        // simplemente hace que MySQL genere el id, igual que omitir la columna.
                        'id' => $taskId,
                        'presupuesto_id' => $presupuestoId,
                        'item_order' => (int) ($task['item_order'] ?? 0),
                        // Se guarda tal cual (sin zero-padding): presupuesto_general.partida
                        // tampoco se guarda con padding (ver PresupuestoController), y el join
                        // en fetchTasks() compara cg.partida = pg.partida por igualdad exacta —
                        // paddear aquí rompía ese match y duplicaba el árbol en Delphin (las
                        // partidas de presupuesto quedaban como "faltantes" y se sintetizaban
                        // como una segunda copia del árbol).
                        'partida' => trim((string) ($task['partida'] ?? '')),
                        'descripcion' => $task['descripcion'] ?? '',
                        'duracion_dias' => (int) ($task['duracion_dias'] ?? 0),
                        'fecha_inicio' => ! empty($task['fecha_inicio']) ? $task['fecha_inicio'] : null,
                        'fecha_fin' => ! empty($task['fecha_fin']) ? $task['fecha_fin'] : null,
                        'avance' => (float) ($task['avance'] ?? 0),
                        'parent_id' => $parentId,
                        'nivel' => (int) ($task['nivel'] ?? 1),
                        'predecesoras' => empty($links) ? null : json_encode($links),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    $insertData[] = $row;
                }

                foreach (array_chunk($insertData, 500) as $chunk) {
                    DB::connection('costos_tenant')->table('cronograma_general')->insert($chunk);
                }

                DB::connection('costos_tenant')->commit();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Cronograma guardado correctamente.',
                ]);
            } catch (\Exception $e) {
                if (DB::connection('costos_tenant')->transactionLevel() > 0) {
                    DB::connection('costos_tenant')->rollBack();
                }

                if ($attempt < $maxAttempts && $concurrencyDetector->causedByConcurrencyError($e)) {
                    usleep(random_int(50_000, 150_000) * $attempt);

                    continue;
                }

                // Este endpoint nunca logueaba en laravel.log — el error solo viajaba en
                // el JSON de respuesta, y el frontend (useGanttTasks.ts saveTasks()) lo
                // descarta y solo guarda un booleano. Sin este log era imposible diagnosticar
                // un fallo real desde el servidor.
                Log::error('Error saving cronograma_general', [
                    'project' => $project,
                    'attempt' => $attempt,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Error al guardar: '.$e->getMessage(),
                ], 500);
            }
        }

        return response()->json([
            'status' => 'error',
            'message' => 'No se pudo guardar debido a alta concurrencia. Intenta nuevamente.',
        ], 500);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers privados
    // ──────────────────────────────────────────────────────────────────────────

    private function fetchTasks(int $presupuestoId): array
    {
        $records = DB::connection('costos_tenant')
            ->table('cronograma_general as cg')
            ->leftJoin('presupuesto_general as pg', 'cg.partida', '=', 'pg.partida')
            ->where('cg.presupuesto_id', $presupuestoId)
            ->orderBy('cg.item_order')
            ->select('cg.*', DB::raw('COALESCE(pg.parcial, 0) as presupuesto'))
            ->get();

        return $records->map(fn ($row) => $this->rowToV2($row))->all();
    }

    private function rowToV2(object $row): array
    {
        $typeMap = ['0' => 'FC', '1' => 'CC', '2' => 'FF', '3' => 'CF'];
        $predecesoras = [];

        if ($row->predecesoras) {
            $links = json_decode($row->predecesoras, true) ?? [];
            foreach ($links as $link) {
                if (isset($link['taskId'])) {
                    $predecesoras[] = $link;
                } else {
                    $predecesoras[] = [
                        'taskId' => (int) ($link['source'] ?? 0),
                        'tipo' => $typeMap[$link['type'] ?? '0'] ?? 'FC',
                        'lag' => (int) ($link['lag'] ?? 0),
                    ];
                }
            }
        }

        return [
            'id' => $row->id,
            'parent_id' => $row->parent_id,
            'nivel' => (int) ($row->nivel ?? 1),
            'item_order' => (int) ($row->item_order ?? 0),
            'partida' => $row->partida ?? '',
            'descripcion' => $row->descripcion ?? '',
            'duracion_dias' => (int) ($row->duracion_dias ?? 0),
            'fecha_inicio' => $row->fecha_inicio,
            'fecha_fin' => $row->fecha_fin,
            'avance' => (float) ($row->avance ?? 0),
            'predecesoras' => $predecesoras,
            'presupuesto' => (float) ($row->presupuesto ?? 0),
        ];
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
