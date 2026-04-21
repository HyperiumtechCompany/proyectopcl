<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CronoMaterialesController extends Controller
{
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (!$projectId) abort(404, 'ID de proyecto no recibido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db           = $costoProject->database_name;

        // ── 1. PRIORIDAD: Intentar leer datos ya guardados en la tabla ──────────
        $materialesGuardados = DB::connection('mysql')
            ->table("{$db}.cronograma_materiales")
            ->where('presupuesto_id', $projectId)
            ->orderBy('item_order')
            ->get();

        if ($materialesGuardados->isNotEmpty()) {
            $materialesFinales = $materialesGuardados->map(function ($item) {
                return [
                    'descripcion'    => $item->descripcion,
                    'unidad'         => $item->unidad,
                    'precio'         => (float) $item->precio_unitario,
                    'cantidad_total' => (float) $item->cantidad_total,
                    'presupuesto'    => (float) $item->presupuesto_total,
                    // Decodificamos el JSON para que el Frontend lo reciba como objeto
                    'mensual'        => json_decode($item->distribucion_mensual, true) ?: [],
                ];
            });

            // Reconstruir los periodos basados en las llaves del primer material
            $primerMat = $materialesFinales->first();
            $periodos = [];
            if ($primerMat && !empty($primerMat['mensual'])) {
                foreach (array_keys($primerMat['mensual']) as $key) {
                    $cursor = Carbon::parse($key . "-01");
                    $periodos[] = [
                        'label' => ucfirst($cursor->translatedFormat('M Y')),
                        'key'   => $key,
                    ];
                }
            }

            return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
                'project'      => (string) $projectId,
                'projectName'  => $costoProject->nombre,
                'materiales'   => $materialesFinales,
                'periodos'     => $periodos,
                'resumen'      => $this->calcularResumen($materialesFinales->toArray(), $periodos, []),
                'estaGuardado' => true,
                'sinGantt'     => false,
            ]);
        }

        // ── 2. SI NO HAY GUARDADOS, PROCEDER CON CÁLCULO AUTOMÁTICO (GANTT) ─────
        $cronograma = DB::connection('mysql')
            ->table("{$db}.cronograma_general")
            ->where('project_id', $projectId)
            ->whereNotNull('config_json')
            ->orderByDesc('updated_at')
            ->first();

        if (!$cronograma || !$cronograma->config_json) {
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

        $ganttData = json_decode($cronograma->config_json, true);
        $tasks     = $ganttData['tasks'] ?? [];
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

        $fechas = collect($leafTasks)->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));
        $inicio = $fechas->min(fn($t) => $t['start_date']) ? Carbon::parse($fechas->min(fn($t) => $t['start_date']))->startOfMonth() : now()->startOfMonth();
        $fin    = $fechas->max(fn($t) => $t['end_date']) ? Carbon::parse($fechas->max(fn($t) => $t['end_date']))->endOfMonth() : $inicio->copy()->addMonths(5)->endOfMonth();

        $periodos = [];
        $cursor = $inicio->copy();
        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label' => ucfirst($cursor->translatedFormat('M Y')),
                'key'   => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
        }

        $codigosPartidas = collect($leafTasks)->pluck('item')->unique()->filter()->toArray();
        $materialesApu = DB::connection('mysql')
            ->table("{$db}.presupuesto_acus as pa")
            ->join("{$db}.acu_materiales as am", 'am.acu_id', '=', 'pa.id')
            ->join("{$db}.presupuesto_general as pg", function($j) use ($projectId) {
                $j->on('pg.presupuesto_id', '=', 'pa.presupuesto_id')
                  ->whereRaw('TRIM(pg.partida) = TRIM(pa.partida)');
            })
            ->where('pa.presupuesto_id', $projectId)
            ->whereIn(DB::raw('TRIM(pa.partida)'), array_map('trim', $codigosPartidas))
            ->select([
                DB::raw('TRIM(pa.partida) as partida'),
                'am.descripcion', 'am.unidad',
                DB::raw('am.precio_unitario as precio'),
                DB::raw('(am.cantidad * am.factor_desperdicio * pg.metrado) as cantidad_en_partida'),
                DB::raw('(am.cantidad * am.factor_desperdicio * pg.metrado * am.precio_unitario) as costo_en_partida'),
            ])->get();

        $tareasPorPartida = collect($leafTasks)->keyBy('item');
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();

        $materialesFinales = $materialesApu->groupBy('descripcion')->map(function ($filas, $descripcion) use ($tareasPorPartida, $clavesPeriodos) {
            $primerFila = $filas->first();
            $mensual = array_fill_keys($clavesPeriodos, 0.0);
            $cantTotal = 0.0;
            $costoTotal = 0.0;

            foreach ($filas as $fila) {
                $cantPartida = (float) $fila->cantidad_en_partida;
                $cantTotal += $cantPartida;
                $costoTotal += (float) $fila->costo_en_partida;

                $tarea = $tareasPorPartida->get(trim($fila->partida));
                if (!$tarea) {
                    $mensual[$clavesPeriodos[0]] += $cantPartida;
                } else {
                    $tsStart = Carbon::parse($tarea['start_date'])->startOfMonth();
                    $tsEnd   = Carbon::parse($tarea['end_date'])->endOfMonth();
                    $mesesActivos = [];
                    foreach ($clavesPeriodos as $key) {
                        if (Carbon::parse($key."-01")->between($tsStart, $tsEnd)) $mesesActivos[] = $key;
                    }
                    $num = count($mesesActivos);
                    if ($num > 0) {
                        foreach ($mesesActivos as $k) $mensual[$k] += $cantPartida / $num;
                    } else {
                        $mensual[$clavesPeriodos[0]] += $cantPartida;
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
        })->filter(fn($m) => $m['cantidad_total'] > 0)->sortBy('descripcion')->values();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project'      => (string) $projectId,
            'projectName'  => $costoProject->nombre,
            'materiales'   => $materialesFinales,
            'periodos'     => $periodos,
            'resumen'      => $this->calcularResumen($materialesFinales->toArray(), $periodos, $leafTasks),
            'estaGuardado' => false,
            'sinGantt'     => false,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate(['project_id' => 'required|integer', 'materiales' => 'required|array']);
        $projectId = (int) $request->input('project_id');
        $materiales = $request->input('materiales');
        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        DB::transaction(function () use ($db, $projectId, $materiales) {
            DB::connection('mysql')->table("{$db}.cronograma_materiales")->where('presupuesto_id', $projectId)->delete();
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
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::connection('mysql')->table("{$db}.cronograma_materiales")->insert($chunk);
            }
        });

        return response()->json(['status' => 'success', 'message' => '¡Cronograma guardado!']);
    }

    public function destroy(Request $request)
    {
        $projectId = (int) ($request->query('project') ?? $request->input('project'));
        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;
        DB::connection('mysql')->table("{$db}.cronograma_materiales")->where('presupuesto_id', $projectId)->delete();
        return response()->json(['status' => 'success', 'message' => 'Cronograma eliminado.']);
    }

    private function calcularResumen(array $materiales, array $periodos, array $leafTasks): array
    {
        $presupuestoTotal = array_sum(array_column($materiales, 'presupuesto'));
        $acumuladoMensual = [];
        foreach ($periodos as $p) {
            $acumuladoMensual[$p['key']] = array_sum(array_map(fn($m) => ($m['mensual'][$p['key']] ?? 0) * $m['precio'], $materiales));
        }
        arsort($acumuladoMensual);
        $mesPico = array_key_first($acumuladoMensual);
        return [
            'total_materiales'  => count($materiales),
            'presupuesto_total' => round($presupuestoTotal, 2),
            'duracion_meses'    => count($periodos),
            'mes_pico'          => $mesPico,
            'monto_mes_pico'    => round($acumuladoMensual[$mesPico] ?? 0, 2),
            'total_partidas'    => count($leafTasks),
        ];
    }

    private function resumenVacio() {
        return ['total_materiales' => 0, 'presupuesto_total' => 0, 'duracion_meses' => 0, 'mes_pico' => null, 'monto_mes_pico' => 0, 'total_partidas' => 0];
    }
}