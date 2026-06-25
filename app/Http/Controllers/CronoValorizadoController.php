<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;

class CronoValorizadoController extends Controller
{
    private const MAX_PERIODOS = 30;

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTANTES de modo de cálculo
    // ─────────────────────────────────────────────────────────────────────────
    const MODO_CALENDARIO = 'calendario'; // Corte último día de mes (Regla de Ejecución)

    const MODO_30_DIAS = '30dias';     // Bloques exactos de 30 días (Regla de Inicialización)

    // ─────────────────────────────────────────────────────────────────────────
    // INDEX — Cruza Gantt + presupuesto_general para calcular el valorizado
    // ─────────────────────────────────────────────────────────────────────────
public function index(Request $request)
{
    $projectId = (int) $request->query('project');
    $modoCalculo = $request->query('modo', self::MODO_CALENDARIO);

    if (! $projectId) {
        abort(404, 'ID de proyecto no recibido');
    }

    $costoProject = CostoProject::findOrFail($projectId);
    app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);
    $presupuestoId = $this->resolvePresupuestoId();

    // ✅ projectData
    $projectData = [
        'nombre' => $costoProject->nombre ?? 'PROYECTO',
        'codigo_cui' => $costoProject->codigo_cui ?? '-',
        'codigo_local' => $costoProject->codigo_local ?? '-',
        'codigos_modulares' => $costoProject->codigos_modulares ?? '-',
        'unidad_ejecutora' => $costoProject->unidad_ejecutora ?? '-',
        'propietario' => $costoProject->unidad_ejecutora ?? '-',
        'modulo' => 'GENERAL',
        'plantilla_logo_izq' => $costoProject->plantilla_logo_izq 
            ? Storage::url($costoProject->plantilla_logo_izq) 
            : null,
        'plantilla_logo_der' => $costoProject->plantilla_logo_der 
            ? Storage::url($costoProject->plantilla_logo_der) 
            : null,
    ];

    // ✅ Variables por defecto
    $materialesFormateados = collect([]);
    $materialesResumen = [
        'total_materiales' => 0,
        'presupuesto_total' => 0,
        'duracion_meses' => 0,
        'total_partidas' => 0,
        'mes_pico' => null,
        'mes_pico_key' => null,
        'monto_mes_pico' => 0,
    ];
    
    $allItems = [];
    $periodos = [];
    $totalPresupuesto = 0;
    $resumen = $this->resumenVacio();
    $estaGuardado = false;
    $diasPorMesProyecto = [];

    // ── 1. Leer presupuesto_general (TODAS las partidas con metrado > 0) ──
    $presupuesto = DB::connection('costos_tenant')
        ->table('presupuesto_general')
        ->where('presupuesto_id', $presupuestoId)
        ->whereNull('deleted_at')
        ->where('metrado', '>', 0)
        ->orderBy('item_order')
        ->get()
        ->keyBy(fn ($p) => trim($p->partida ?? ''));

