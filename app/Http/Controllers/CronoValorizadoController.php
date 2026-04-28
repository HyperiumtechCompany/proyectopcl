<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CronoValorizadoController extends Controller
{
    // ─────────────────────────────────────────────────────────────────────────
    // INDEX — Cruza Gantt + presupuesto_general para calcular el valorizado
    // ─────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (!$projectId) abort(404, 'ID de proyecto no recibido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        // ── 1. Leer config_json del Gantt ─────────────────────────────────────
    // ── 1. Leer tareas desde cronograma_general (filas individuales) ──────
$filas = DB::connection('mysql')
    ->table("{$db}.cronograma_general")
    ->where('project_id', $projectId)
    ->orderBy('item_order')
    ->get();

if ($filas->isEmpty()) {
    return Inertia::render('costos/cronogramas/valorizado/CronogramaValorizado', [
        'project'          => (string) $projectId,
        'projectName'      => $costoProject->nombre,
        'items'            => [],
        'periodos'         => [],
        'totalPresupuesto' => 0,
        'resumen'          => $this->resumenVacio(),
        'sinGantt'         => true,
    ]);
}

$tasks = $filas->map(fn($f) => [
    'id'         => (string)$f->gantt_id,
    'item'       => $f->partida,
    'parent'     => $f->parent_id ? (string)$f->parent_id : 0,
    'start_date' => $f->fecha_inicio,
    'end_date'   => $f->fecha_fin,
    'cost'       => (float)$f->costo,
]);

// ── 2. Identificar tareas HOJA ────────────────────────────────────────
$parentIds = $tasks->pluck('parent')->filter()->unique()->values()->toArray();
$leafTasks = $tasks
    ->filter(fn($t) => !in_array($t['id'], $parentIds))
    ->keyBy(fn($t) => trim($t['item'] ?? ''))
    ->filter(fn($t, $k) => $k !== '');

        // ── 3. Determinar períodos del proyecto ────────────────────────────────
        $fechas = $tasks->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));
        $minFecha = $fechas->min(fn($t) => $t['start_date']);
        $maxFecha = $fechas->max(fn($t) => $t['end_date']);

        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin    = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth()   : $inicio->copy()->addMonths(5);

        $periodos = [];
        $mesNum   = 1;
        $cursor   = $inicio->copy();
        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label'    => "MES {$mesNum}",
                'labelCal' => ucfirst($cursor->translatedFormat('M Y')),
                'key'      => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
            $mesNum++;
        }

        $clavesPeriodos = array_column($periodos, 'key');

        // ── 4. Leer presupuesto_general (fuente de verdad de montos) ──────────
        $presupuesto = DB::connection('mysql')
            ->table("{$db}.presupuesto_general")
            ->where('presupuesto_id', $projectId)
            ->whereNull('deleted_at')
            ->orderBy('item_order')
            ->get()
            ->keyBy(fn($p) => trim($p->partida ?? ''));

        // ── 5. Leer valorizado guardado (si existe) ───────────────────────────
        $valorizadoGuardado = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $projectId)
            ->get()
            ->keyBy(fn($v) => trim($v->partida ?? ''));

        $estaGuardado = $valorizadoGuardado->isNotEmpty();

        // ── 6. Construir items combinando Gantt + presupuesto + valorizado ─────
        // Recorremos el presupuesto en orden para mantener jerarquía
        $allItems = [];
        $totalPresupuesto = 0;

        foreach ($presupuesto as $partida => $pItem) {
            $task   = $leafTasks->get($partida);
            $valRow = $valorizadoGuardado->get($partida);

            // Parcial: presupuesto_general tiene prioridad; si es 0, usar cost del Gantt
            $parcial = (float)($pItem->parcial ?? 0);
            if ($parcial == 0 && $task) {
                $parcial = (float)($task['cost'] ?? 0);
            }

            // Calcular distribución mensual
            if ($valRow) {
                // Ya guardado: usar distribución guardada
                $distribucion = json_decode($valRow->distribucion_mensual, true) ?? [];
            } elseif ($task && !empty($task['start_date']) && !empty($task['end_date']) && $parcial > 0) {
                // Calcular distribución lineal por fecha de tarea
                $distribucion = $this->distribuirLinealmente(
                    $parcial,
                    $task['start_date'],
                    $task['end_date'],
                    $clavesPeriodos,
                    $periodos
                );
            } else {
                // Sin fecha ni guardado: distribución vacía
                $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0, 'porcentaje' => 0]);
            }

            // Normalizar: asegurar todas las claves
            foreach ($clavesPeriodos as $key) {
                if (!isset($distribucion[$key])) {
                    $distribucion[$key] = ['monto' => 0, 'porcentaje' => 0];
                }
                // Recalcular porcentaje si cambió el total
                if ($parcial > 0) {
                    $distribucion[$key]['porcentaje'] = ($distribucion[$key]['monto'] / $parcial) * 100;
                }
            }

            $isLeaf = $leafTasks->has($partida);

            $allItems[] = [
                'id'          => $pItem->id,
                'item'        => $pItem->partida,
                'descripcion' => $pItem->descripcion,
                'und'         => $pItem->unidad    ?? '',
                'metrado'     => (float)($pItem->metrado ?? 0),
                'precio'      => (float)($pItem->precio_unitario ?? 0),
                'parcial'     => $parcial,
                'is_leaf'     => $isLeaf,
                'distribucion'=> $distribucion,
            ];

            if ($isLeaf) {
                $totalPresupuesto += $parcial;
            }
        }

        // ── 7. Calcular resumen ───────────────────────────────────────────────
        $resumen = $this->calcularResumen($allItems, $periodos, $totalPresupuesto);

        return Inertia::render('costos/cronogramas/valorizado/CronogramaValorizado', [
            'project'          => (string) $projectId,
            'projectName'      => $costoProject->nombre,
            'items'            => $allItems,
            'periodos'         => $periodos,
            'totalPresupuesto' => $totalPresupuesto,
            'resumen'          => $resumen,
            'sinGantt'         => false,
            'estaGuardado'     => $estaGuardado,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STORE — Guarda el valorizado en cronograma_valorizado
    // ─────────────────────────────────────────────────────────────────────────
    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|integer',
            'items'      => 'required|array',
        ]);

        $projectId = (int) $request->input('project_id');
        $items     = $request->input('items');

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        DB::connection('mysql')->transaction(function () use ($db, $projectId, $items) {
            // Limpiar y re-insertar
            DB::connection('mysql')
                ->table("{$db}.cronograma_valorizado")
                ->where('presupuesto_id', $projectId)
                ->delete();

            $rows = [];
            foreach ($items as $idx => $item) {
                $rows[] = [
                    'presupuesto_id'      => $projectId,
                    'item_order'          => $idx + 1,
                    'partida'             => $item['item'],
                    'descripcion'         => $item['descripcion'],
                    'presupuesto_total'   => $item['parcial'],
                    'distribucion_mensual'=> json_encode($item['distribucion']),
                    'parent_id'           => null,
                    'nivel'               => substr_count($item['item'], '.'),
                    'created_at'          => now(),
                    'updated_at'          => now(),
                ];
            }

            foreach (array_chunk($rows, 200) as $chunk) {
                DB::connection('mysql')
                    ->table("{$db}.cronograma_valorizado")
                    ->insert($chunk);
            }
        });

        return response()->json([
            'status'  => 'success',
            'message' => '¡Cronograma Valorizado guardado correctamente!',
            'total'   => count($items),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DESTROY — Elimina el valorizado guardado
    // ─────────────────────────────────────────────────────────────────────────
    public function destroy(Request $request)
    {
        $projectId = (int) ($request->query('project') ?? $request->input('project'));
        if (!$projectId) abort(422, 'Project ID requerido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        $deleted = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $projectId)
            ->delete();

        return response()->json([
            'status'  => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma valorizado.",
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVADOS
    // ─────────────────────────────────────────────────────────────────────────
    private function distribuirLinealmente(
        float  $parcial,
        string $startDate,
        string $endDate,
        array  $clavesPeriodos,
        array  $periodos
    ): array {
        $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0, 'porcentaje' => 0]);

        $tsStart = Carbon::parse($startDate)->startOfMonth();
        $tsEnd   = Carbon::parse($endDate)->endOfMonth();

        $mesesActivos = array_filter($clavesPeriodos, function ($key) use ($tsStart, $tsEnd) {
            $fechaMes = Carbon::parse("{$key}-01");
            return $fechaMes->between($tsStart, $tsEnd);
        });

        $numMeses = count($mesesActivos);
        if ($numMeses === 0 && !empty($clavesPeriodos)) {
            $mesesActivos = [$clavesPeriodos[0]];
            $numMeses     = 1;
        }

        if ($numMeses > 0) {
            $montoPorMes = $parcial / $numMeses;
            $pctPorMes   = 100 / $numMeses;
            foreach ($mesesActivos as $key) {
                $distribucion[$key] = [
                    'monto'      => round($montoPorMes, 2),
                    'porcentaje' => round($pctPorMes, 4),
                ];
            }
        }

        return $distribucion;
    }

    private function calcularResumen(array $items, array $periodos, float $totalPresupuesto): array
    {
        if (empty($periodos) || $totalPresupuesto == 0) {
            return $this->resumenVacio();
        }

        // Acumulado mensual
        $acumuladoMensual = [];
        $acum             = 0;
        foreach ($periodos as $p) {
            $montoMes = array_sum(array_map(fn($i) => $i['distribucion'][$p['key']]['monto'] ?? 0, $items));
            $acum     += $montoMes;
            $acumuladoMensual[$p['key']] = ['mensual' => $montoMes, 'acumulado' => $acum];
        }

        // Mes pico
        $mesPicoKey   = '';
        $mesPicoMonto = 0;
        foreach ($acumuladoMensual as $key => $v) {
            if ($v['mensual'] > $mesPicoMonto) {
                $mesPicoMonto = $v['mensual'];
                $mesPicoKey   = $key;
            }
        }

        return [
            'total_partidas'    => count($items),
            'presupuesto_total' => round($totalPresupuesto, 2),
            'duracion_meses'    => count($periodos),
            'mes_pico'          => $mesPicoKey,
            'monto_mes_pico'    => round($mesPicoMonto, 2),
            'pct_mes_pico'      => $totalPresupuesto > 0 ? round(($mesPicoMonto / $totalPresupuesto) * 100, 2) : 0,
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_partidas'    => 0,
            'presupuesto_total' => 0,
            'duracion_meses'    => 0,
            'mes_pico'          => null,
            'monto_mes_pico'    => 0,
            'pct_mes_pico'      => 0,
        ];
    }
}