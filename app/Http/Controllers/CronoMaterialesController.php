<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CronoMaterialesController extends Controller
{
    // ──────────────────────────────────────────────────────────────────────────
    // INDEX — Lee el Gantt desde config_json, cruza con APU y retorna
    //         el cronograma de materiales mes a mes.
    // ──────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (!$projectId) abort(404, 'ID de proyecto no recibido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db           = $costoProject->database_name;

        // ── 1. Leer el config_json del Gantt General ──────────────────────────
   // ── 1. Leer tareas desde cronograma_general (filas individuales) ──────
$filas = DB::connection('mysql')
    ->table("{$db}.cronograma_general")
    ->where('project_id', $projectId)
    ->orderBy('item_order')
    ->get();

if ($filas->isEmpty()) {
    return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
        'project'      => (string) $projectId,
        'projectName'  => $costoProject->nombre,
        'materiales'   => [],
        'periodos'     => [],
        'resumen'      => $this->resumenVacio(),
        'estaGuardado' => false,
        'sinGantt'     => true,
    ]);
}

$tasks = $filas->map(fn($f) => [
    'id'         => (string)$f->gantt_id,
    'item'       => $f->partida,
    'parent'     => $f->parent_id ? (string)$f->parent_id : 0,
    'start_date' => $f->fecha_inicio,
    'end_date'   => $f->fecha_fin,
    'cost'       => (float)$f->costo,
])->toArray();

