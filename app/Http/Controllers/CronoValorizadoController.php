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
        // Filtramos por project_id (costo_projects.id)
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
        // presupuesto_general.presupuesto_id = presupuestos.id (no costo_projects.id)
        // Necesitamos encontrar el presupuesto_id correcto para este project.
        // La relación: costo_projects.id → presupuestos.id via presupuesto_general.presupuesto_id
        // Detectamos el presupuesto_id leyendo cronograma_general.presupuesto_id de las filas
        $presupuestoIdFromCrono = $filas->first()?->presupuesto_id ?? null;

        $presupuesto = collect();
        if ($presupuestoIdFromCrono) {
            $presupuesto = DB::connection('mysql')
                ->table("{$db}.presupuesto_general")
                ->where('presupuesto_id', $presupuestoIdFromCrono)
                ->whereNull('deleted_at')
                ->orderBy('item_order')
                ->get()
                ->keyBy(fn($p) => trim($p->partida ?? ''));
        }

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
            'metrado'     => 0.0,
            'precio'      => 0.0,
            'updated_at'  => $f->updated_at ?? now(),
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
        // cronograma_valorizado.presupuesto_id = costo_projects.id (project_id)
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

        // 🔥 ENRIQUECER CON DATOS DE PRESUPUESTO (METRADOS, PRECIOS, UNIDADES)
        $allItems = $this->enriquecerConPresupuesto($allItems, $presupuesto);

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
        $request->validate([
            'project_id' => 'required|integer',
            'items'      => 'required|array',
        ]);

        $projectId    = (int) $request->input('project_id');
        $items        = $request->input('items');
        $costoProject = CostoProject::findOrFail($projectId);
        $db           = $costoProject->database_name;

        // obtener el presupuesto_id desde cronograma_general para este project_id
        $cronoGeneral = DB::connection('mysql')
            ->table("{$db}.cronograma_general")
            ->where('project_id', $projectId)
            ->first();

        // si no se encuentra, se va usar el id 2 (que existe en presupuestos)
        $presupuestoId = $cronoGeneral ? ($cronoGeneral->presupuesto_id ?? 2) : 2;

        // 🔥 SINCRONIZACIÓN BIDIRECCIONAL: Obtener costos actuales para comparar
        $costosActualesGeneral = DB::connection('mysql')
            ->table("{$db}.cronograma_general")
            ->where('project_id', $projectId)
            ->get(['partida', 'costo', 'updated_at'])
            ->keyBy('partida');

        $costosActualesPresupuesto = DB::connection('mysql')
            ->table("{$db}.presupuesto_general")
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->get(['partida', 'parcial', 'updated_at'])
            ->keyBy('partida');

        DB::connection('mysql')->transaction(function () use ($db, $presupuestoId, $items, $projectId, $costosActualesGeneral, $costosActualesPresupuesto) {
            
            // 🔥 PASO 1: Sincronizar costos bidireccionalmente antes de guardar valorizado
            foreach ($items as $item) {
                $partida = $item['item'];
                $costoNuevo = (float) ($item['parcial'] ?? 0);
                
                $costoGeneral = $costosActualesGeneral->get($partida);
                $costoPresupuesto = $costosActualesPresupuesto->get($partida);
                
                if ($costoGeneral && $costoPresupuesto) {
                    $this->sincronizarCostoPartida(
                        $db,
                        $presupuestoId,
                        $projectId,
                        $partida,
                        (float) $costoGeneral->costo,
                        (float) $costoPresupuesto->parcial,
                        $costoGeneral->updated_at,
                        $costoPresupuesto->updated_at
                    );
                }
            }
            
            // 🔥 PASO 2: Recalcular distribuciones con los costos sincronizados
            $items = $this->recalcularDistribuciones($items, $projectId, $db);
            
            // Borrar los existentes para este presupuesto
            DB::connection('mysql')
                ->table("{$db}.cronograma_valorizado")
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $rows = [];
            foreach ($items as $idx => $item) {
                // Calcular total_monto = suma de todos los montos mensuales
                $distribucion = $item['distribucion'] ?? [];
                $totalMonto   = 0.0;
                foreach ($distribucion as $mes) {
                    $totalMonto += (float) ($mes['monto'] ?? 0);
                }

                $rows[] = [
                    'presupuesto_id'       => $presupuestoId,   // costo_projects.id (no FK a presupuestos)
                    'item_order'           => $idx + 1,
                    'partida'              => $item['item'],
                    'descripcion'          => $item['descripcion'],
                    'presupuesto_total'    => $item['parcial'],
                    'distribucion_mensual' => json_encode($distribucion),
                    'parent_id'            => $item['parent_id'] ?? null,
                    'nivel'                => substr_count($item['item'] ?? '', '.'),
                    'created_at'           => now(),
                    'updated_at'           => now(),
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
     */
    private function generarPeriodos30Dias(string $startDate, string $endDate): array
    {
        $periodos = [];
        $mesNum   = 1;
        $cursor   = Carbon::parse($startDate);
        $fin      = Carbon::parse($endDate);

        while ($cursor->lte($fin)) {
            $finBloque = $cursor->copy()->addDays(29);
            $periodos[] = [
                'label'    => "PER {$mesNum}",
                'labelCal' => $cursor->format('d/m') . '–' . $finBloque->format('d/m/Y'),
                'key'      => $cursor->format('Y-m-d'),
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
     * REGLA DE EJECUCIÓN (Prorrateo MS Project / Delfín):
     * Distribuye proporcional a días reales por mes calendario.
     * Precisión Delfín: último mes absorbe el residuo de céntimos.
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

        // Contar días por mes calendario
        $diasPorMes = [];
        $cursor     = $inicio->copy();
        while ($cursor->lte($fin)) {
            $key = $cursor->format('Y-m');
            $diasPorMes[$key] = ($diasPorMes[$key] ?? 0) + 1;
            $cursor->addDay();
        }

        $totalDias    = array_sum($diasPorMes);
        if ($totalDias === 0) return $distribucion;

        $sumaAsignada = 0.0;
        $ultimaKey    = null;

        foreach ($diasPorMes as $key => $dias) {
            if (!isset($distribucion[$key])) continue;
            $monto = round($parcial * $dias / $totalDias, 2);
            $distribucion[$key]['monto']      = $monto;
            $distribucion[$key]['porcentaje'] = round(($dias / $totalDias) * 100, 6);
            $sumaAsignada += $monto;
            $ultimaKey     = $key;
        }

        // ── Precisión Delfín ──
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
     * REGLA DE INICIALIZACIÓN (Bloques de 30 días):
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

        $diasPorPeriodo = [];
        foreach ($periodos as $p) {
            $pInicio = Carbon::parse($p['key']);
            $pFin    = $pInicio->copy()->addDays(29);

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
            $monto = round($parcial * $dias / $totalDias, 2);
            $distribucion[$key]['monto']      = $monto;
            $distribucion[$key]['porcentaje'] = round(($dias / $totalDias) * 100, 6);
            $sumaAsignada += $monto;
            $ultimaKey     = $key;
        }

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
     * Fachada que elige la estrategia según el modo.
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

        $leafData         = [];
        $totalPresupuesto = 0.0;

        foreach ($leafTasks as $id => $task) {
            $parcial = (float) ($task['cost'] ?? 0);
            $valRow  = $valorizadoGuardado->get($task['item']);

            if ($valRow) {
                $distribucion = json_decode($valRow->distribucion_mensual, true) ?? [];
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
                'metrado'     => 0.0,
                'precio'      => 0.0,
                'parcial'     => $parcial,
                'is_leaf'     => $isLeaf,
                'distribucion'=> $distribucion,
                'parent_id'   => $parentId,
                'start_date'  => $task['start_date'] ?? null,
                'end_date'    => $task['end_date']   ?? null,
            ];
        }

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

        foreach ($itemsMap as &$item) {
            if (!$item['is_leaf']) {
                foreach ($clavesPeriodos as $key) {
                    $item['distribucion'][$key]['porcentaje'] = $item['parcial'] > 0
                        ? round(($item['distribucion'][$key]['monto'] / $item['parcial']) * 100, 6)
                        : 0.0;
                }
            }
        }

        $allItems = [];
        foreach ($sortedTasks as $row) {
            $id = (string) $row->gantt_id;
            if (isset($itemsMap[$id])) {
                $allItems[] = $itemsMap[$id];
            }
        }

        return [$allItems, $totalPresupuesto];
    }

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

            $pItem   = $presupuesto->get($partida);
            
            // 🔥 REGLA BIDIRECCIONAL: El último en editar define el costo
            $costoGeneral = (float) ($task['cost'] ?? 0);
            $costoPresupuesto = $pItem ? (float) ($pItem->parcial ?? 0) : 0;
            
            $fechaGeneral = $task['updated_at'] ?? $row->updated_at ?? '1970-01-01';
            $fechaPresupuesto = $pItem->updated_at ?? '1970-01-01';
            
            $fechaGeneralCarbon = Carbon::parse($fechaGeneral);
            $fechaPresupuestoCarbon = Carbon::parse($fechaPresupuesto);
            
            if ($fechaGeneralCarbon->gt($fechaPresupuestoCarbon)) {
                $parcial = $costoGeneral;  // Gana el general
            } else {
                $parcial = $costoPresupuesto;  // Gana el presupuesto
            }
            
            $isLeaf  = $pItem ? (bool) ($pItem->is_leaf ?? true) : false;

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
                'und'         => $pItem ? ($pItem->unidad ?? '') : ($task['unidad'] ?? ''),
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

    private function calcularResumen(array $items, array $periodos, float $totalPresupuesto): array
    {
        if (empty($periodos) || $totalPresupuesto <= 0) {
            return $this->resumenVacio();
        }

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

    // =========================================================================
    // ENRIQUECER CON DATOS DE PRESUPUESTO GENERAL
    // =========================================================================

    /**
     * Sobreescribe metrado, precio_unitario y unidad desde presupuesto_general.
     * Estos datos son la fuente de verdad para el presupuesto.
     */
    private function enriquecerConPresupuesto($items, $presupuesto)
    {
        if ($presupuesto->isEmpty()) return $items;

        $presupuestoMap = [];
        foreach ($presupuesto as $pItem) {
            $partida = trim($pItem->partida ?? '');
            if ($partida !== '') {
                $presupuestoMap[$partida] = $pItem;
            }
        }

        foreach ($items as &$item) {
            $partida         = trim($item['item'] ?? '');
            $presupuestoData = $presupuestoMap[$partida] ?? null;

            if ($presupuestoData) {
                $item['metrado'] = (float) ($presupuestoData->metrado ?? 0);
                $item['precio']  = (float) ($presupuestoData->precio_unitario ?? 0);
                $item['und']     = $presupuestoData->unidad ?? $item['und'] ?? '';

                if (!empty($presupuestoData->descripcion)) {
                    $item['descripcion'] = $presupuestoData->descripcion;
                }

                // Recalcular parcial si viene vacío
                if ($item['parcial'] == 0 && $item['metrado'] > 0 && $item['precio'] > 0) {
                    $item['parcial'] = round($item['metrado'] * $item['precio'], 2);
                }
            }
        }

        return $items;
    }

    // =========================================================================
    // 🔥 NUEVOS MÉTODOS PARA SINCRONIZACIÓN BIDIRECCIONAL
    // =========================================================================

    /**
     * 🔄 Sincronización bidireccional entre presupuesto_general y cronograma_general
     * 
     * Principio: El último en editar (comparando updated_at) es la fuente de verdad.
     * Si cronograma_general.costo cambió, actualizamos presupuesto_general.precio_unitario
     * Si presupuesto_general.parcial cambió, actualizamos cronograma_general.costo
     */
    private function sincronizarCostoPartida(
        string $db,
        int $presupuestoId,
        int $projectId,
        string $partida,
        float $costoGeneral,
        float $costoPresupuesto,
        string $fechaGeneralUpdated,
        string $fechaPresupuestoUpdated
    ): void {
        $fechaGeneral = Carbon::parse($fechaGeneralUpdated);
        $fechaPresupuesto = Carbon::parse($fechaPresupuestoUpdated);
        
        // Comparar quién fue el último en editar (con tolerancia de 1 segundo)
        if ($fechaGeneral->gt($fechaPresupuesto)) {
            // El usuario editó cronograma_general.costo → actualizamos presupuesto_general
            $presupuestoRow = DB::connection('mysql')
                ->table("{$db}.presupuesto_general")
                ->where('presupuesto_id', $presupuestoId)
                ->where('partida', $partida)
                ->whereNull('deleted_at')
                ->first();
            
            if ($presupuestoRow && $presupuestoRow->metrado > 0) {
                $nuevoPrecio = $costoGeneral / $presupuestoRow->metrado;
                DB::connection('mysql')
                    ->table("{$db}.presupuesto_general")
                    ->where('id', $presupuestoRow->id)
                    ->update([
                        'precio_unitario' => round($nuevoPrecio, 4),
                        'parcial' => $costoGeneral,
                        'updated_at' => now(),
                    ]);
            }
        } 
        elseif ($fechaPresupuesto->gt($fechaGeneral)) {
            // El usuario editó presupuesto_general → actualizamos cronograma_general.costo
            DB::connection('mysql')
                ->table("{$db}.cronograma_general")
                ->where('project_id', $projectId)
                ->where('partida', $partida)
                ->update([
                    'costo' => $costoPresupuesto,
                    'updated_at' => now(),
                ]);
        }
        // Si son iguales o diferencia menor a 1 segundo, no hacer nada (están sincronizados)
    }

    /**
     * 🔥 Recalcula la distribución mensual de todas las partidas
     * usando las fechas desde cronograma_general y los costos actualizados
     */
    private function recalcularDistribuciones(array $items, int $projectId, string $db): array
    {
        // Obtener las fechas de inicio/fin desde cronograma_general
        $tareas = DB::connection('mysql')
            ->table("{$db}.cronograma_general")
            ->where('project_id', $projectId)
            ->get()
            ->keyBy('partida');
        
        // Generar periodos nuevamente para tener las claves correctas
        $fechas = $tareas->filter(fn($t) => !empty($t->fecha_inicio) && !empty($t->fecha_fin));
        $minFecha = $fechas->min(fn($t) => $t->fecha_inicio);
        $maxFecha = $fechas->max(fn($t) => $t->fecha_fin);
        
        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth() : $inicio->copy()->addMonths(5);
        
        $periodos = $this->generarPeriodosCalendario($inicio, $fin);
        $clavesPeriodos = array_column($periodos, 'key');
        
        foreach ($items as &$item) {
            $partida = $item['item'];
            $tarea = $tareas->get($partida);
            
            if ($tarea && !empty($tarea->fecha_inicio) && !empty($tarea->fecha_fin)) {
                $costoReal = (float) ($item['parcial'] ?? 0);
                
                if ($costoReal > 0) {
                    // Recalcular distribución con el costo actualizado
                    $nuevaDistribucion = $this->distribuirPorDiasCalendario(
                        $costoReal,
                        $tarea->fecha_inicio,
                        $tarea->fecha_fin,
                        $clavesPeriodos
                    );
                    
                    // Preservar la estructura original de distribución
                    foreach ($clavesPeriodos as $key) {
                        if (isset($nuevaDistribucion[$key])) {
                            $item['distribucion'][$key] = $nuevaDistribucion[$key];
                        }
                    }
                }
            }
        }
        
        return $items;
    }
}