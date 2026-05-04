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
    // CONSTANTES de modo de cálculo
    // ─────────────────────────────────────────────────────────────────────────
    const MODO_CALENDARIO = 'calendario'; // Corte último día de mes (Regla de Ejecución)
    const MODO_30_DIAS    = '30dias';     // Bloques exactos de 30 días (Regla de Inicialización)

    // ─────────────────────────────────────────────────────────────────────────
    // INDEX — Cruza Gantt + presupuesto_general para calcular el valorizado
    // ─────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $projectId   = (int) $request->query('project');
        $modoCalculo = $request->query('modo', self::MODO_CALENDARIO);

        if (!$projectId) abort(404, 'ID de proyecto no recibido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db           = $costoProject->database_name;

        // ── 1. Leer tareas desde cronograma_general ──────────────────────────
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
                'diasPorMes'       => [],
                'modoCalculo'      => $modoCalculo,
            ]);
        }

        // ── 2. Leer presupuesto_general ──────────────────────────────────────
        $presupuesto = DB::connection('mysql')
            ->table("{$db}.presupuesto_general")
            ->where('presupuesto_id', $projectId)
            ->whereNull('deleted_at')
            ->orderBy('item_order')
            ->get()
            ->keyBy(fn($p) => trim($p->partida ?? ''));

        $usarCronoFuente = $presupuesto->isEmpty();

        // ── 3. Mapear tareas desde Gantt ─────────────────────────────────────
        $tasks = $filas->map(fn($f) => [
            'id'          => (string) $f->gantt_id,
            'item'        => $f->partida,
            'parent'      => $f->parent_id ? (string) $f->parent_id : '0',
            'start_date'  => $f->fecha_inicio,
            'end_date'    => $f->fecha_fin,
            'cost'        => (float) ($f->costo ?? 0),
            'descripcion' => $f->descripcion ?? '',
            'unidad'      => $f->unidad ?? '',
            'metrado'     => (float) ($f->metrado ?? 0),
            'precio'      => (float) ($f->precio_unitario ?? 0),
        ])->keyBy('id');

        // ── 4. Determinar períodos (min fecha / max fecha) ───────────────────
        $fechas   = $tasks->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));
        $minFecha = $fechas->min(fn($t) => $t['start_date']);
        $maxFecha = $fechas->max(fn($t) => $t['end_date']);

        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin    = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth()   : $inicio->copy()->addMonths(5);

        // Generar periodos según el modo de cálculo
        $periodos = $modoCalculo === self::MODO_30_DIAS
            ? $this->generarPeriodos30Dias($minFecha ?? now()->toDateString(), $maxFecha ?? now()->addMonths(5)->toDateString())
            : $this->generarPeriodosCalendario($inicio, $fin);

        $clavesPeriodos = array_column($periodos, 'key');

        // ── 4b. Días naturales del proyecto por mes (para el frontend) ───────
        $diasPorMesProyecto = $this->calcularDiasPorMes(
            $minFecha ?? now()->toDateString(),
            $maxFecha ?? now()->addMonths(5)->toDateString(),
            $clavesPeriodos
        );

        // ── 5. Leer valorizado guardado ──────────────────────────────────────
        $valorizadoGuardado = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $projectId)
            ->get()
            ->keyBy(fn($v) => trim($v->partida ?? ''));

        $estaGuardado = $valorizadoGuardado->isNotEmpty();

        // ── 6. Construir árbol de items ──────────────────────────────────────
        $allItems         = [];
        $totalPresupuesto = 0;

        if ($usarCronoFuente) {
            [$allItems, $totalPresupuesto] = $this->construirArbolDesdeCrono(
                $filas, $tasks, $valorizadoGuardado,
                $clavesPeriodos, $periodos, $modoCalculo
            );
        } else {
            [$allItems, $totalPresupuesto] = $this->construirArbolDesdePresupuesto(
                $filas, $tasks, $presupuesto, $valorizadoGuardado,
                $clavesPeriodos, $periodos, $modoCalculo
            );
        }

        // ── 7. Resumen ───────────────────────────────────────────────────────
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
            'diasPorMes'       => $diasPorMesProyecto,
            'modoCalculo'      => $modoCalculo,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STORE — Guarda el valorizado en cronograma_valorizado
    // ─────────────────────────────────────────────────────────────────────────
    public function store(Request $request)
{
    try {
        $projectId = (int) $request->input('project_id');
        $items = $request->input('items');

        if (!$projectId || empty($items)) {
            return response()->json(['message' => 'Datos insuficientes'], 400);
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        DB::connection('mysql')->transaction(function () use ($db, $projectId, $items) {
            // 1. Limpiar registros anteriores
            DB::connection('mysql')
                ->table("{$db}.cronograma_valorizado")
                ->where('presupuesto_id', $projectId)
                ->delete();

            $rows = [];
            $now = now();

            foreach ($items as $idx => $item) {
                // Aseguramos que la distribución sea un JSON válido o un objeto vacío
                $distribucion = isset($item['distribucion']) ? json_encode($item['distribucion']) : '{}';

                $rows[] = [
                    'presupuesto_id'       => $projectId,
                    'item_order'           => $idx + 1,
                    'partida'              => $item['item'] ?? '',
                    'descripcion'          => $item['descripcion'] ?? '',
                    'presupuesto_total'    => (float) ($item['parcial'] ?? 0),
                    'distribucion_mensual' => $distribucion,
                    'parent_id'            => $item['parent_id'] ?? null,
                    'nivel'                => isset($item['item']) ? substr_count($item['item'], '.') : 0,
                    'created_at'           => $now,
                    'updated_at'           => $now,
                ];
            }

            // 2. Insertar en trozos más pequeños (100) para evitar errores de buffer
            foreach (array_chunk($rows, 100) as $chunk) {
                DB::connection('mysql')
                    ->table("{$db}.cronograma_valorizado")
                    ->insert($chunk);
            }
        });

        return response()->json([
            'status'  => 'success',
            'message' => '¡Cronograma Valorizado guardado correctamente!',
        ]);

    } catch (\Exception $e) {
        // Esto devolverá un mensaje corto que sí podremos leer en el toast
        return response()->json([
            'status'  => 'error',
            'message' => 'Error en BD: ' . $e->getMessage()
        ], 500);
    }
}
    // ─────────────────────────────────────────────────────────────────────────
    // DESTROY — Elimina el valorizado guardado
    // ─────────────────────────────────────────────────────────────────────────
    public function destroy(Request $request)
    {
        $projectId = (int) ($request->query('project') ?? $request->input('project'));
        if (!$projectId) abort(422, 'Project ID requerido');

        $costoProject = CostoProject::findOrFail($projectId);
        $db           = $costoProject->database_name;

        $deleted = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $projectId)
            ->delete();

        return response()->json([
            'status'  => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma valorizado.",
        ]);
    }

    // =========================================================================
    // GENERADORES DE PERÍODOS
    // =========================================================================

    /**
     * REGLA DE EJECUCIÓN: Cortes al último día de cada mes calendario.
     * Ejemplo: Tarea 25/04 → Mes1 = [25/04..30/04], Mes2 = [01/05..31/05]
     */
    private function generarPeriodosCalendario(Carbon $inicio, Carbon $fin): array
    {
        $periodos = [];
        $mesNum   = 1;
        $cursor   = $inicio->copy()->startOfMonth();

        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label'    => "MES {$mesNum}",
                'labelCal' => ucfirst($cursor->translatedFormat('M Y')),
                'key'      => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
            $mesNum++;
        }

        return $periodos;
    }

    /**
     * REGLA DE INICIALIZACIÓN: Bloques exactos de 30 días.
     * Ejemplo: Inicio 25/04 → Período1 = [25/04..24/05], Período2 = [25/05..23/06]
     * Clave = fecha de inicio del bloque (YYYY-MM-DD) para evitar colisiones.
     */
    private function generarPeriodos30Dias(string $startDate, string $endDate): array
    {
        $periodos = [];
        $mesNum   = 1;
        $cursor   = Carbon::parse($startDate);
        $fin      = Carbon::parse($endDate);

        while ($cursor->lte($fin)) {
            $finBloque = $cursor->copy()->addDays(29); // 30 días inclusive
            $periodos[] = [
                'label'    => "PER {$mesNum}",
                'labelCal' => $cursor->format('d/m') . '–' . $finBloque->format('d/m/Y'),
                'key'      => $cursor->format('Y-m-d'), // clave única por bloque
            ];
            $cursor->addDays(30);
            $mesNum++;
        }

        return $periodos;
    }
    

    // =========================================================================
    // DISTRIBUCIÓN DE COSTOS
    // =========================================================================

    /**
     * REGLA DE EJECUCIÓN (Prorrateo MS Project):
     * Distribuye el parcial proporcional a los días reales que la tarea
     * tiene en cada mes calendario. El ÚLTIMO mes absorbe el residuo de
     * céntimos para garantizar suma exacta = parcial (Precisión Delfín).
     */
    private function distribuirPorDiasCalendario(
        float  $parcial,
        string $startDate,
        string $endDate,
        array  $clavesPeriodos
    ): array {
        $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);

        if ($parcial <= 0) return $distribucion;

        $inicio = Carbon::parse($startDate);
        $fin    = Carbon::parse($endDate);

        // Tarea de un solo día
        if ($inicio->eq($fin)) {
            $key = $inicio->format('Y-m');
            if (isset($distribucion[$key])) {
                $distribucion[$key] = ['monto' => $parcial, 'porcentaje' => 100.0];
            }
            return $distribucion;
        }

        // Contar días por mes (corte = último día del mes calendario)
        $diasPorMes = [];
        $cursor     = $inicio->copy();
        while ($cursor->lte($fin)) {
            $key = $cursor->format('Y-m');
            $diasPorMes[$key] = ($diasPorMes[$key] ?? 0) + 1;
            $cursor->addDay();
        }

        $totalDias    = array_sum($diasPorMes);
        if ($totalDias === 0) return $distribucion;

        // Asignar montos con truncado (no round) para acumular residuo
        $sumaAsignada = 0.0;
        $ultimaKey    = null;

        foreach ($diasPorMes as $key => $dias) {
            if (!isset($distribucion[$key])) continue;

            $monto = floor(($parcial * $dias / $totalDias) * 100) / 100; // truncar a 2 decimales
            $distribucion[$key]['monto']      = $monto;
            $distribucion[$key]['porcentaje'] = round(($dias / $totalDias) * 100, 6);
            $sumaAsignada += $monto;
            $ultimaKey     = $key;
        }

        // ── Precisión Delfín: el último mes absorbe el residuo de céntimos ──
        if ($ultimaKey !== null) {
            $residuo = round($parcial - $sumaAsignada, 2);
            $distribucion[$ultimaKey]['monto'] = round($distribucion[$ultimaKey]['monto'] + $residuo, 2);
            // Recalcular porcentaje del último mes
            if ($parcial > 0) {
                $distribucion[$ultimaKey]['porcentaje'] = round(
                    ($distribucion[$ultimaKey]['monto'] / $parcial) * 100, 6
                );
            }
        }

        return $distribucion;
    }

    /**
     * REGLA DE INICIALIZACIÓN (Bloques de 30 días):
     * Distribuye el parcial proporcional a los días reales en cada bloque
     * de 30 días. También aplica Precisión Delfín en el último bloque.
     */
    private function distribuirPorDias30(
        float  $parcial,
        string $startDate,
        string $endDate,
        array  $periodos
    ): array {
        $claves       = array_column($periodos, 'key');
        $distribucion = array_fill_keys($claves, ['monto' => 0.0, 'porcentaje' => 0.0]);

        if ($parcial <= 0) return $distribucion;

        $inicio = Carbon::parse($startDate);
        $fin    = Carbon::parse($endDate);

        // Calcular intersección días-tarea vs días-período
        $diasPorPeriodo = [];
        foreach ($periodos as $p) {
            $pInicio = Carbon::parse($p['key']);                   // inicio del bloque
            $pFin    = $pInicio->copy()->addDays(29);              // fin del bloque (30 días)

            // Intersección
            $solape_inicio = $inicio->gt($pInicio) ? $inicio : $pInicio;
            $solape_fin    = $fin->lt($pFin)       ? $fin    : $pFin;

            if ($solape_inicio->lte($solape_fin)) {
                $diasPorPeriodo[$p['key']] = $solape_inicio->diffInDays($solape_fin) + 1;
            }
        }

        $totalDias    = array_sum($diasPorPeriodo);
        if ($totalDias === 0) return $distribucion;

        $sumaAsignada = 0.0;
        $ultimaKey    = null;

        foreach ($diasPorPeriodo as $key => $dias) {
            $monto = floor(($parcial * $dias / $totalDias) * 100) / 100;
            $distribucion[$key]['monto']      = $monto;
            $distribucion[$key]['porcentaje'] = round(($dias / $totalDias) * 100, 6);
            $sumaAsignada += $monto;
            $ultimaKey     = $key;
        }

        // Precisión Delfín
        if ($ultimaKey !== null) {
            $residuo = round($parcial - $sumaAsignada, 2);
            $distribucion[$ultimaKey]['monto'] = round($distribucion[$ultimaKey]['monto'] + $residuo, 2);
            if ($parcial > 0) {
                $distribucion[$ultimaKey]['porcentaje'] = round(
                    ($distribucion[$ultimaKey]['monto'] / $parcial) * 100, 6
                );
            }
        }

        return $distribucion;
    }

    /**
     * Fachada que elige la estrategia de distribución según el modo.
     */
    private function distribuir(
        float  $parcial,
        string $startDate,
        string $endDate,
        array  $clavesPeriodos,
        array  $periodos,
        string $modo
    ): array {
        if ($modo === self::MODO_30_DIAS) {
            return $this->distribuirPorDias30($parcial, $startDate, $endDate, $periodos);
        }
        return $this->distribuirPorDiasCalendario($parcial, $startDate, $endDate, $clavesPeriodos);
    }

    // =========================================================================
    // CONSTRUCCIÓN DEL ÁRBOL DE ÍTEMS
    // =========================================================================

    /**
     * Árbol desde cronograma_general (sin presupuesto_general)
     */
    private function construirArbolDesdeCrono(
        $filas,
        $tasks,
        $valorizadoGuardado,
        array $clavesPeriodos,
        array $periodos,
        string $modo
    ): array {
        $parentIds  = $tasks->pluck('parent')->filter(fn($p) => $p !== '0')->unique()->values()->toArray();
        $leafTasks  = $tasks->filter(fn($t) => !in_array($t['id'], $parentIds));

        // ── Calcular distribución de hojas ───────────────────────────────────
        $leafData         = [];
        $totalPresupuesto = 0.0;

        foreach ($leafTasks as $id => $task) {
            $parcial = (float) ($task['cost'] ?? 0);
            $valRow  = $valorizadoGuardado->get($task['item']);

            if ($valRow) {
                $distribucion = json_decode($valRow->distribucion_mensual, true) ?? [];
                // Normalizar claves faltantes
                foreach ($clavesPeriodos as $key) {
                    if (!isset($distribucion[$key])) {
                        $distribucion[$key] = ['monto' => 0.0, 'porcentaje' => 0.0];
                    }
                }
            } elseif (!empty($task['start_date']) && !empty($task['end_date']) && $parcial > 0) {
                $distribucion = $this->distribuir(
                    $parcial, $task['start_date'], $task['end_date'],
                    $clavesPeriodos, $periodos, $modo
                );
            } else {
                $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);
            }

            $leafData[$id] = [
                'parcial'      => $parcial,
                'distribucion' => $distribucion,
            ];
            $totalPresupuesto += $parcial;
        }

        // ── Construir mapa de todos los ítems ────────────────────────────────
        $sortedTasks = $filas->sortBy('item_order');
        $itemsMap    = [];

        foreach ($sortedTasks as $row) {
            $id       = (string) $row->gantt_id;
            $parentId = $row->parent_id ? (string) $row->parent_id : '0';

            if (isset($leafData[$id])) {
                $parcial      = $leafData[$id]['parcial'];
                $distribucion = $leafData[$id]['distribucion'];
                $isLeaf       = true;
            } else {
                $parcial      = 0.0;
                $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);
                $isLeaf       = false;
            }

            $task = $tasks->get($id) ?? [];

            $itemsMap[$id] = [
                'id'          => $id,
                'item'        => $row->partida,
                'descripcion' => $row->descripcion,
                'und'         => $row->unidad ?? '',
                'metrado'     => (float) ($task['metrado'] ?? 0),
                'precio'      => (float) ($task['precio'] ?? 0),
                'parcial'     => $parcial,
                'is_leaf'     => $isLeaf,
                'distribucion'=> $distribucion,
                'parent_id'   => $parentId,
                'start_date'  => $task['start_date'] ?? null, // 🆕 Para bloquear celdas
                'end_date'    => $task['end_date']   ?? null, // 🆕 Para bloquear celdas
            ];
        }

        // ── Acumular de hojas → padres (bottom-up) ───────────────────────────
        $reversed = array_reverse($itemsMap, true);
        foreach ($reversed as $id => $item) {
            $parentId = $item['parent_id'];
            if ($parentId !== '0' && isset($itemsMap[$parentId])) {
                $itemsMap[$parentId]['parcial'] += $item['parcial'];
                foreach ($clavesPeriodos as $key) {
                    $itemsMap[$parentId]['distribucion'][$key]['monto'] +=
                        $item['distribucion'][$key]['monto'] ?? 0;
                }
            }
        }

        // ── Recalcular porcentajes de padres ─────────────────────────────────
        foreach ($itemsMap as &$item) {
            if (!$item['is_leaf']) {
                foreach ($clavesPeriodos as $key) {
                    $item['distribucion'][$key]['porcentaje'] = $item['parcial'] > 0
                        ? round(($item['distribucion'][$key]['monto'] / $item['parcial']) * 100, 6)
                        : 0.0;
                }
            }
        }

        // ── Orden final ──────────────────────────────────────────────────────
        $allItems = [];
        foreach ($sortedTasks as $row) {
            $id = (string) $row->gantt_id;
            if (isset($itemsMap[$id])) {
                $allItems[] = $itemsMap[$id];
            }
        }

        return [$allItems, $totalPresupuesto];
    }

    /**
     * Árbol desde presupuesto_general (con Gantt para fechas)
     */
    private function construirArbolDesdePresupuesto(
        $filas,
        $tasks,
        $presupuesto,
        $valorizadoGuardado,
        array $clavesPeriodos,
        array $periodos,
        string $modo
    ): array {
        $sortedFilas      = $filas->sortBy('item_order');
        $allItems         = [];
        $totalPresupuesto = 0.0;

        foreach ($sortedFilas as $row) {
            $id       = (string) $row->gantt_id;
            $partida  = trim($row->partida ?? '');
            $task     = $tasks->get($id) ?? [];

            // Buscar datos de presupuesto
            $pItem   = $presupuesto->get($partida);
            $parcial = $pItem ? (float) ($pItem->parcial ?? $pItem->costo_directo ?? 0) : (float) ($task['cost'] ?? 0);
            $isLeaf  = $pItem ? (bool) ($pItem->is_leaf ?? true) : false;

            // Distribución
            $valRow = $valorizadoGuardado->get($partida);
            if ($valRow) {
                $distribucion = json_decode($valRow->distribucion_mensual, true) ?? [];
                foreach ($clavesPeriodos as $key) {
                    if (!isset($distribucion[$key])) {
                        $distribucion[$key] = ['monto' => 0.0, 'porcentaje' => 0.0];
                    }
                }
            } elseif ($isLeaf && !empty($task['start_date']) && !empty($task['end_date']) && $parcial > 0) {
                $distribucion = $this->distribuir(
                    $parcial, $task['start_date'], $task['end_date'],
                    $clavesPeriodos, $periodos, $modo
                );
            } else {
                $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);
            }

            if ($isLeaf) {
                $totalPresupuesto += $parcial;
            }

            $allItems[] = [
                'id'          => $id,
                'item'        => $partida,
                'descripcion' => $row->descripcion ?? ($pItem->descripcion ?? ''),
                'und'         => $pItem ? ($pItem->und ?? '') : ($task['unidad'] ?? ''),
                'metrado'     => $pItem ? (float) ($pItem->metrado ?? 0) : 0.0,
                'precio'      => $pItem ? (float) ($pItem->precio_unitario ?? 0) : 0.0,
                'parcial'     => $parcial,
                'is_leaf'     => $isLeaf,
                'distribucion'=> $distribucion,
                'parent_id'   => $row->parent_id ? (string) $row->parent_id : '0',
                'start_date'  => $task['start_date'] ?? null,
                'end_date'    => $task['end_date']   ?? null,
            ];
        }

        return [$allItems, $totalPresupuesto];
    }

    // =========================================================================
    // HELPERS PRIVADOS
    // =========================================================================

    /**
     * Días naturales del proyecto por mes (para mostrar en el footer de la tabla)
     */
    private function calcularDiasPorMes(string $startDate, string $endDate, array $clavesPeriodos): array
    {
        $diasPorMes = array_fill_keys($clavesPeriodos, 0);
        $cursor     = Carbon::parse($startDate);
        $fin        = Carbon::parse($endDate);

        while ($cursor->lte($fin)) {
            $key = $cursor->format('Y-m');
            if (isset($diasPorMes[$key])) {
                $diasPorMes[$key]++;
            }
            $cursor->addDay();
        }

        return $diasPorMes;
    }

    /**
     * Resumen financiero — solo usa hojas (is_leaf = true) para evitar
     * doble conteo en el mes pico y en el total.
     */
    private function calcularResumen(array $items, array $periodos, float $totalPresupuesto): array
    {
        if (empty($periodos) || $totalPresupuesto <= 0) {
            return $this->resumenVacio();
        }

        // FIX: filtrar solo hojas para no duplicar montos en padres
        $hojas = array_filter($items, fn($i) => $i['is_leaf']);

        $acumuladoMensual = [];
        $acum             = 0.0;

        foreach ($periodos as $p) {
            $montoMes = array_sum(
                array_map(fn($i) => (float) ($i['distribucion'][$p['key']]['monto'] ?? 0), $hojas)
            );
            $acum += $montoMes;
            $acumuladoMensual[$p['key']] = ['mensual' => $montoMes, 'acumulado' => $acum];
        }

        $mesPicoKey   = '';
        $mesPicoLabel = null;
        $mesPicoMonto = 0.0;

        foreach ($periodos as $p) {
            $v = $acumuladoMensual[$p['key']];
            if ($v['mensual'] > $mesPicoMonto) {
                $mesPicoMonto = $v['mensual'];
                $mesPicoKey   = $p['key'];
                $mesPicoLabel = $p['labelCal'];
            }
        }

        return [
            'total_partidas'    => count($hojas),
            'presupuesto_total' => round($totalPresupuesto, 2),
            'duracion_meses'    => count($periodos),
            'mes_pico'          => $mesPicoLabel,
            'mes_pico_key'      => $mesPicoKey,
            'monto_mes_pico'    => round($mesPicoMonto, 2),
            'pct_mes_pico'      => $totalPresupuesto > 0
                ? round(($mesPicoMonto / $totalPresupuesto) * 100, 2)
                : 0.0,
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_partidas'    => 0,
            'presupuesto_total' => 0,
            'duracion_meses'    => 0,
            'mes_pico'          => null,
            'mes_pico_key'      => null,
            'monto_mes_pico'    => 0,
            'pct_mes_pico'      => 0,
        ];
    }
}