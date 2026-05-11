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
    // INDEX — Procesador industrial de materiales
    // ──────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
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

        // ── 2. Mapear tareas ─────────────────────────────────────────────────
        $tasks = $filas->map(fn($f) => [
            'id'          => (string) $f->gantt_id,
            'item'        => $f->partida,
            'parent'      => $f->parent_id ? (string) $f->parent_id : '0',
            'start_date'  => $f->fecha_inicio,
            'end_date'    => $f->fecha_fin,
            'cost'        => (float) ($f->costo ?? 0),
            'duracion_dias'=> (int) ($f->duracion_dias ?? 0),
            'updated_at'  => $f->updated_at ?? now(),
        ])->keyBy('id');

        // ── 3. Identificar tareas HOJA ───────────────────────────────────────
        $parentIds = $tasks->pluck('parent')->filter(fn($p) => $p !== '0')->unique()->values()->toArray();
        $leafTasks = $tasks->filter(fn($t) => !in_array($t['id'], $parentIds) && !empty($t['item']));

        if ($leafTasks->isEmpty()) {
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

        // ── 4. Rango de fechas del proyecto ──────────────────────────────────
        $fechas = $leafTasks->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));
        $minFecha = $fechas->min(fn($t) => $t['start_date']);
        $maxFecha = $fechas->max(fn($t) => $t['end_date']);

        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin    = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth() : $inicio->copy()->addMonths(5);

        // ── 5. Generar períodos mensuales ────────────────────────────────────
        $periodos = [];
        $cursor   = $inicio->copy();
        $mesNum   = 1;
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

        // ── 6. Calcular días por mes para cada tarea ─────────────────────────
        $diasPorMesTarea = [];
        foreach ($leafTasks as $task) {
            if (empty($task['start_date']) || empty($task['end_date'])) continue;
            
            $inicioTask = Carbon::parse($task['start_date']);
            $finTask    = Carbon::parse($task['end_date']);
            $totalDias  = $inicioTask->diffInDays($finTask) + 1;
            
            $diasPorMes = [];
            $cursorTask = $inicioTask->copy();
            while ($cursorTask->lte($finTask)) {
                $key = $cursorTask->format('Y-m');
                $diasPorMes[$key] = ($diasPorMes[$key] ?? 0) + 1;
                $cursorTask->addDay();
            }
            
            $diasPorMesTarea[$task['item']] = [
                'dias_por_mes' => $diasPorMes,
                'total_dias'   => $totalDias,
            ];
        }

        // ── 7. Obtener presupuesto_id correcto (desde costo_projects) ─────────
        $presupuestoIdCorrecto = $costoProject->presupuesto_id ?? 2;

        // ── 8. Obtener porcentajes de avance desde cronograma_valorizado ──────
        $valorizadoData = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $presupuestoIdCorrecto)
            ->get()
            ->keyBy('partida');

        // ── 9. Obtener materiales desde ACU ───────────────────────────────────
        $codigosPartidas = $leafTasks->pluck('item')->unique()->filter()->values()->toArray();

        // Consulta maestra: cruza partidas con ACU y presupuesto_general
        $materialesApu = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_materiales as am", 'am.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'pg.unidad as unidad_presupuesto',  // 🔥 NUEVO: unidad desde presupuesto_general
                'am.descripcion as insumo_descripcion',
                'am.unidad as insumo_unidad',
                'am.cantidad as aporte_unitario',
                'am.factor_desperdicio',
                'am.precio_unitario as precio_apu',
                'am.insumo_id',
            ])
            ->get();

        // ── 10. Obtener precios desde insumo_productos ────────────────────────
        $insumoIds = $materialesApu->pluck('insumo_id')->unique()->filter()->toArray();
        $insumoProductos = DB::connection('mysql')
            ->table("{$db}.insumo_productos")
            ->whereIn('id', $insumoIds)
            ->get()
            ->keyBy('id');

        // ── 11. Procesar cada material ────────────────────────────────────────
        $materialesAgrupados = [];

        foreach ($materialesApu as $mat) {
            $insumoDescripcion = trim($mat->insumo_descripcion ?? '');
            if (empty($insumoDescripcion)) continue;
            
            $insumoId   = (int) $mat->insumo_id;
            $insumo     = $insumoProductos->get($insumoId);
            $tipoInsumo = $insumo->tipo ?? 'materiales';
            
            // 🔥 PRIORIDAD DE UNIDAD: presupuesto_general.unidad > acu_materiales.unidad > insumo_productos.unidad_id
            $unidad = $mat->unidad_presupuesto ?? $mat->insumo_unidad ?? 'und';
            if (empty($unidad) || $unidad === 'und' || is_numeric($unidad)) {
                $unidad = $insumo->unidad_id ?? 'und';
            }
            
            $precioReal = $insumo->costo_unitario ?? $mat->precio_apu ?? 0;
            
            $aporteUnitario = (float) ($mat->aporte_unitario ?? 0);
            $factorDesp     = (float) ($mat->factor_desperdicio ?? 1.0);
            $metradoPartida = (float) ($mat->metrado_partida ?? 0);
            
            $cantidadTotalPartida = $metradoPartida * $aporteUnitario * $factorDesp;
            $costoTotalPartida    = $cantidadTotalPartida * $precioReal;
            
            if ($cantidadTotalPartida <= 0) continue;
            
            // 🔥 REDONDEAR CANTIDAD TOTAL SEGÚN UNIDAD
            $cantidadTotalPartidaRedondeada = $this->redondearPorUnidad($cantidadTotalPartida, $unidad);
            $costoTotalPartida = $cantidadTotalPartidaRedondeada * $precioReal;
            
            $partida        = trim($mat->partida);
            $tarea          = $leafTasks->get($partida);
            $diasData       = $diasPorMesTarea[$partida] ?? null;
            $valorizadoItem = $valorizadoData->get($partida);
            
            // Agrupar por partida + insumo para mostrar trazabilidad
            $agrupador = md5($partida . '|' . $insumoDescripcion . '|' . $unidad);
            
            if (!isset($materialesAgrupados[$agrupador])) {
                $materialesAgrupados[$agrupador] = [
                    'partida_origen' => $partida,
                    'descripcion'    => $insumoDescripcion,
                    'unidad'         => $unidad,
                    'tipo'           => $tipoInsumo,
                    'precio'         => $precioReal,
                    'cantidad_total' => 0.0,
                    'costo_total'    => 0.0,
                    'distribucion'   => array_fill_keys($clavesPeriodos, ['cantidad' => 0.0, 'monto' => 0.0]),
                ];
            }
            
            $materialesAgrupados[$agrupador]['cantidad_total'] += $cantidadTotalPartidaRedondeada;
            $materialesAgrupados[$agrupador]['costo_total']    += $costoTotalPartida;
            
            // Distribución mensual
            if ($valorizadoItem && !empty($valorizadoItem->distribucion_mensual)) {
                $distValorizado = json_decode($valorizadoItem->distribucion_mensual, true);
                foreach ($clavesPeriodos as $key) {
                    $porcentaje = $distValorizado[$key]['porcentaje'] ?? 0;
                    $cantidadMes = $cantidadTotalPartidaRedondeada * ($porcentaje / 100);
                    $cantidadMesRedondeada = $this->redondearPorUnidad($cantidadMes, $unidad);
                    $montoMes    = $cantidadMesRedondeada * $precioReal;
                    
                    $materialesAgrupados[$agrupador]['distribucion'][$key]['cantidad'] += $cantidadMesRedondeada;
                    $materialesAgrupados[$agrupador]['distribucion'][$key]['monto']    += $montoMes;
                }
            } elseif ($diasData) {
                $totalDias = $diasData['total_dias'];
                $diasPorMes = $diasData['dias_por_mes'];
                
                foreach ($clavesPeriodos as $key) {
                    $diasMes = $diasPorMes[$key] ?? 0;
                    if ($diasMes > 0 && $totalDias > 0) {
                        $cantidadMes = $cantidadTotalPartidaRedondeada * ($diasMes / $totalDias);
                        $cantidadMesRedondeada = $this->redondearPorUnidad($cantidadMes, $unidad);
                        $montoMes    = $cantidadMesRedondeada * $precioReal;
                        
                        $materialesAgrupados[$agrupador]['distribucion'][$key]['cantidad'] += $cantidadMesRedondeada;
                        $materialesAgrupados[$agrupador]['distribucion'][$key]['monto']    += $montoMes;
                    }
                }
            } else {
                $primerKey = $clavesPeriodos[0] ?? null;
                if ($primerKey) {
                    $materialesAgrupados[$agrupador]['distribucion'][$primerKey]['cantidad'] += $cantidadTotalPartidaRedondeada;
                    $materialesAgrupados[$agrupador]['distribucion'][$primerKey]['monto']    += $costoTotalPartida;
                }
            }
        }

        // ── 12. Ajustar residuos (precisión Delfín) ──────────────────────────
        foreach ($materialesAgrupados as &$material) {
            $sumaCantidad = 0.0;
            $sumaMonto    = 0.0;
            $ultimaKey    = null;
            
            foreach ($clavesPeriodos as $key) {
                $sumaCantidad += $material['distribucion'][$key]['cantidad'];
                $sumaMonto    += $material['distribucion'][$key]['monto'];
                $ultimaKey     = $key;
            }
            
            $residuoCantidad = round($material['cantidad_total'] - $sumaCantidad, 4);
            $residuoMonto    = round($material['costo_total'] - $sumaMonto, 2);
            
            if ($ultimaKey && (abs($residuoCantidad) > 0.0001 || abs($residuoMonto) > 0.01)) {
                $material['distribucion'][$ultimaKey]['cantidad'] += $residuoCantidad;
                $material['distribucion'][$ultimaKey]['monto']    += $residuoMonto;
                
                // Re-redondear después del ajuste
                $material['distribucion'][$ultimaKey]['cantidad'] = $this->redondearPorUnidad($material['distribucion'][$ultimaKey]['cantidad'], $material['unidad']);
                $material['distribucion'][$ultimaKey]['monto'] = round($material['distribucion'][$ultimaKey]['monto'], 2);
            }
        }

        // ── 13. Clasificar por tipo y ordenar ─────────────────────────────────
        $tiposOrden = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'otros'];
        $materialesPorTipo = [];
        
        foreach ($tiposOrden as $tipo) {
            $materialesPorTipo[$tipo] = [];
        }
        
        foreach ($materialesAgrupados as $material) {
            $tipo = $material['tipo'];
            if (!isset($materialesPorTipo[$tipo])) {
                $materialesPorTipo[$tipo] = [];
            }
            
            // Redondear valores finales según unidad
            $material['cantidad_total'] = $this->redondearPorUnidad($material['cantidad_total'], $material['unidad']);
            $material['costo_total']    = round($material['costo_total'], 2);
            
            foreach ($clavesPeriodos as $key) {
                $material['distribucion'][$key]['cantidad'] = $this->redondearPorUnidad($material['distribucion'][$key]['cantidad'], $material['unidad']);
                $material['distribucion'][$key]['monto']    = round($material['distribucion'][$key]['monto'], 2);
            }
            
            $materialesPorTipo[$tipo][] = $material;
        }
        
        foreach ($materialesPorTipo as &$grupo) {
            $grupo = collect($grupo)->sortBy('descripcion')->values()->toArray();
        }

        $materialesFinales = [];
        foreach ($materialesPorTipo as $tipo => $items) {
            foreach ($items as $item) {
                $materialesFinales[] = $item;
            }
        }

        $resumen = $this->calcularResumen($materialesFinales, $periodos, $leafTasks->count());

        $estaGuardado = DB::connection('mysql')
            ->table("{$db}.cronograma_materiales")
            ->where('presupuesto_id', $presupuestoIdCorrecto)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project'           => (string) $projectId,
            'projectName'       => $costoProject->nombre,
            'materiales'        => $materialesFinales,
            'materialesPorTipo' => $materialesPorTipo,
            'periodos'          => $periodos,
            'resumen'           => $resumen,
            'estaGuardado'      => $estaGuardado,
            'sinGantt'          => false,
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

        $projectId  = (int) $request->input('project_id');
        $materiales = $request->input('materiales');

        // ELIMINAR DUPLICADOS ANTES DE GUARDAR
        $materialesUnicos = [];
        foreach ($materiales as $mat) {
            $descripcion = $mat['descripcion'] ?? '';
            if (!isset($materialesUnicos[$descripcion])) {
                $materialesUnicos[$descripcion] = $mat;
            }
        }
        $materiales = array_values($materialesUnicos);

        $costoProject = CostoProject::findOrFail($projectId);
        $db = $costoProject->database_name;

        // OBTENER PRESUPUESTO_ID DESDE costo_projects
        $presupuestoId = $costoProject->presupuesto_id ?? 2;

        DB::connection('mysql')->transaction(function () use ($db, $presupuestoId, $materiales) {
            // Limpiar registros anteriores de ESTE presupuesto
            DB::connection('mysql')
                ->table("{$db}.cronograma_materiales")
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $rows = [];
            foreach ($materiales as $idx => $mat) {
                $distribucionSimplificada = [];
                foreach ($mat['distribucion'] as $key => $values) {
                    $distribucionSimplificada[$key] = [
                        'cantidad' => $values['cantidad'] ?? 0,
                        'monto'    => $values['monto'] ?? 0,
                    ];
                }
                
                $rows[] = [
                    'presupuesto_id'       => $presupuestoId,
                    'item_order'           => $idx + 1,
                    'descripcion'          => $mat['descripcion'],
                    'unidad'               => $mat['unidad'] ?? '',
                    'cantidad_total'       => $mat['cantidad_total'],
                    'precio_unitario'      => $mat['precio'],
                    'presupuesto_total'    => $mat['costo_total'],
                    'distribucion_mensual' => json_encode($distribucionSimplificada),
                    'created_at'           => now(),
                    'updated_at'           => now(),
                ];
            }

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

        // OBTENER PRESUPUESTO_ID DESDE costo_projects
        $presupuestoId = $costoProject->presupuesto_id ?? 2;

        $deleted = DB::connection('mysql')
            ->table("{$db}.cronograma_materiales")
            ->where('presupuesto_id', $presupuestoId)
            ->delete();

        return response()->json([
            'status'  => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma de materiales.",
        ]);
    }

    // =========================================================================
    // PRIVADOS
    // =========================================================================

    /**
     * 🔥 Redondea una cantidad según la unidad de medida
     * - Unidades enteras: und, pza, bol, pln, p², bal, cja, rll, tub, var, par, jgo, set, kit, glb, gbl → 0 decimales
     * - Unidades de medida: m³, m2, m, kg, gln, gal, l, t → 3 decimales
     * - Por defecto: 2 decimales
     */
    private function redondearPorUnidad(float $cantidad, string $unidad): float
    {
        $unidad = strtolower(trim($unidad));
        
        // Unidades que deben ser ENTERAS (sin decimales)
        $unidadesEnteras = [
            'und', 'pza', 'bol', 'pln', 'p²', 'p2', 'bal', 'cja', 'rll', 
            'tub', 'var', 'par', 'jgo', 'set', 'kit', 'glb', 'gbl', 'mes', 
            'día', 'dia', 'hor', 'hora', 'sem', 'semana', 'quin', 'quincena'
        ];
        
        // Unidades que permiten 3 decimales (granel, líquidos, áreas, volúmenes)
        $unidadesDecimales = [
            'm³', 'm3', 'm²', 'm2', 'm', 'km', 'kg', 'gln', 'gal', 'l', 
            'lt', 't', 'tn', 'ml', 'cc', 'cm³', 'cm3', 'mm', 'ha', 'lb'
        ];
        
        if (in_array($unidad, $unidadesEnteras)) {
            return round($cantidad, 0);  // Entero
        }
        
        if (in_array($unidad, $unidadesDecimales) || preg_match('/[³²]/', $unidad)) {
            return round($cantidad, 3);  // 3 decimales
        }
        
        return round($cantidad, 2);  // Default: 2 decimales
    }

    private function calcularResumen(array $materiales, array $periodos, int $totalPartidas): array
    {
        if (empty($materiales) || empty($periodos)) {
            return $this->resumenVacio();
        }

        $totalMateriales   = count($materiales);
        $presupuestoTotal  = array_sum(array_column($materiales, 'costo_total'));
        
        $clavesPeriodos = array_column($periodos, 'key');
        $mensualPorTipo = [];
        
        foreach ($clavesPeriodos as $key) {
            $mensualPorTipo[$key] = 0;
        }
        
        foreach ($materiales as $mat) {
            foreach ($clavesPeriodos as $key) {
                $mensualPorTipo[$key] += $mat['distribucion'][$key]['monto'] ?? 0;
            }
        }
        
        arsort($mensualPorTipo);
        $mesPicoKey   = array_key_first($mensualPorTipo) ?? null;
        $montoPico    = $mensualPorTipo[$mesPicoKey] ?? 0;
        
        $mesPicoLabel = null;
        foreach ($periodos as $p) {
            if ($p['key'] === $mesPicoKey) {
                $mesPicoLabel = $p['labelCal'];
                break;
            }
        }
        
        $duracionMeses = count($periodos);

        return [
            'total_materiales'   => $totalMateriales,
            'presupuesto_total'  => round($presupuestoTotal, 2),
            'duracion_meses'     => $duracionMeses,
            'mes_pico'           => $mesPicoLabel,
            'mes_pico_key'       => $mesPicoKey,
            'monto_mes_pico'     => round($montoPico, 2),
            'total_partidas'     => $totalPartidas,
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_materiales'  => 0,
            'presupuesto_total' => 0,
            'duracion_meses'    => 0,
            'mes_pico'          => null,
            'mes_pico_key'      => null,
            'monto_mes_pico'    => 0,
            'total_partidas'    => 0,
        ];
    }
}