    // ✅ Si no hay partidas con metrado, mostrar mensaje
    if ($presupuesto->isEmpty()) {
        return Inertia::render('costos/cronogramas/valorizado/CronogramaValorizado', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'items' => [],
            'periodos' => [],
            'totalPresupuesto' => 0,
            'resumen' => $this->resumenVacio(),
            'sinGantt' => false,
            'estaGuardado' => false,
            'diasPorMes' => [],
            'modoCalculo' => $modoCalculo,
            'materiales' => [],
            'materialesResumen' => $materialesResumen,
            'projectData' => $projectData,
        ]);
    }

    // ── 2. Generar periodos basados en fechas del proyecto ──
    $inicio = $costoProject->fecha_inicio 
        ? Carbon::parse($costoProject->fecha_inicio)->startOfMonth() 
        : now()->startOfMonth();
    $fin = $costoProject->fecha_fin 
        ? Carbon::parse($costoProject->fecha_fin)->endOfMonth() 
        : $inicio->copy()->addMonths(5);

    $periodos = $modoCalculo === self::MODO_30_DIAS
        ? $this->generarPeriodos30Dias($inicio->toDateString(), $fin->toDateString())
        : $this->generarPeriodosCalendario($inicio, $fin);
    
    $this->validarLimitePeriodos($periodos);
    $clavesPeriodos = array_column($periodos, 'key');

    // ── 3. Días por mes ──
    $diasPorMesProyecto = $this->calcularDiasPorMes(
        $inicio->toDateString(),
        $fin->toDateString(),
        $clavesPeriodos
    );

    // ── 4. Leer valorizado guardado ──────────────────────────────────────
    $valorizadoGuardado = DB::connection('costos_tenant')
        ->table('cronograma_valorizado')
        ->where('presupuesto_id', $presupuestoId)
        ->get()
        ->keyBy(fn ($v) => trim($v->partida ?? ''));

    $estaGuardado = $valorizadoGuardado->isNotEmpty();

    // ── 5. Construir árbol de items desde presupuesto_general ──────────
    foreach ($presupuesto as $pItem) {
        $partida = trim($pItem->partida ?? '');
        $parcial = (float) ($pItem->parcial ?? 0);
        $metrado = (float) ($pItem->metrado ?? 0);
        $precio = (float) ($pItem->precio_unitario ?? 0);
        
        $isLeaf = true;
        
        // Distribución uniforme entre periodos
        $distribucion = [];
        $countPeriodos = count($periodos);
        foreach ($periodos as $periodo) {
            $key = $periodo['key'];
            $distribucion[$key] = [
                'monto' => $parcial > 0 ? round($parcial / $countPeriodos, 2) : 0,
                'porcentaje' => $parcial > 0 ? round((($parcial / $countPeriodos) / $parcial) * 100, 6) : 0,
            ];
        }
        
        $allItems[] = [
            'id' => (string) $pItem->id,
            'item' => $partida,
            'descripcion' => $pItem->descripcion ?? '',
            'und' => $pItem->unidad ?? '',
            'metrado' => $metrado,
            'precio' => $precio,
            'parcial' => $parcial,
            'is_leaf' => $isLeaf,
            'distribucion' => $distribucion,
            'parent_id' => '0',
            'start_date' => $costoProject->fecha_inicio,
            'end_date' => $costoProject->fecha_fin,
        ];
        
        $totalPresupuesto += $parcial;
    }

    $resumen = $this->calcularResumen($allItems, $periodos, $totalPresupuesto);

    // ── 6. Generar materiales desde ACUs ──────────────────────────────────
    try {
        $acus = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNotNull('materiales')
            ->where('materiales', '!=', 'null')
            ->where('materiales', '!=', '')
            ->get();

        $materialesConsolidados = [];
        $acumuladoMensual = [];
        $presupuestoTotalMateriales = 0;

        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = 0;
        }

        foreach ($acus as $acu) {
            $material = json_decode($acu->materiales, true);

            if (is_array($material) && !isset($material[0]) && !empty($material)) {
                $material = [$material];
            }
            if (!is_array($material) || empty($material)) continue;

            $partida = trim($acu->partida);
            $presupuestoItem = $presupuesto->get($partida);
            $metrado = $presupuestoItem ? (float)($presupuestoItem->metrado ?? 0) : 0;
            if ($metrado <= 0) continue;

            foreach ($material as $item) {
                $unidad      = $item['unidad'] ?? '';
                $cantidad    = (float)($item['cantidad'] ?? 0);
                $parcial     = (float)($item['parcial'] ?? 0);
                $precio      = $cantidad > 0 ? $parcial / $cantidad : 0;
                $descripcion = $item['descripcion'] ?? 'Sin descripción';
                $insumoId    = $item['insumo_id'] ?? $item['codigo'] ?? null;

                if ($cantidad <= 0 || $precio <= 0) continue;

                $cantidadTotal = $cantidad * $metrado;
                $costoTotal    = $cantidadTotal * $precio;
                if ($cantidadTotal <= 0) continue;

                $clave = $insumoId ? (string)$insumoId : ($descripcion . '|' . $unidad);

                if (!isset($materialesConsolidados[$clave])) {
                    $tipo = $this->determinarTipo($insumoId ? (string)$insumoId : $descripcion);

                    $distInicial = [];
                    foreach ($periodos as $periodo) {
                        $distInicial[$periodo['key']] = ['cantidad' => 0, 'monto' => 0];
                    }

                    $materialesConsolidados[$clave] = [
                        'descripcion'    => $descripcion,
                        'unidad'         => $unidad,
                        'tipo'           => $tipo,
                        'precio'         => round($precio, 2),
                        'cantidad_total' => 0,
                        'costo_total'    => 0,
                        'distribucion'   => $distInicial,
                    ];
                }

                $meses = count($periodos);
                $materialesConsolidados[$clave]['cantidad_total'] += $cantidadTotal;
                $materialesConsolidados[$clave]['costo_total']    += $costoTotal;

                foreach ($periodos as $periodo) {
                    $key = $periodo['key'];
                    $materialesConsolidados[$clave]['distribucion'][$key]['cantidad'] += 
                        round($cantidadTotal / $meses, 4);
                    $materialesConsolidados[$clave]['distribucion'][$key]['monto'] += 
                        round($costoTotal / $meses, 2);
                    $acumuladoMensual[$key] += $costoTotal / $meses;
                }

                $presupuestoTotalMateriales += $costoTotal;
            }
        }

        $materialesFormateados = collect(array_values($materialesConsolidados))
            ->map(function ($m) {
                $m['cantidad_total'] = round($m['cantidad_total'], 4);
                $m['costo_total']    = round($m['costo_total'], 2);
                return $m;
            });

        $totalMateriales = $materialesFormateados->count();

        $mesPicoKey = '';
        $mesPicoMonto = 0;
        foreach ($acumuladoMensual as $key => $monto) {
            if ($monto > $mesPicoMonto) {
                $mesPicoMonto = $monto;
                $mesPicoKey = $key;
            }
        }
        $mesPicoLabel = '';
        foreach ($periodos as $p) {
            if ($p['key'] === $mesPicoKey) {
                $mesPicoLabel = $p['labelCal'] ?? $p['label'];
                break;
            }
        }

        $materialesResumen = [
            'total_materiales' => $totalMateriales,
            'presupuesto_total' => round($presupuestoTotalMateriales, 2),
            'duracion_meses' => count($periodos),
            'total_partidas' => $totalMateriales,
            'mes_pico' => $mesPicoLabel,
            'mes_pico_key' => $mesPicoKey,
            'monto_mes_pico' => round($mesPicoMonto, 2),
        ];

    } catch (\Exception $e) {
        \Log::error('Error generando materiales desde ACU: ' . $e->getMessage());
        $materialesFormateados = collect([]);
        $materialesResumen = [
            'total_materiales' => 0,
            'presupuesto_total' => 0,
            'duracion_meses' => count($periodos ?? []),
            'total_partidas' => 0,
            'mes_pico' => null,
            'mes_pico_key' => null,
            'monto_mes_pico' => 0,
        ];
    }

    // ── 7. FINALMENTE el return ──────────────────────────────────────────
    return Inertia::render('costos/cronogramas/valorizado/CronogramaValorizado', [
        'project' => (string) $projectId,
        'projectName' => $costoProject->nombre,
        'items' => $allItems,
        'periodos' => $periodos,
        'totalPresupuesto' => $totalPresupuesto,
        'resumen' => $resumen,
        'sinGantt' => false,
        'estaGuardado' => $estaGuardado,
        'diasPorMes' => $diasPorMesProyecto,
        'modoCalculo' => $modoCalculo,
        'materiales' => $materialesFormateados->toArray(),
        'materialesResumen' => $materialesResumen,
        'projectData' => $projectData,
    ]);
}

    // ─────────────────────────────────────────────────────────────────────────
    // DESTROY — Elimina el valorizado guardado
    // ─────────────────────────────────────────────────────────────────────────
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
            ->table('cronograma_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma valorizado.",
        ]);
    }

    private function generarPeriodosDesdeFechas(?string $minFecha, ?string $maxFecha, string $modo): array
    {
        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth() : $inicio->copy()->addMonths(5);

        if ($modo === self::MODO_30_DIAS) {
            return $this->generarPeriodos30Dias(
                $minFecha ?? now()->toDateString(),
                $maxFecha ?? now()->addMonths(5)->toDateString()
            );
        }

        return $this->generarPeriodosCalendario($inicio, $fin);
    }

    private function generarPeriodosVigentes(int $presupuestoId, string $modo): array
    {
        $fechas = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNotNull('fecha_inicio')
            ->whereNotNull('fecha_fin')
            ->selectRaw('MIN(fecha_inicio) as min_fecha, MAX(fecha_fin) as max_fecha')
            ->first();

        return $this->generarPeriodosDesdeFechas($fechas?->min_fecha, $fechas?->max_fecha, $modo);
    }

    private function validarLimitePeriodos(array $periodos): void
    {
        if (count($periodos) > self::MAX_PERIODOS) {
            abort(422, 'El cronograma valorizado admite como máximo '.self::MAX_PERIODOS.' periodos.');
        }
    }

    private function normalizarDistribucionMensual(array $distribucion, array $periodos, float $parcial): array
    {
        $normalizada = [];

        foreach ($periodos as $periodo) {
            $key = $periodo['key'];
            $monto = round((float) ($distribucion[$key]['monto'] ?? 0), 2);

            $normalizada[$key] = [
                'monto' => $monto,
                'porcentaje' => $parcial > 0
                    ? round(($monto / $parcial) * 100, 6)
                    : 0.0,
            ];
        }

        return $normalizada;
    }

    // =========================================================================
    // GENERADORES DE PERÍODOS
    // =========================================================================

    /**
     * REGLA DE EJECUCIÓN: Cortes al último día de cada mes calendario.
     */
  private function generarPeriodosCalendario($inicio, $fin): array
{
    //  Convertir a Carbon si es CarbonImmutable
    if ($inicio instanceof \Carbon\CarbonImmutable) {
        $inicio = Carbon::createFromImmutable($inicio);
    }
    if ($fin instanceof \Carbon\CarbonImmutable) {
        $fin = Carbon::createFromImmutable($fin);
    }
    
    $periodos = [];
    $mesNum = 1;
    $cursor = $inicio->copy()->startOfMonth();

    while ($cursor->lte($fin)) {
        $periodos[] = [
            'label' => "MES {$mesNum}",
            'labelCal' => ucfirst($cursor->translatedFormat('M Y')),
            'key' => $cursor->format('Y-m'),
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
        $mesNum = 1;
        $cursor = Carbon::parse($startDate);
        $fin = Carbon::parse($endDate);

        while ($cursor->lte($fin)) {
            $finBloque = $cursor->copy()->addDays(29);
            $periodos[] = [
                'label' => "PER {$mesNum}",
                'labelCal' => $cursor->format('d/m').'–'.$finBloque->format('d/m/Y'),
                'key' => $cursor->format('Y-m-d'),
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
        float $parcial,
        string $startDate,
        string $endDate,
        array $clavesPeriodos
    ): array {
        $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);

        if ($parcial <= 0) {
            return $distribucion;
        }

        $inicio = Carbon::parse($startDate);
        $fin = Carbon::parse($endDate);

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
        $cursor = $inicio->copy();
        while ($cursor->lte($fin)) {
            $key = $cursor->format('Y-m');
            $diasPorMes[$key] = ($diasPorMes[$key] ?? 0) + 1;
            $cursor->addDay();
        }

        $totalDias = array_sum($diasPorMes);
        if ($totalDias === 0) {
            return $distribucion;
        }

        $sumaAsignada = 0.0;
        $ultimaKey = null;

        foreach ($diasPorMes as $key => $dias) {
            if (! isset($distribucion[$key])) {
                continue;
            }
            $monto = round($parcial * $dias / $totalDias, 2);
            $distribucion[$key]['monto'] = $monto;
            $distribucion[$key]['porcentaje'] = round(($dias / $totalDias) * 100, 6);
            $sumaAsignada += $monto;
            $ultimaKey = $key;
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
        float $parcial,
        string $startDate,
        string $endDate,
        array $periodos
    ): array {
        $claves = array_column($periodos, 'key');
        $distribucion = array_fill_keys($claves, ['monto' => 0.0, 'porcentaje' => 0.0]);

        if ($parcial <= 0) {
            return $distribucion;
        }

        $inicio = Carbon::parse($startDate);
        $fin = Carbon::parse($endDate);

        $diasPorPeriodo = [];
        foreach ($periodos as $p) {
            $pInicio = Carbon::parse($p['key']);
            $pFin = $pInicio->copy()->addDays(29);

            $solape_inicio = $inicio->gt($pInicio) ? $inicio : $pInicio;
            $solape_fin = $fin->lt($pFin) ? $fin : $pFin;

            if ($solape_inicio->lte($solape_fin)) {
                $diasPorPeriodo[$p['key']] = $solape_inicio->diffInDays($solape_fin) + 1;
            }
        }

        $totalDias = array_sum($diasPorPeriodo);
        if ($totalDias === 0) {
            return $distribucion;
        }

        $sumaAsignada = 0.0;
        $ultimaKey = null;

        foreach ($diasPorPeriodo as $key => $dias) {
            $monto = round($parcial * $dias / $totalDias, 2);
            $distribucion[$key]['monto'] = $monto;
            $distribucion[$key]['porcentaje'] = round(($dias / $totalDias) * 100, 6);
            $sumaAsignada += $monto;
            $ultimaKey = $key;
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
        float $parcial,
        string $startDate,
        string $endDate,
        array $clavesPeriodos,
        array $periodos,
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
        $parentIds = $tasks->pluck('parent')->filter(fn ($p) => $p !== '0')->unique()->values()->toArray();
        $leafTasks = $tasks->filter(fn ($t) => ! in_array($t['id'], $parentIds));

        $leafData = [];
        $totalPresupuesto = 0.0;

        foreach ($leafTasks as $id => $task) {
            $parcial = (float) ($task['cost'] ?? 0);
            $valRow = $valorizadoGuardado->get($task['item']);

            if ($valRow) {
                $distribucion = $this->normalizarDistribucionMensual(
                    json_decode($valRow->distribucion_mensual, true) ?? [],
                    $periodos,
                    $parcial
                );
            } elseif (! empty($task['start_date']) && ! empty($task['end_date']) && $parcial > 0) {
                $distribucion = $this->distribuir(
                    $parcial, $task['start_date'], $task['end_date'],
                    $clavesPeriodos, $periodos, $modo
                );
            } else {
                $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);
            }

            $leafData[$id] = [
                'parcial' => $parcial,
                'distribucion' => $distribucion,
            ];
            $totalPresupuesto += $parcial;
        }

        $sortedTasks = $filas->sortBy('item_order');
        $itemsMap = [];

        foreach ($sortedTasks as $row) {
            $id = (string) $row->gantt_id;
            $parentId = $row->parent_id ? (string) $row->parent_id : '0';

            if (isset($leafData[$id])) {
                $parcial = $leafData[$id]['parcial'];
                $distribucion = $leafData[$id]['distribucion'];
                $isLeaf = true;
            } else {
                $parcial = 0.0;
                $distribucion = array_fill_keys($clavesPeriodos, ['monto' => 0.0, 'porcentaje' => 0.0]);
                $isLeaf = false;
            }

            $task = $tasks->get($id) ?? [];

            $itemsMap[$id] = [
                'id' => $id,
                'item' => $row->partida,
                'descripcion' => $row->descripcion,
                'und' => $row->unidad ?? '',
                'metrado' => 0.0,
                'precio' => 0.0,
                'parcial' => $parcial,
                'is_leaf' => $isLeaf,
                'distribucion' => $distribucion,
                'parent_id' => $parentId,
                'start_date' => $task['start_date'] ?? null,
                'end_date' => $task['end_date'] ?? null,
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
            if (! $item['is_leaf']) {
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
        $sortedFilas = $filas->sortBy('item_order');
        $allItems = [];
        $totalPresupuesto = 0.0;

        foreach ($sortedFilas as $row) {
            $id = (string) $row->gantt_id;
            $partida = trim($row->partida ?? '');
            $task = $tasks->get($id) ?? [];

            $pItem = $presupuesto->get($partida);

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

            $isLeaf = $pItem ? (bool) ($pItem->is_leaf ?? true) : false;

            $valRow = $valorizadoGuardado->get($partida);
            if ($valRow) {
                $distribucion = $this->normalizarDistribucionMensual(
                    json_decode($valRow->distribucion_mensual, true) ?? [],
                    $periodos,
                    $parcial
                );
            } elseif ($isLeaf && ! empty($task['start_date']) && ! empty($task['end_date']) && $parcial > 0) {
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
                'id' => $id,
                'item' => $partida,
                'descripcion' => $row->descripcion ?? ($pItem->descripcion ?? ''),
                'und' => $pItem ? ($pItem->unidad ?? '') : ($task['unidad'] ?? ''),
                'metrado' => $pItem ? (float) ($pItem->metrado ?? 0) : 0.0,
                'precio' => $pItem ? (float) ($pItem->precio_unitario ?? 0) : 0.0,
                'parcial' => $parcial,
                'is_leaf' => $isLeaf,
                'distribucion' => $distribucion,
                'parent_id' => $row->parent_id ? (string) $row->parent_id : '0',
                'start_date' => $task['start_date'] ?? null,
                'end_date' => $task['end_date'] ?? null,
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
        $cursor = Carbon::parse($startDate);
        $fin = Carbon::parse($endDate);

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

        $hojas = array_filter($items, fn ($i) => $i['is_leaf']);

        $acumuladoMensual = [];
        $acum = 0.0;

        foreach ($periodos as $p) {
            $montoMes = array_sum(
                array_map(fn ($i) => (float) ($i['distribucion'][$p['key']]['monto'] ?? 0), $hojas)
            );
            $acum += $montoMes;
            $acumuladoMensual[$p['key']] = ['mensual' => $montoMes, 'acumulado' => $acum];
        }

        $mesPicoKey = '';
        $mesPicoLabel = null;
        $mesPicoMonto = 0.0;

        foreach ($periodos as $p) {
            $v = $acumuladoMensual[$p['key']];
            if ($v['mensual'] > $mesPicoMonto) {
                $mesPicoMonto = $v['mensual'];
                $mesPicoKey = $p['key'];
                $mesPicoLabel = $p['labelCal'];
            }
        }

        return [
            'total_partidas' => count($hojas),
            'presupuesto_total' => round($totalPresupuesto, 2),
            'duracion_meses' => count($periodos),
            'mes_pico' => $mesPicoLabel,
            'mes_pico_key' => $mesPicoKey,
            'monto_mes_pico' => round($mesPicoMonto, 2),
            'pct_mes_pico' => $totalPresupuesto > 0
                ? round(($mesPicoMonto / $totalPresupuesto) * 100, 2)
                : 0.0,
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_partidas' => 0,
            'presupuesto_total' => 0,
            'duracion_meses' => 0,
            'mes_pico' => null,
            'mes_pico_key' => null,
            'monto_mes_pico' => 0,
            'pct_mes_pico' => 0,
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
        if ($presupuesto->isEmpty()) {
            return $items;
        }

        $presupuestoMap = [];
        foreach ($presupuesto as $pItem) {
            $partida = trim($pItem->partida ?? '');
            if ($partida !== '') {
                $presupuestoMap[$partida] = $pItem;
            }
        }

        foreach ($items as &$item) {
            $partida = trim($item['item'] ?? '');
            $presupuestoData = $presupuestoMap[$partida] ?? null;

            if ($presupuestoData) {
                $item['metrado'] = (float) ($presupuestoData->metrado ?? 0);
                $item['precio'] = (float) ($presupuestoData->precio_unitario ?? 0);
                $item['und'] = $presupuestoData->unidad ?? $item['und'] ?? '';

                if (! empty($presupuestoData->descripcion)) {
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
        int $presupuestoId,
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
            $presupuestoRow = DB::connection('costos_tenant')
                ->table('presupuesto_general')
                ->where('presupuesto_id', $presupuestoId)
                ->where('partida', $partida)
                ->whereNull('deleted_at')
                ->first();

            if ($presupuestoRow && $presupuestoRow->metrado > 0) {
                $nuevoPrecio = $costoGeneral / $presupuestoRow->metrado;
                DB::connection('costos_tenant')
                    ->table('presupuesto_general')
                    ->where('id', $presupuestoRow->id)
                    ->update([
                        'precio_unitario' => round($nuevoPrecio, 4),
                        //'parcial' => $costoGeneral,
                        'updated_at' => now(),
                    ]);
            }
        } elseif ($fechaPresupuesto->gt($fechaGeneral)) {
            // El usuario editó presupuesto_general → actualizamos cronograma_general.costo
            DB::connection('costos_tenant')
                ->table('cronograma_general')
                ->where('presupuesto_id', $presupuestoId)
                ->where('partida', $partida)
                ->update([
                    'avance' => 0, // Opcional, o mantener avance
                    'updated_at' => now(),
                ]);
        }
        // Si son iguales o diferencia menor a 1 segundo, no hacer nada (están sincronizados)
    }

    /**
     * 🔥 Recalcula la distribución mensual de todas las partidas
     * usando las fechas desde cronograma_general y los costos actualizados
     */
    private function recalcularDistribuciones(array $items, int $presupuestoId): array
    {
        return $items;

        // Obtener las fechas de inicio/fin desde cronograma_general
        $tareas = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get()
            ->keyBy('partida');

        // Generar periodos nuevamente para tener las claves correctas
        $fechas = $tareas->filter(fn ($t) => ! empty($t->fecha_inicio) && ! empty($t->fecha_fin));
        $minFecha = $fechas->min(fn ($t) => $t->fecha_inicio);
        $maxFecha = $fechas->max(fn ($t) => $t->fecha_fin);

        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth() : $inicio->copy()->addMonths(5);

        $periodos = $this->generarPeriodosCalendario($inicio, $fin);
        $clavesPeriodos = array_column($periodos, 'key');

        foreach ($items as &$item) {
            $partida = $item['item'];
            $tarea = $tareas->get($partida);

            if ($tarea && ! empty($tarea->fecha_inicio) && ! empty($tarea->fecha_fin)) {
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

    private function loadGanttRows(int $presupuestoId)
    {
        $records = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')
            ->get();

        return $records->map(function ($row, int $index) {
            return (object) [
                'gantt_id' => (string) ($row->id),
                'partida' => trim((string) ($row->partida ?? '')),
                'descripcion' => $row->descripcion ?? '',
                'unidad' => '', // Se enriquece luego
                'parent_id' => $row->parent_id ? (string) $row->parent_id : null,
                'fecha_inicio' => $row->fecha_inicio,
                'fecha_fin' => $row->fecha_fin,
                'duracion_dias' => (int) ($row->duracion_dias ?? 0),
                'costo' => 0.0, // Se enriquece luego
                'item_order' => $row->item_order ?? ($index + 1),
                'updated_at' => $row->updated_at ?? now(),
            ];
        });
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
 * Obtiene los datos de materiales para el cronograma de materiales
 * Este método es llamado desde el frontend cuando se cambia a la vista de materiales
 */
public function getMaterialesData(Request $request)
{
    $projectId = (int) $request->query('project');
    
    if (! $projectId) {
        return response()->json(['error' => 'ID de proyecto no recibido'], 422);
    }
    
    $costoProject = CostoProject::findOrFail($projectId);
    app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);
    
    $presupuestoId = $this->resolvePresupuestoId();
    
    // Obtener materiales desde la tabla de materiales (ajusta según tu tabla real)
    $materiales = DB::connection('costos_tenant')
        ->table('cronograma_materiales')  // ← Cambia por el nombre real de tu tabla de materiales
        ->where('presupuesto_id', $presupuestoId)
        ->get();
        
\Log::info('Materiales cargados: ' . $materiales->count());  
    
    // Obtener periodos (reutiliza la misma lógica del valorizado)
    $modoCalculo = $request->query('modo', self::MODO_CALENDARIO);
    
    $fechas = DB::connection('costos_tenant')
        ->table('cronograma_general')
        ->where('presupuesto_id', $presupuestoId)
        ->whereNotNull('fecha_inicio')
        ->whereNotNull('fecha_fin')
        ->selectRaw('MIN(fecha_inicio) as min_fecha, MAX(fecha_fin) as max_fecha')
        ->first();
    
    $periodos = $this->generarPeriodosDesdeFechas(
        $fechas?->min_fecha, 
        $fechas?->max_fecha, 
        $modoCalculo
    );
    
    // Calcular resumen de materiales
    $totalMateriales = $materiales->count();
    $presupuestoTotal = $materiales->sum('costo_total');
    
    // Encontrar mes pico
    $mesPicoKey = null;
    $mesPicoMonto = 0;
    $mesPicoLabel = null;
    
    foreach ($periodos as $periodo) {
        $montoMes = $materiales->sum(function ($m) use ($periodo) {
            $dist = json_decode($m->distribucion_mensual ?? '{}', true);
            return $dist[$periodo['key']]['monto'] ?? 0;
        });
        
        if ($montoMes > $mesPicoMonto) {
            $mesPicoMonto = $montoMes;
            $mesPicoKey = $periodo['key'];
            $mesPicoLabel = $periodo['labelCal'];
        }
    }
    
    return response()->json([
        'materiales' => $materiales->map(function ($m) {
            return [
                'partida_origen' => $m->partida_origen ?? '',
                'descripcion' => $m->descripcion ?? '',
                'descripcion_partida' => $m->descripcion_partida ?? '',
                'unidad' => $m->unidad ?? '',
                'tipo' => $m->tipo ?? 'otros',
                'precio' => (float) ($m->precio ?? 0),
                'cantidad_total' => (float) ($m->cantidad_total ?? 0),
                'costo_total' => (float) ($m->costo_total ?? 0),
                'distribucion' => json_decode($m->distribucion_mensual ?? '{}', true),
            ];
        }),
        'periodos' => $periodos,
        'resumen' => [
            'total_materiales' => $totalMateriales,
            'presupuesto_total' => $presupuestoTotal,
            'duracion_meses' => count($periodos),
            'mes_pico' => $mesPicoLabel,
            'mes_pico_key' => $mesPicoKey,
            'monto_mes_pico' => $mesPicoMonto,
            'total_partidas' => $totalMateriales,
        ],
        'estaGuardado' => $materiales->isNotEmpty(),
        'sinGantt' => false,
    ]);
}
}
