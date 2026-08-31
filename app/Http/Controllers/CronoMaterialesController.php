<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class CronoMaterialesController extends Controller
{
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (! $projectId) {
            abort(404, 'ID de proyecto no recibido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();
        $tasks = $this->loadGanttTasks($presupuestoId);

        if (empty($tasks)) {
            return $this->renderEmpty($projectId, $costoProject->nombre, true);
        }

        $parentIds = collect($tasks)->pluck('parent')->filter(fn ($parent) => $parent !== '0')->unique()->toArray();
        $leafTasks = collect($tasks)
            ->filter(fn ($task) => ! in_array($task['id'], $parentIds) && $task['item'] !== '')
            ->values()
            ->toArray();

        if (empty($leafTasks)) {
            return $this->renderEmpty($projectId, $costoProject->nombre, false);
        }

        $fechas = collect($leafTasks)->filter(fn ($task) => $task['start_date'] && $task['end_date']);
        $inicio = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->min(fn ($task) => $task['start_date']))->startOfMonth()
            : now()->startOfMonth();
        $fin = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->max(fn ($task) => $task['end_date']))->endOfMonth()
            : $inicio->copy()->addMonths(5)->endOfMonth();

        $periodos = $this->buildPeriodos($inicio, $fin);
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();
        $tareasPorPartida = collect($leafTasks)->keyBy(fn ($task) => trim($task['item']));
        $materialesFinales = $this->buildAcuResources(
            $presupuestoId,
            $tareasPorPartida,
            $clavesPeriodos,
        );

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'materiales' => $materialesFinales->toArray(),
            'periodos' => $periodos,
            'resumen' => $this->calcularResumenActual($materialesFinales, $periodos, $leafTasks),
            'estaGuardado' => $estaGuardado,
            'sinGantt' => false,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|integer',
            'materiales' => 'required|array',
        ]);

        $projectId = (int) $request->input('project_id');
        $materiales = $request->input('materiales');
        $costoProject = CostoProject::findOrFail($projectId);

        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        DB::connection('costos_tenant')->transaction(function () use ($presupuestoId, $materiales) {
            DB::connection('costos_tenant')
                ->table('cronograma_materiales')
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $rows = [];
            foreach ($materiales as $idx => $material) {
                $rows[] = [
                    'presupuesto_id' => $presupuestoId,
                    'item_order' => $idx + 1,
                    'descripcion' => $material['descripcion'],
                    'unidad' => $material['unidad'] ?? '',
                    'cantidad_total' => $material['cantidad_total'],
                    'precio_unitario' => $material['precio'],
                    'presupuesto_total' => $material['costo_total'] ?? $material['presupuesto'],
                    'distribucion_mensual' => json_encode($material['distribucion'] ?? $material['mensual']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            foreach (array_chunk($rows, 200) as $chunk) {
                DB::connection('costos_tenant')->table('cronograma_materiales')->insert($chunk);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Cronograma de materiales guardado correctamente.',
            'total' => count($materiales),
        ]);
    }

    public function destroy(Request $request)
    {
        $projectId = (int) ($request->query('project') ?? $request->input('project'));
        if (! $projectId) {
            abort(422, 'Project ID requerido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        $deleted = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma de materiales.",
        ]);
    }

    private function renderEmpty(int $projectId, string $projectName, bool $sinGantt)
    {
        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string) $projectId,
            'projectName' => $projectName,
            'materiales' => [],
            'periodos' => [],
            'resumen' => $this->resumenVacio(),
            'estaGuardado' => false,
            'sinGantt' => $sinGantt,
        ]);
    }

    private function buildPeriodos(Carbon $inicio, Carbon $fin): array
    {
        $periodos = [];
        $cursor = $inicio->copy();

        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label' => ucfirst($cursor->translatedFormat('M Y')),
                'key' => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
        }

        return $periodos;
    }

    private function activeMonths(?array $tarea, array $clavesPeriodos): array
    {
        if (! $tarea || ! $tarea['start_date'] || ! $tarea['end_date']) {
            return [];
        }

        $inicio = Carbon::parse($tarea['start_date'])->startOfMonth();
        $fin = Carbon::parse($tarea['end_date'])->endOfMonth();

        return array_values(array_filter($clavesPeriodos, function ($key) use ($inicio, $fin) {
            return Carbon::parse("{$key}-01")->between($inicio, $fin);
        }));
    }

    private function buildAcuResources(
        int $presupuestoId,
        Collection $tareasPorPartida,
        array $clavesPeriodos,
    ): Collection {
        $service = app(CostoDatabaseService::class);
        $tareasNormalizadas = $tareasPorPartida->mapWithKeys(
            fn ($tarea, $codigo) => [$service->normalizePartidaCode($codigo) => $tarea]
        );
        $metrados = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->get(['partida', 'metrado'])
            ->mapWithKeys(fn ($fila) => [
                $service->normalizePartidaCode($fila->partida) => (float) $fila->metrado,
            ]);

        $tipos = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'];
        $consolidados = [];
        $acus = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', ...$tipos]);

        foreach ($acus as $acu) {
            $codigo = $service->normalizePartidaCode($acu->partida);

            foreach ($tipos as $tipo) {
                $recursos = json_decode($acu->{$tipo} ?? '[]', true) ?: [];

                foreach ($recursos as $recurso) {
                    $descripcion = trim((string) ($recurso['descripcion'] ?? ''));
                    $unidad = strtolower(trim((string) ($recurso['unidad'] ?? '')));
                    $cantidadAcu = (float) ($recurso['cantidad'] ?? 0);
                    $precio = (float) ($tipo === 'equipos'
                        ? ($recurso['precio_hora'] ?? $recurso['precio_unitario'] ?? 0)
                        : ($recurso['precio_unitario'] ?? $recurso['precio_hora'] ?? 0));
                    $metrado = $metrados[$codigo] ?? 0;
                    $esPorcentaje = str_starts_with($unidad, '%');
                    $factor = $tipo === 'materiales'
                        ? max(1, (float) ($recurso['factor_desperdicio'] ?? 1))
                        : 1;

                    if ($descripcion === '' || $cantidadAcu == 0 || $precio == 0 || $metrado <= 0) {
                        continue;
                    }

                    $cantidad = $cantidadAcu * $metrado;
                    $costo = $esPorcentaje
                        ? ($cantidadAcu / 100) * $precio * $metrado
                        : $cantidad * $precio * $factor;
                    // El consolidado de insumos representa los porcentajes como monto:
                    // cantidad = monto y precio de referencia = 0.
                    $cantidadMostrada = $esPorcentaje ? $costo : $cantidad;
                    $descripcionNormalizada = Str::lower(Str::ascii(Str::squish($descripcion)));
                    $clave = implode('|', [$tipo, $descripcionNormalizada, $unidad]);
                    if (! isset($consolidados[$clave])) {
                        $consolidados[$clave] = [
                            'partida_origen' => trim($acu->partida),
                            'descripcion_partida' => '',
                            'descripcion' => $descripcion,
                            'unidad' => $unidad,
                            'tipo' => $tipo,
                            'precio' => 0.0,
                            'cantidad_total' => 0.0,
                            'costo_total' => 0.0,
                            'es_porcentaje' => $esPorcentaje,
                            'distribucion' => array_fill_keys($clavesPeriodos, ['cantidad' => 0.0, 'monto' => 0.0]),
                        ];
                    }

                    $consolidados[$clave]['cantidad_total'] += $cantidadMostrada;
                    $consolidados[$clave]['costo_total'] += $costo;
                    $meses = $this->activeMonths($tareasNormalizadas->get($codigo), $clavesPeriodos);
                    $meses = empty($meses) ? [$clavesPeriodos[0]] : $meses;

                    foreach ($meses as $mes) {
                        $consolidados[$clave]['distribucion'][$mes]['cantidad'] += $cantidadMostrada / count($meses);
                        $consolidados[$clave]['distribucion'][$mes]['monto'] += $costo / count($meses);
                    }
                }
            }
        }

        return collect($consolidados)
            ->map(function (array $recurso) {
                if (! $recurso['es_porcentaje'] && $recurso['cantidad_total'] != 0) {
                    $recurso['precio'] = $recurso['costo_total'] / $recurso['cantidad_total'];
                }
                unset($recurso['es_porcentaje']);

                $recurso['precio'] = round($recurso['precio'], 10);
                $recurso['cantidad_total'] = round($recurso['cantidad_total'], 4);
                $recurso['costo_total'] = round($recurso['costo_total'], 10);
                $recurso['distribucion'] = array_map(fn (array $valor) => [
                    'cantidad' => round($valor['cantidad'], 4),
                    'monto' => round($valor['monto'], 10),
                ], $recurso['distribucion']);
                $ultimaClave = array_key_last($recurso['distribucion']);
                if ($ultimaClave !== null) {
                    $sumaCantidad = array_sum(array_column($recurso['distribucion'], 'cantidad'));
                    $sumaMonto = array_sum(array_column($recurso['distribucion'], 'monto'));
                    $recurso['distribucion'][$ultimaClave]['cantidad'] = round(
                        $recurso['distribucion'][$ultimaClave]['cantidad'] + $recurso['cantidad_total'] - $sumaCantidad,
                        4,
                    );
                    $recurso['distribucion'][$ultimaClave]['monto'] = round(
                        $recurso['distribucion'][$ultimaClave]['monto'] + $recurso['costo_total'] - $sumaMonto,
                        10,
                    );
                }

                return $recurso;
            })
            ->sortBy([['tipo', 'asc'], ['descripcion', 'asc']])
            ->values();
    }

    private function calcularResumenActual(Collection $materiales, array $periodos, array $leafTasks): array
    {
        $acumuladoMensual = [];
        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = $materiales->sum(
                fn ($material) => $material['distribucion'][$periodo['key']]['monto'] ?? 0
            );
        }
        arsort($acumuladoMensual);

        return [
            'total_materiales' => $materiales->count(),
            'presupuesto_total' => round($materiales->sum('costo_total'), 2),
            'duracion_meses' => count($periodos),
            'mes_pico' => array_key_first($acumuladoMensual),
            'mes_pico_key' => array_key_first($acumuladoMensual),
            'monto_mes_pico' => round(reset($acumuladoMensual) ?: 0, 2),
            'total_partidas' => count($leafTasks),
        ];
    }

    private function calcularResumen(array $materiales, array $periodos, array $leafTasks): array
    {
        $acumuladoMensual = [];
        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = array_sum(array_map(
                fn ($material) => ($material['mensual'][$periodo['key']] ?? 0) * $material['precio'],
                $materiales
            ));
        }

        arsort($acumuladoMensual);
        $mesPico = array_key_first($acumuladoMensual);

        return [
            'total_materiales' => count($materiales),
            'presupuesto_total' => round(array_sum(array_column($materiales, 'presupuesto')), 2),
            'duracion_meses' => count($periodos),
            'mes_pico' => $mesPico,
            'monto_mes_pico' => round($acumuladoMensual[$mesPico] ?? 0, 2),
            'total_partidas' => count($leafTasks),
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_materiales' => 0,
            'presupuesto_total' => 0,
            'duracion_meses' => 0,
            'mes_pico' => null,
            'monto_mes_pico' => 0,
            'total_partidas' => 0,
        ];
    }

    private function loadGanttTasks(int $presupuestoId): array
    {
        $records = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get();

        if ($records->isEmpty()) {
            return [];
        }

        return $records
            ->map(fn ($row) => [
                'id' => (string) ($row->id),
                'item' => trim((string) ($row->partida ?? '')),
                'parent' => (string) ($row->parent_id ?? '0'),
                'start_date' => $row->fecha_inicio,
                'end_date' => $row->fecha_fin,
                'cost' => 0.0, // Se puede obtener de presupuesto_general si se desea
            ])
            ->filter(fn ($task) => $task['id'] !== '')
            ->values()
            ->toArray();
    }

    private function normalizeDate(?string $date): ?string
    {
        return $date ? Carbon::parse($date)->toDateString() : null;
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

    /**
     * Obtiene los datos de materiales en formato JSON para ser consumido desde el frontend
     * (para la vista integrada de Valorizado)
     */
    public function getData(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (! $projectId) {
            return response()->json(['error' => 'ID de proyecto no recibido'], 422);
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();
        $tasks = $this->loadGanttTasks($presupuestoId);

        if (empty($tasks)) {
            return response()->json([
                'materiales' => [],
                'periodos' => [],
                'resumen' => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt' => true,
            ]);
        }

        $parentIds = collect($tasks)->pluck('parent')->filter(fn ($parent) => $parent !== '0')->unique()->toArray();
        $leafTasks = collect($tasks)
            ->filter(fn ($task) => ! in_array($task['id'], $parentIds) && $task['item'] !== '')
            ->values()
            ->toArray();

        if (empty($leafTasks)) {
            return response()->json([
                'materiales' => [],
                'periodos' => [],
                'resumen' => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt' => false,
            ]);
        }

        $fechas = collect($leafTasks)->filter(fn ($task) => $task['start_date'] && $task['end_date']);
        $inicio = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->min(fn ($task) => $task['start_date']))->startOfMonth()
            : now()->startOfMonth();
        $fin = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->max(fn ($task) => $task['end_date']))->endOfMonth()
            : $inicio->copy()->addMonths(5)->endOfMonth();

        $periodos = $this->buildPeriodos($inicio, $fin);
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();
        $tareasPorPartida = collect($leafTasks)->keyBy(fn ($task) => trim($task['item']));
        $materialesFinales = $this->buildAcuResources(
            $presupuestoId,
            $tareasPorPartida,
            $clavesPeriodos,
        );

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

        // Calcular mes pico para el resumen
        $acumuladoMensual = [];
        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = array_sum(array_map(
                fn ($material) => $material['distribucion'][$periodo['key']]['monto'] ?? 0,
                $materialesFinales->toArray()
            ));
        }
        arsort($acumuladoMensual);
        $mesPicoKey = array_key_first($acumuladoMensual);
        $mesPicoLabel = '';
        foreach ($periodos as $p) {
            if ($p['key'] === $mesPicoKey) {
                $mesPicoLabel = $p['label'];
                break;
            }
        }

        return response()->json([
            'materiales' => $materialesFinales->toArray(),
            'periodos' => $periodos,
            'resumen' => [
                'total_materiales' => $materialesFinales->count(),
                'presupuesto_total' => round($materialesFinales->sum('costo_total'), 2),
                'duracion_meses' => count($periodos),
                'mes_pico' => $mesPicoLabel,
                'mes_pico_key' => $mesPicoKey,
                'monto_mes_pico' => round($acumuladoMensual[$mesPicoKey] ?? 0, 2),
                'total_partidas' => count($leafTasks),
            ],
            'estaGuardado' => $estaGuardado,
            'sinGantt' => false,
        ]);
    }

    /**
     * Determina el tipo de material basado en la descripción
     */
    private function determinarTipoMaterial(string $descripcion): string
    {
        $descripcionLower = strtolower($descripcion);

        if (str_contains($descripcionLower, 'mano') || str_contains($descripcionLower, 'obra')) {
            return 'mano_de_obra';
        }
        if (str_contains($descripcionLower, 'equipo') || str_contains($descripcionLower, 'maquinaria')) {
            return 'equipos';
        }
        if (str_contains($descripcionLower, 'subcontrato')) {
            return 'subcontratos';
        }
        if (str_contains($descripcionLower, 'subpartida')) {
            return 'subpartidas';
        }

        return 'materiales';
    }
}
