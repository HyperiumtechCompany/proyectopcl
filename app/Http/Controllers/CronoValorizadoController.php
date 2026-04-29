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

        // ── 1. Leer tareas desde cronograma_general ──────────────────────────────
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
                'diasPorMes'       => [], // Añadido para evitar error en frontend
            ]);
        }

        // ── 2. Leer presupuesto_general (si existe) ──────────────────────────────
        $presupuesto = DB::connection('mysql')
            ->table("{$db}.presupuesto_general")
            ->where('presupuesto_id', $projectId)
            ->whereNull('deleted_at')
            ->orderBy('item_order')
            ->get()
            ->keyBy(fn($p) => trim($p->partida ?? ''));

        $usarCronoFuente = $presupuesto->isEmpty();

        // ── 3. Preparar tareas desde Gantt ───────────────────────────────────────
        $tasks = $filas->map(fn($f) => [
            'id'         => (string)$f->gantt_id,
            'item'       => $f->partida,
            'parent'     => $f->parent_id ? (string)$f->parent_id : '0',
            'start_date' => $f->fecha_inicio,
            'end_date'   => $f->fecha_fin,
            'cost'       => (float)($f->costo ?? 0),
            'descripcion'=> $f->descripcion ?? '',
            'unidad'     => $f->unidad ?? '',
            'metrado'    => 0,
            'precio'     => 0,
        ])->keyBy('id');

        // ── 4. Determinar períodos (min fecha / max fecha) ───────────────────────
        $fechas = $tasks->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));
        $minFecha = $fechas->min(fn($t) => $t['start_date']);
        $maxFecha = $fechas->max(fn($t) => $t['end_date']);

        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin    = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth()   : $inicio->copy()->addMonths(5);

        $periodos = [];
        $mesNum = 1;
        $cursor = $inicio->copy();
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

        // ── 4b. Calcular días naturales del proyecto por mes (para mostrar en frontend) ──
        $fechaInicioProyecto = $minFecha ? Carbon::parse($minFecha) : now();
        $fechaFinProyecto    = $maxFecha ? Carbon::parse($maxFecha) : $fechaInicioProyecto;
        $diasPorMesProyecto = [];
        $cursorDias = $fechaInicioProyecto->copy();
        while ($cursorDias->lte($fechaFinProyecto)) {
            $key = $cursorDias->format('Y-m');
            $diasPorMesProyecto[$key] = ($diasPorMesProyecto[$key] ?? 0) + 1;
            $cursorDias->addDay();
        }
        // Asegurar que todos los meses del período tengan al menos 0 días
        foreach ($clavesPeriodos as $key) {
            if (!isset($diasPorMesProyecto[$key])) {
                $diasPorMesProyecto[$key] = 0;
            }
        }

        // ── 5. Leer valorizado guardado ──────────────────────────────────────────
        $valorizadoGuardado = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $projectId)
            ->get()
            ->keyBy(fn($v) => trim($v->partida ?? ''));

        $estaGuardado = $valorizadoGuardado->isNotEmpty();

        // ── 6. Construir items (árbol completo) ──────────────────────────────────
        $allItems = [];
        $totalPresupuesto = 0;

        if ($usarCronoFuente) {
            // --- Construir jerarquía desde cronograma_general ---
            $parentIds = $tasks->pluck('parent')->filter(fn($p) => $p !== '0')->unique()->values()->toArray();
            $leafTasks = $tasks->filter(fn($t) => !in_array($t['id'], $parentIds));

            // Calcular parcial y distribución para cada hoja (usando días reales)
            $leafData = [];
            foreach ($leafTasks as $id => $task) {
                $parcial = (float)($task['cost'] ?? 0);
                $valRow = $valorizadoGuardado->get($task['item']);
                if ($valRow) {
                    $distribucion = json_decode($valRow->distribucion_mensual, true) ?? [];
                } elseif (!empty($task['start_date']) && !empty($task['end_date']) && $parcial > 0) {
                    // NUEVO: usar distribución por días reales (naturales)
                    $distribucion = $this->distribuirPorDias(
                        $parcial,
                        $task['start_date'],
                        $task['end_date'],
                        $clavesPeriodos,
                        $periodos
                    );
                } else {
                    $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0, 'porcentaje' => 0]);
                }

                // Normalizar distribución (asegurar que todos los meses tengan estructura)
                foreach ($clavesPeriodos as $key) {
                    if (!isset($distribucion[$key])) {
                        $distribucion[$key] = ['monto' => 0, 'porcentaje' => 0];
                    }
                    if ($parcial > 0) {
                        $distribucion[$key]['porcentaje'] = ($distribucion[$key]['monto'] / $parcial) * 100;
                    } else {
                        $distribucion[$key]['porcentaje'] = 0;
                    }
                }

                $leafData[$id] = [
                    'parcial'      => $parcial,
                    'distribucion' => $distribucion,
                ];
                $totalPresupuesto += $parcial;
            }

            // Recorrer todas las tareas en orden para construir el árbol
            $sortedTasks = $filas->sortBy('item_order');
            $itemsMap = [];

            foreach ($sortedTasks as $row) {
                $id = (string)$row->gantt_id;
                $parentId = $row->parent_id ? (string)$row->parent_id : '0';

                if (isset($leafData[$id])) {
                    $parcial = $leafData[$id]['parcial'];
                    $distribucion = $leafData[$id]['distribucion'];
                } else {
                    $parcial = 0;
                    $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0, 'porcentaje' => 0]);
                }

                $itemsMap[$id] = [
                    'id'          => $id,
                    'item'        => $row->partida,
                    'descripcion' => $row->descripcion,
                    'und'         => $row->unidad ?? '',
                    'metrado'     => 0,
                    'precio'      => 0,
                    'parcial'     => $parcial,
                    'is_leaf'     => isset($leafData[$id]),
                    'distribucion'=> $distribucion,
                    'parent_id'   => $parentId,
                ];
            }

            // Acumular de hijos a padres
            $reversed = array_reverse($itemsMap, true);
            foreach ($reversed as $id => &$item) {
                $parentId = $item['parent_id'];
                if ($parentId !== '0' && isset($itemsMap[$parentId])) {
                    $itemsMap[$parentId]['parcial'] += $item['parcial'];
                    foreach ($clavesPeriodos as $key) {
                        $itemsMap[$parentId]['distribucion'][$key]['monto'] += $item['distribucion'][$key]['monto'];
                    }
                }
            }

            // Recalcular porcentajes en padres
            foreach ($itemsMap as &$item) {
                if (!$item['is_leaf'] && $item['parcial'] > 0) {
                    foreach ($clavesPeriodos as $key) {
                        $item['distribucion'][$key]['porcentaje'] = ($item['distribucion'][$key]['monto'] / $item['parcial']) * 100;
                    }
                } elseif (!$item['is_leaf']) {
                    foreach ($clavesPeriodos as $key) {
                        $item['distribucion'][$key]['porcentaje'] = 0;
                    }
                }
            }

            // Orden final según item_order
            $allItems = [];
            foreach ($sortedTasks as $row) {
                $id = (string)$row->gantt_id;
                if (isset($itemsMap[$id])) {
                    $allItems[] = $itemsMap[$id];
                }
            }
        } else {
            // --- Caso con presupuesto_general (por implementar con distribución por días)
            // Por ahora, dejamos la lógica anterior que usaba distribuirLinealmente,
            // pero como $presupuesto está vacío en tu caso, esto no se ejecuta.
            // Si en el futuro deseas que funcione también, avísame y lo adapto.
            foreach ($presupuesto as $partida => $pItem) {
                // Código pendiente de migrar a distribución por días.
                // Por ahora se mantiene el comportamiento anterior (no se usa porque $presupuesto está vacío).
            }
        }

        // ── 7. Resumen ───────────────────────────────────────────────────────────
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
            'diasPorMes'       => $diasPorMesProyecto,  // 🆕 Días trabajados por mes (naturales)
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
    // NUEVO: Distribución proporcional a días reales (naturales) por mes
    // ─────────────────────────────────────────────────────────────────────────
    private function distribuirPorDias(
        float  $parcial,
        string $startDate,
        string $endDate,
        array  $clavesPeriodos,
        array  $periodos
    ): array {
        $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0, 'porcentaje' => 0]);

        $inicio = Carbon::parse($startDate);
        $fin    = Carbon::parse($endDate);

        // Si la tarea dura menos de 1 día, asignar todo al mes de inicio
        if ($inicio->eq($fin)) {
            $key = $inicio->format('Y-m');
            if (in_array($key, $clavesPeriodos)) {
                $distribucion[$key] = [
                    'monto'      => $parcial,
                    'porcentaje' => 100,
                ];
            }
            return $distribucion;
        }

        // Calcular días totales naturales de la tarea
        $totalDias = $inicio->diffInDays($fin) + 1; // +1 para incluir ambos extremos

        // Contar días por mes
        $diasPorMes = [];
        $cursor = $inicio->copy();
        while ($cursor->lte($fin)) {
            $key = $cursor->format('Y-m');
            $diasPorMes[$key] = ($diasPorMes[$key] ?? 0) + 1;
            $cursor->addDay();
        }

        // Asignar montos proporcionales a los días de cada mes
        foreach ($diasPorMes as $key => $dias) {
            if (!in_array($key, $clavesPeriodos)) continue;
            $monto = ($parcial * $dias) / $totalDias;
            $distribucion[$key] = [
                'monto'      => round($monto, 2),
                'porcentaje' => round(($monto / $parcial) * 100, 4),
            ];
        }

        return $distribucion;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVADOS (resumen, etc.)
    // ─────────────────────────────────────────────────────────────────────────
    private function calcularResumen(array $items, array $periodos, float $totalPresupuesto): array
    {
        if (empty($periodos) || $totalPresupuesto == 0) {
            return $this->resumenVacio();
        }

        $acumuladoMensual = [];
        $acum = 0;
        foreach ($periodos as $p) {
            $montoMes = array_sum(array_map(fn($i) => $i['distribucion'][$p['key']]['monto'] ?? 0, $items));
            $acum += $montoMes;
            $acumuladoMensual[$p['key']] = ['mensual' => $montoMes, 'acumulado' => $acum];
        }

        $mesPicoKey = '';
        $mesPicoMonto = 0;
        foreach ($acumuladoMensual as $key => $v) {
            if ($v['mensual'] > $mesPicoMonto) {
                $mesPicoMonto = $v['mensual'];
                $mesPicoKey = $key;
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