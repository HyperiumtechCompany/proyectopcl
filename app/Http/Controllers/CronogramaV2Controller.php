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
            'initialCalendarSettings' => $this->fetchCalendarSettings((string) $projectId),
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
        $request->validate([
            'tasks' => 'required|array',
            'calendar_settings' => 'nullable|array',
            'calendar_settings.projectStart' => 'nullable|date_format:Y-m-d',
            'calendar_settings.projectEnd' => 'nullable|date_format:Y-m-d',
            'calendar_settings.workDays' => 'nullable|array',
            'calendar_settings.holidays' => 'nullable|array',
        ]);

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

        $incomingTasks = $request->input('tasks', []);
        $force = filter_var($request->input('force', false), FILTER_VALIDATE_BOOLEAN);

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            DB::connection('costos_tenant')->beginTransaction();

            try {
                // ── Guardia de cordura ────────────────────────────────────────
                // El guardado hace clear + reinsert. Si el payload llega vacío o
                // recortado (estado en memoria parcial, árbol a medio cargar), esto
                // arrasaría el cronograma sin vuelta atrás. Se aborta salvo force=true.
                $existingCount = DB::connection('costos_tenant')
                    ->table('cronograma_general')
                    ->where('presupuesto_id', $presupuestoId)
                    ->count();
                $incomingCount = count($incomingTasks);

                if (! $force && $existingCount >= 15 && $incomingCount < $existingCount * 0.25) {
                    DB::connection('costos_tenant')->rollBack();

                    Log::warning('cronograma_general: guardado abortado por recorte sospechoso', [
                        'project' => $project,
                        'existing' => $existingCount,
                        'incoming' => $incomingCount,
                    ]);

                    return response()->json([
                        'status' => 'error',
                        'code' => 'suspicious_shrink',
                        'message' => "El guardado traía {$incomingCount} filas frente a {$existingCount} existentes. Se canceló por seguridad; recarga la página y vuelve a intentar. Si el recorte es correcto, reenvía con force=true.",
                    ], 422);
                }

                // Limpiar registros anteriores
                DB::connection('costos_tenant')
                    ->table('cronograma_general')
                    ->where('presupuesto_id', $presupuestoId)
                    ->delete();

                // ── Paso 1: insertar filas y mapear client_id → id real ────────
                // client_id puede ser negativo (fila nueva sin persistir). Se
                // captura el id real para re-mapear parent_id y las referencias
                // refId/target de las predecesoras en el paso 2.
                $idMap = [];
                foreach ($incomingTasks as $task) {
                    $clientId = (int) ($task['client_id'] ?? $task['id'] ?? 0);
                    $explicitId = $clientId > 0 ? $clientId : null;

                    $row = [
                        'presupuesto_id' => $presupuestoId,
                        'item_order' => (int) ($task['item_order'] ?? 0),
                        // Se guarda tal cual (sin zero-padding): presupuesto_general.partida
                        // tampoco se guarda con padding, y el join en fetchTasks() compara
                        // cg.partida = pg.partida por igualdad exacta.
                        'partida' => trim((string) ($task['partida'] ?? '')),
                        'descripcion' => $task['descripcion'] ?? '',
                        'duracion_dias' => (int) ($task['duracion_dias'] ?? 0),
                        'fecha_inicio' => ! empty($task['fecha_inicio']) ? $task['fecha_inicio'] : null,
                        'fecha_fin' => ! empty($task['fecha_fin']) ? $task['fecha_fin'] : null,
                        'avance' => (float) ($task['avance'] ?? 0),
                        'nivel' => (int) ($task['nivel'] ?? 1),
                        // parent_id y predecesoras se resuelven en el paso 2 (necesitan el idMap completo)
                        'parent_id' => null,
                        'predecesoras' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    if ($explicitId !== null) {
                        $row['id'] = $explicitId;
                        DB::connection('costos_tenant')->table('cronograma_general')->insert($row);
                        $newId = $explicitId;
                    } else {
                        $newId = DB::connection('costos_tenant')->table('cronograma_general')->insertGetId($row);
                    }

                    if ($clientId !== 0) {
                        $idMap[$clientId] = $newId;
                    }
                }

                $remap = static fn ($id) => $idMap[(int) $id] ?? null;

                // ── Paso 2: resolver parent_id + predecesoras con el idMap completo ──
                foreach ($incomingTasks as $task) {
                    $clientId = (int) ($task['client_id'] ?? $task['id'] ?? 0);
                    $selfId = $remap($clientId);
                    if ($selfId === null) {
                        continue;
                    }

                    $parentId = null;
                    $rawParent = $task['parent_id'] ?? null;
                    if ($rawParent !== null && (int) $rawParent !== 0) {
                        $parentId = $remap($rawParent);
                    }

                    $links = [];
                    foreach ($task['predecesoras'] ?? [] as $pred) {
                        $source = (int) ($pred['source'] ?? 0);
                        $rawRef = $pred['refId'] ?? null;
                        // refId estable: si apuntaba a una fila nueva, re-mapear al id real
                        $refId = $rawRef !== null ? ($remap($rawRef) ?? (int) $rawRef) : null;
                        if ($refId === null && $source <= 0) {
                            continue;
                        }
                        $links[] = [
                            'source' => $source,
                            'target' => $selfId,
                            'type' => (string) ($pred['type'] ?? '0'),
                            'lag' => (int) ($pred['lag'] ?? 0),
                            'refId' => $refId,
                            'ref' => isset($pred['ref']) && is_array($pred['ref'])
                                ? [
                                    'codigo' => (string) ($pred['ref']['codigo'] ?? ''),
                                    'desc' => (string) ($pred['ref']['desc'] ?? ''),
                                ]
                                : null,
                        ];
                    }

                    DB::connection('costos_tenant')
                        ->table('cronograma_general')
                        ->where('id', $selfId)
                        ->update([
                            'parent_id' => $parentId,
                            'predecesoras' => empty($links) ? null : json_encode($links),
                        ]);
                }

                DB::connection('costos_tenant')->commit();

                $this->saveCalendarSettings(
                    (string) $project,
                    $request->input('calendar_settings'),
                );

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

    public function storeSettings(Request $request, string $project): JsonResponse
    {
        $validated = $request->validate([
            'calendar_settings' => 'required|array',
            'calendar_settings.projectStart' => 'required|date_format:Y-m-d',
            'calendar_settings.projectEnd' => 'required|date_format:Y-m-d|after_or_equal:calendar_settings.projectStart',
            'calendar_settings.workDays' => 'required|array',
            'calendar_settings.holidays' => 'present|array',
        ]);

        CostoProject::findOrFail($project);
        $this->saveCalendarSettings($project, $validated['calendar_settings']);

        return response()->json([
            'status' => 'success',
            'message' => 'Calendario guardado correctamente.',
        ]);
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
                        // Ancla estable + snapshot legible (nulos en vínculos legado)
                        'refId' => isset($link['refId']) && $link['refId'] !== null
                            ? (int) $link['refId']
                            : null,
                        'ref' => isset($link['ref']) && is_array($link['ref'])
                            ? $link['ref']
                            : null,
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

    private function fetchCalendarSettings(string $project): ?array
    {
        $json = DB::table('cronogramas')->where('project_id', $project)->value('config_json');
        $config = $json ? json_decode($json, true) : null;

        return is_array($config['calendar_settings'] ?? null)
            ? $config['calendar_settings']
            : null;
    }

    private function saveCalendarSettings(string $project, mixed $settings): void
    {
        if (! is_array($settings)) {
            return;
        }

        $existing = DB::table('cronogramas')->where('project_id', $project)->value('config_json');
        $config = $existing ? json_decode($existing, true) : [];
        $config = is_array($config) ? $config : [];
        $config['calendar_settings'] = $settings;

        $values = ['config_json' => json_encode($config), 'updated_at' => now()];
        if ($existing === null) {
            $values['created_at'] = now();
        }

        DB::table('cronogramas')->updateOrInsert(['project_id' => $project], $values);
    }
}
