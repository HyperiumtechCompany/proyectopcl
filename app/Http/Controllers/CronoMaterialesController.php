<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Services\CostoDatabaseService;

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
        $codigosPartidas = collect($leafTasks)->pluck('item')->unique()->filter()->map(fn ($item) => trim($item))->toArray();

        $materialesApu = DB::connection('costos_tenant')
            ->table('presupuesto_acus as pa')
            ->join('presupuesto_acus as am', 'am.acu_id', '=', 'pa.id')
            ->join('presupuesto_general as pg', fn ($join) => $join
                ->on('pg.presupuesto_id', '=', 'pa.presupuesto_id')
                ->whereRaw('TRIM(pg.partida) = TRIM(pa.partida)'))
            ->where('pa.presupuesto_id', $presupuestoId)
            ->whereIn(DB::raw('TRIM(pa.partida)'), $codigosPartidas)
            ->select([
                DB::raw('TRIM(pa.partida) as partida'),
                'am.descripcion',
                'am.unidad',
                DB::raw('am.precio_unitario as precio'),
                DB::raw('am.cantidad as aporte_unitario'),
                DB::raw('COALESCE(am.factor_desperdicio, 1) as factor_desperdicio'),
                'pg.metrado as metrado_partida',
                DB::raw('(am.cantidad * COALESCE(am.factor_desperdicio, 1) * pg.metrado) as cantidad_en_partida'),
                DB::raw('(am.cantidad * COALESCE(am.factor_desperdicio, 1) * pg.metrado * am.precio_unitario) as costo_en_partida'),
            ])
            ->get();

        $tareasPorPartida = collect($leafTasks)->keyBy(fn ($task) => trim($task['item']));
        $materialesFinales = $materialesApu
            ->groupBy('descripcion')
            ->map(function ($filas, $descripcion) use ($tareasPorPartida, $clavesPeriodos) {
                $primerFila = $filas->first();
                $mensual = array_fill_keys($clavesPeriodos, 0.0);
                $cantidadTotal = 0.0;
                $costoTotal = 0.0;

                foreach ($filas as $fila) {
                    $cantidadPartida = (float) $fila->cantidad_en_partida;
                    $costoPartida = (float) $fila->costo_en_partida;
                    $cantidadTotal += $cantidadPartida;
                    $costoTotal += $costoPartida;

                    if ($cantidadPartida <= 0) {
                        continue;
                    }

                    $tarea = $tareasPorPartida->get(trim($fila->partida));
                    $mesesActivos = $this->activeMonths($tarea, $clavesPeriodos);

                    if (empty($mesesActivos)) {
                        $mensual[$clavesPeriodos[0]] += $cantidadPartida;

                        continue;
                    }

                    $distribucion = $cantidadPartida / count($mesesActivos);
                    foreach ($mesesActivos as $key) {
                        $mensual[$key] += $distribucion;
                    }
                }

                return [
                    'descripcion' => $descripcion,
                    'unidad' => $primerFila->unidad,
                    'precio' => (float) $primerFila->precio,
                    'cantidad_total' => round($cantidadTotal, 4),
                    'presupuesto' => round($costoTotal, 2),
                    'mensual' => array_map(fn ($value) => round($value, 4), $mensual),
                ];
            })
            ->filter(fn ($material) => $material['cantidad_total'] > 0)
            ->sortBy('descripcion')
            ->values();

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'materiales' => $materialesFinales->toArray(),
            'periodos' => $periodos,
            'resumen' => $this->calcularResumen($materialesFinales->toArray(), $periodos, $leafTasks),
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

        $projectId  = (int) $request->input('project_id');
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
                    'presupuesto_total' => $material['presupuesto'],
                    'distribucion_mensual' => json_encode($material['mensual']),
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
    $codigosPartidas = collect($leafTasks)->pluck('item')->unique()->filter()->map(fn ($item) => trim($item))->toArray();

    $materialesApu = DB::connection('costos_tenant')
        ->table('presupuesto_acus as pa')
        ->join('presupuesto_acus as am', 'am.acu_id', '=', 'pa.id')
        ->join('presupuesto_general as pg', fn ($join) => $join
            ->on('pg.presupuesto_id', '=', 'pa.presupuesto_id')
            ->whereRaw('TRIM(pg.partida) = TRIM(pa.partida)'))
        ->where('pa.presupuesto_id', $presupuestoId)
        ->whereIn(DB::raw('TRIM(pa.partida)'), $codigosPartidas)
        ->select([
            DB::raw('TRIM(pa.partida) as partida'),
            'am.descripcion',
            'am.unidad',
            DB::raw('am.precio_unitario as precio'),
            DB::raw('am.cantidad as aporte_unitario'),
            DB::raw('COALESCE(am.factor_desperdicio, 1) as factor_desperdicio'),
            'pg.metrado as metrado_partida',
            DB::raw('(am.cantidad * COALESCE(am.factor_desperdicio, 1) * pg.metrado) as cantidad_en_partida'),
            DB::raw('(am.cantidad * COALESCE(am.factor_desperdicio, 1) * pg.metrado * am.precio_unitario) as costo_en_partida'),
        ])
        ->get();

    $tareasPorPartida = collect($leafTasks)->keyBy(fn ($task) => trim($task['item']));
    $materialesFinales = $materialesApu
        ->groupBy('descripcion')
        ->map(function ($filas, $descripcion) use ($tareasPorPartida, $clavesPeriodos) {
            $primerFila = $filas->first();
            $mensual = array_fill_keys($clavesPeriodos, 0.0);
            $cantidadTotal = 0.0;
            $costoTotal = 0.0;

            foreach ($filas as $fila) {
                $cantidadPartida = (float) $fila->cantidad_en_partida;
                $costoPartida = (float) $fila->costo_en_partida;
                $cantidadTotal += $cantidadPartida;
                $costoTotal += $costoPartida;

                if ($cantidadPartida <= 0) {
                    continue;
                }

                $tarea = $tareasPorPartida->get(trim($fila->partida));
                $mesesActivos = $this->activeMonths($tarea, $clavesPeriodos);

                if (empty($mesesActivos)) {
                    $mensual[$clavesPeriodos[0]] += $cantidadPartida;
                    continue;
                }

                $distribucion = $cantidadPartida / count($mesesActivos);
                foreach ($mesesActivos as $key) {
                    $mensual[$key] += $distribucion;
                }
            }

            return [
                'partida_origen' => $primerFila->partida ?? '',
                'descripcion' => $descripcion,
                'descripcion_partida' => '',
                'unidad' => $primerFila->unidad,
                'tipo' => $this->determinarTipoMaterial($descripcion),
                'precio' => (float) $primerFila->precio,
                'cantidad_total' => round($cantidadTotal, 4),
                'costo_total' => round($costoTotal, 2),
                'distribucion' => array_map(fn ($value) => [
                    'cantidad' => round($value, 4),
                    'monto' => round($value * (float) $primerFila->precio, 2),
                ], $mensual),
            ];
        })
        ->filter(fn ($material) => $material['cantidad_total'] > 0)
        ->sortBy('descripcion')
        ->values();

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