// ── 2. Identificar tareas HOJA ────────────────────────────────────────
$parentIds = collect($tasks)->pluck('parent')->filter()->unique()->toArray();
$leafTasks = collect($tasks)
    ->filter(fn($t) => !in_array($t['id'], $parentIds) && !empty($t['item']))
    ->values()
    ->toArray();

        if (empty($leafTasks)) {
            return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
                'project'      => (string) $projectId,
                'projectName'  => $costoProject->nombre,
                'materiales'   => [],
                'periodos'     => [],
                'resumen'      => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt'     => false,
            ]);
        }

        // ── 3. Rango de fechas del proyecto ───────────────────────────────────
        $fechas = collect($leafTasks)
            ->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));

        $inicioProyecto = $fechas->min(fn($t) => $t['start_date']);
        $finProyecto    = $fechas->max(fn($t) => $t['end_date']);

        $inicio = $inicioProyecto
            ? Carbon::parse($inicioProyecto)->startOfMonth()
            : now()->startOfMonth();
        $fin = $finProyecto
            ? Carbon::parse($finProyecto)->endOfMonth()
            : $inicio->copy()->addMonths(5)->endOfMonth();

        // ── 4. Generar períodos mensuales ────────────────────────────────────
        $periodos = [];
        $cursor   = $inicio->copy();
        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label' => ucfirst($cursor->translatedFormat('M Y')),
                'key'   => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
        }

        // ── 5. Obtener materiales de APU por partida ──────────────────────────
        $codigosPartidas = collect($leafTasks)->pluck('item')->unique()->filter()->toArray();

        $materialesApu = DB::connection('mysql')
            ->table("{$db}.presupuesto_acus as pa")
            ->join("{$db}.acu_materiales as am", 'am.acu_id', '=', 'pa.id')
            ->join("{$db}.presupuesto_general as pg",
                fn($j) => $j
                    ->on('pg.presupuesto_id', '=', 'pa.presupuesto_id')
                    ->whereRaw('TRIM(pg.partida) = TRIM(pa.partida)')
            )
            ->where('pa.presupuesto_id', $projectId)
            ->whereIn(DB::raw('TRIM(pa.partida)'), array_map('trim', $codigosPartidas))
            ->select([
                DB::raw('TRIM(pa.partida) as partida'),
                'am.descripcion',
                'am.unidad',
                DB::raw('am.precio_unitario as precio'),
                DB::raw('am.cantidad as aporte_unitario'),
                DB::raw('am.factor_desperdicio'),
                'pg.metrado as metrado_partida',
                DB::raw('(am.cantidad * am.factor_desperdicio * pg.metrado) as cantidad_en_partida'),
                DB::raw('(am.cantidad * am.factor_desperdicio * pg.metrado * am.precio_unitario) as costo_en_partida'),
            ])
            ->get();

        // ── 6. Cruzar tareas con materiales y distribuir por mes ─────────────
        // Índice rápido: partida → datos de tarea (fechas)
        $tareasPorPartida = collect($leafTasks)->keyBy('item');

        // Agrupar materiales por descripción (un material puede estar en varias partidas)
        $agrupados = $materialesApu->groupBy('descripcion');

        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();

        $materialesFinales = $agrupados->map(function ($filas, $descripcion) use (
            $tareasPorPartida, $clavesPeriodos, $periodos
        ) {
            $primerFila  = $filas->first();
            $mensual     = array_fill_keys($clavesPeriodos, 0.0);
            $cantTotal   = 0.0;
            $costoTotal  = 0.0;

            foreach ($filas as $fila) {
                $cantPartida  = (float) $fila->cantidad_en_partida;
                $costoPartida = (float) $fila->costo_en_partida;
                $cantTotal   += $cantPartida;
                $costoTotal  += $costoPartida;

                if ($cantPartida <= 0) continue;

                $tarea = $tareasPorPartida->get(trim($fila->partida));
                if (!$tarea) {
                    $mensual[$clavesPeriodos[0]] = ($mensual[$clavesPeriodos[0]] ?? 0) + $cantPartida;
                    continue;
                }

                // Determinar meses activos de la tarea
                $tsStart = !empty($tarea['start_date'])
                    ? Carbon::parse($tarea['start_date'])->startOfMonth()
                    : null;
                $tsEnd   = !empty($tarea['end_date'])
                    ? Carbon::parse($tarea['end_date'])->endOfMonth()
                    : null;

                $mesesActivos = [];
                foreach ($clavesPeriodos as $key) {
                    $fechaMes = Carbon::parse("{$key}-01");
                    if ($tsStart && $tsEnd && $fechaMes->between($tsStart, $tsEnd)) {
                        $mesesActivos[] = $key;
                    }
                }

                $numMeses = count($mesesActivos);
                if ($numMeses === 0) {
                    $mensual[$clavesPeriodos[0]] = ($mensual[$clavesPeriodos[0]] ?? 0) + $cantPartida;
                } else {
                    $dist = $cantPartida / $numMeses;
                    foreach ($mesesActivos as $key) {
                        $mensual[$key] = ($mensual[$key] ?? 0) + $dist;
                    }
                }
            }

            return [
                'descripcion'    => $descripcion,
                'unidad'         => $primerFila->unidad,
                'precio'         => (float) $primerFila->precio,
                'cantidad_total' => round($cantTotal, 4),
                'presupuesto'    => round($costoTotal, 2),
                'mensual'        => array_map(fn($v) => round($v, 4), $mensual),
            ];
        })
        ->filter(fn($m) => $m['cantidad_total'] > 0)
        ->sortBy('descripcion')
        ->values();

        // ── 7. Resumen estadístico ─────────────────────────────────────────────
        $resumen = $this->calcularResumen($materialesFinales->toArray(), $periodos, $leafTasks);

        // ── 8. ¿Ya está guardado en cronograma_materiales? ────────────────────
        $estaGuardado = DB::connection('mysql')
            ->table("{$db}.cronograma_materiales")
            ->where('presupuesto_id', $projectId)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project'      => (string) $projectId,
            'projectName'  => $costoProject->nombre,
            'materiales'   => $materialesFinales->toArray(),
            'periodos'     => $periodos,
            'resumen'      => $resumen,
            'estaGuardado' => $estaGuardado,
            'sinGantt'     => false,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STORE — Guarda el cronograma en cronograma_materiales
    // ──────────────────────────────────────────────────────────────────────────
    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|integer',
            'materiales' => 'required|array',
        ]);

        $projectId = (int) $request->input('project_id');
        $materiales = $request->input('materiales');

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        DB::transaction(function () use ($db, $projectId, $materiales) {
            // Limpiar registros anteriores
            DB::connection('mysql')
                ->table("{$db}.cronograma_materiales")
                ->where('presupuesto_id', $projectId)
                ->delete();

            // Insertar nuevos
            $rows = [];
            foreach ($materiales as $idx => $mat) {
                $rows[] = [
                    'presupuesto_id'      => $projectId,
                    'item_order'          => $idx + 1,
                    'descripcion'         => $mat['descripcion'],
                    'unidad'              => $mat['unidad'] ?? '',
                    'cantidad_total'      => $mat['cantidad_total'],
                    'precio_unitario'     => $mat['precio'],
                    'presupuesto_total'   => $mat['presupuesto'],
                    'distribucion_mensual'=> json_encode($mat['mensual']),
                    'created_at'          => now(),
                    'updated_at'          => now(),
                ];
            }

            // Insertar en lotes de 200 para grandes volúmenes
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::connection('mysql')
                    ->table("{$db}.cronograma_materiales")
                    ->insert($chunk);
            }
        });

        return response()->json([
            'status'  => 'success',
            'message' => '¡Cronograma de materiales guardado correctamente!',
            'total'   => count($materiales),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DESTROY — Elimina el cronograma guardado
    // ──────────────────────────────────────────────────────────────────────────
    public function destroy(Request $request)
    {
        $projectId = (int) ($request->query('project') ?? $request->input('project'));
        if (!$projectId) abort(422, 'Project ID requerido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        $deleted = DB::connection('mysql')
            ->table("{$db}.cronograma_materiales")
            ->where('presupuesto_id', $projectId)
            ->delete();

        return response()->json([
            'status'  => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma de materiales.",
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVADOS
    // ──────────────────────────────────────────────────────────────────────────
    private function calcularResumen(array $materiales, array $periodos, array $leafTasks): array
    {
        $totalMateriales   = count($materiales);
        $presupuestoTotal  = array_sum(array_column($materiales, 'presupuesto'));

        // Mes pico (mayor gasto mensual)
        $acumuladoMensual = [];
        foreach ($periodos as $p) {
            $acumuladoMensual[$p['key']] = array_sum(array_map(
                fn($m) => ($m['mensual'][$p['key']] ?? 0) * $m['precio'],
                $materiales
            ));
        }
        arsort($acumuladoMensual);
        $mesPico    = array_key_first($acumuladoMensual) ?? null;
        $montoPico  = $acumuladoMensual[$mesPico] ?? 0;

        // Duración del proyecto
        $duracionMeses = count($periodos);

        return [
            'total_materiales'   => $totalMateriales,
            'presupuesto_total'  => round($presupuestoTotal, 2),
            'duracion_meses'     => $duracionMeses,
            'mes_pico'           => $mesPico,
            'monto_mes_pico'     => round($montoPico, 2),
            'total_partidas'     => count($leafTasks),
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_materiales'  => 0,
            'presupuesto_total' => 0,
            'duracion_meses'    => 0,
            'mes_pico'          => null,
            'monto_mes_pico'    => 0,
            'total_partidas'    => 0,
        ];
    }
}