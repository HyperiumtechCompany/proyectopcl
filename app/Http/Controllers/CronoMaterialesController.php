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
    // INDEX — Procesador industrial de materiales (5 tipos de insumos)
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

        // ── 9. Obtener TODOS los insumos (5 tablas) ───────────────────────────
        $codigosPartidas = $leafTasks->pluck('item')->unique()->filter()->values()->toArray();

        // MATERIALES 
        $queryMateriales = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_materiales as ins", 'ins.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'pg.unidad as unidad_presupuesto',
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.05 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'materiales' as tipo_insumo"),
            ]);

        // MANO DE OBRA
        $queryManoObra = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_mano_de_obra as ins", 'ins.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'pg.unidad as unidad_presupuesto',
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'mano_de_obra' as tipo_insumo"),
            ]);

        // EQUIPOS (PRECIO_HORA)
        $queryEquipos = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_equipos as ins", 'ins.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'pg.unidad as unidad_presupuesto',
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_hora as precio_apu',
                'ins.insumo_id',
                DB::raw("'equipos' as tipo_insumo"),
            ]);

        // SUBCONTRATOS
        $querySubcontrratos = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_subcontratos as ins", 'ins.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'pg.unidad as unidad_presupuesto',
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'subcontratos' as tipo_insumo"),
            ]);

            // SUBPARTIDAS
        $querySubpartidas = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_subpartidas as ins", 'ins.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'pg.unidad as unidad_presupuesto',
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'subpartidas' as tipo_insumo"),
            ]);

        // UNIR TODAS LAS CONSULTAS
        $materialesApu = $queryMateriales
            ->union($queryManoObra)
            ->union($queryEquipos)
            ->union($querySubcontrratos)
            ->union($querySubpartidas)
            ->get();


        // ── 10. Obtener precios desde insumo_productos ────────────────────────
        $insumoIds = $materialesApu->pluck('insumo_id')->unique()->filter()->toArray();
        $insumoProductos = DB::connection('mysql')
            ->table("{$db}.insumo_productos")
            ->whereIn('id', $insumoIds)
            ->get()
            ->keyBy('id');

        // ── 11. Procesar cada insumo ──────────────────────────────────────────
        $insumosAgrupados = [];

        foreach ($materialesApu as $mat) {
            $insumoDescripcion = trim($mat->insumo_descripcion ?? '');
            if (empty($insumoDescripcion)) continue;
            
            $insumoId   = (int) $mat->insumo_id;
            $insumo     = $insumoProductos->get($insumoId);
            $tipoInsumo = $mat->tipo_insumo ?? $insumo->tipo ?? 'materiales';
            
            // PRIORIDAD DE UNIDAD: presupuesto_general.unidad > insumo_unidad
            $unidad = $mat->unidad_presupuesto ?? $mat->insumo_unidad ?? 'und';
            if (empty($unidad) || $unidad === 'und' || is_numeric($unidad)) {
                $unidad = $insumo->unidad_id ?? 'und';
            }
            
            $precioReal = $insumo->costo_unitario ?? $mat->precio_apu ?? 0;
            if ($precioReal == 0 || $precioReal === null) continue;
            
            $aporteUnitario = (float) ($mat->aporte_unitario ?? 0);
            $factorDesp     = (float) ($mat->factor_desperdicio ?? 1.0);
            $metradoPartida = (float) ($mat->metrado_partida ?? 0);
            
            $cantidadTotalPartida = $metradoPartida * $aporteUnitario * $factorDesp;
            $costoTotalPartida    = $cantidadTotalPartida * $precioReal;
            
            if ($cantidadTotalPartida <= 0) continue;
            
            // REDONDEAR CANTIDAD TOTAL SEGÚN UNIDAD
            $cantidadTotalPartidaRedondeada = $this->redondearPorUnidad($cantidadTotalPartida, $unidad);
            $costoTotalPartida = $cantidadTotalPartidaRedondeada * $precioReal;
            
            $partida        = trim($mat->partida);
            $tarea          = $leafTasks->get($partida);
            $diasData       = $diasPorMesTarea[$partida] ?? null;
            $valorizadoItem = $valorizadoData->get($partida);
            
            // Agrupar por partida + insumo para mostrar trazabilidad
            $agrupador = md5($partida . '|' . $insumoDescripcion . '|' . $unidad);
            
            if (!isset($insumosAgrupados[$agrupador])) {
                $insumosAgrupados[$agrupador] = [
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
            
            $insumosAgrupados[$agrupador]['cantidad_total'] += $cantidadTotalPartidaRedondeada;
            $insumosAgrupados[$agrupador]['costo_total']    += $costoTotalPartida;
            
            // Distribución mensual
            if ($valorizadoItem && !empty($valorizadoItem->distribucion_mensual)) {
                $distValorizado = json_decode($valorizadoItem->distribucion_mensual, true);
                foreach ($clavesPeriodos as $key) {
                    $porcentaje = $distValorizado[$key]['porcentaje'] ?? 0;
                    $cantidadMes = $cantidadTotalPartidaRedondeada * ($porcentaje / 100);
                    $cantidadMesRedondeada = $this->redondearPorUnidad($cantidadMes, $unidad);
                    $montoMes    = $cantidadMesRedondeada * $precioReal;
                    
                    $insumosAgrupados[$agrupador]['distribucion'][$key]['cantidad'] += $cantidadMesRedondeada;
                    $insumosAgrupados[$agrupador]['distribucion'][$key]['monto']    += $montoMes;
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
                        
                        $insumosAgrupados[$agrupador]['distribucion'][$key]['cantidad'] += $cantidadMesRedondeada;
                        $insumosAgrupados[$agrupador]['distribucion'][$key]['monto']    += $montoMes;
                    }
                }
            } else {
                $primerKey = $clavesPeriodos[0] ?? null;
                if ($primerKey) {
                    $insumosAgrupados[$agrupador]['distribucion'][$primerKey]['cantidad'] += $cantidadTotalPartidaRedondeada;
                    $insumosAgrupados[$agrupador]['distribucion'][$primerKey]['monto']    += $costoTotalPartida;
                }
            }
        }

        // ── 12. Ajustar residuos (precisión Delfín) ──────────────────────────
        foreach ($insumosAgrupados as &$insumo) {
            $sumaCantidad = 0.0;
            $sumaMonto    = 0.0;
            $ultimaKey    = null;
            
            foreach ($clavesPeriodos as $key) {
                $sumaCantidad += $insumo['distribucion'][$key]['cantidad'];
                $sumaMonto    += $insumo['distribucion'][$key]['monto'];
                $ultimaKey     = $key;
            }
            
            $residuoCantidad = round($insumo['cantidad_total'] - $sumaCantidad, 4);
            $residuoMonto    = round($insumo['costo_total'] - $sumaMonto, 2);
            
            if ($ultimaKey && (abs($residuoCantidad) > 0.0001 || abs($residuoMonto) > 0.01)) {
                $insumo['distribucion'][$ultimaKey]['cantidad'] += $residuoCantidad;
                $insumo['distribucion'][$ultimaKey]['monto']    += $residuoMonto;
                
                $insumo['distribucion'][$ultimaKey]['cantidad'] = $this->redondearPorUnidad($insumo['distribucion'][$ultimaKey]['cantidad'], $insumo['unidad']);
                $insumo['distribucion'][$ultimaKey]['monto'] = round($insumo['distribucion'][$ultimaKey]['monto'], 2);
            }
        }

        // ── 13. Clasificar por tipo y ordenar ─────────────────────────────────
        $tiposOrden = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas', 'otros'];
        $insumosPorTipo = [];
        
        foreach ($tiposOrden as $tipo) {
            $insumosPorTipo[$tipo] = [];
        }
        
        foreach ($insumosAgrupados as $insumo) {
            $tipo = $insumo['tipo'];
            if (!isset($insumosPorTipo[$tipo])) {
                $insumosPorTipo[$tipo] = [];
            }
            
            // Redondear valores finales según unidad
            $insumo['cantidad_total'] = $this->redondearPorUnidad($insumo['cantidad_total'], $insumo['unidad']);
            $insumo['costo_total']    = round($insumo['costo_total'], 2);
            
            foreach ($clavesPeriodos as $key) {
                $insumo['distribucion'][$key]['cantidad'] = $this->redondearPorUnidad($insumo['distribucion'][$key]['cantidad'], $insumo['unidad']);
                $insumo['distribucion'][$key]['monto']    = round($insumo['distribucion'][$key]['monto'], 2);
            }
            
            $insumosPorTipo[$tipo][] = $insumo;
        }
        
        foreach ($insumosPorTipo as &$grupo) {
            $grupo = collect($grupo)->sortBy('descripcion')->values()->toArray();
        }

        $insumosFinales = [];
        foreach ($insumosPorTipo as $tipo => $items) {
            foreach ($items as $item) {
                $insumosFinales[] = $item;
            }
        }

        $resumen = $this->calcularResumen($insumosFinales, $periodos, $leafTasks->count());

        $estaGuardado = DB::connection('mysql')
            ->table("{$db}.cronograma_materiales")
            ->where('presupuesto_id', $presupuestoIdCorrecto)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project'           => (string) $projectId,
            'projectName'       => $costoProject->nombre,
            'materiales'        => $insumosFinales,
            'materialesPorTipo' => $insumosPorTipo,
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
     */
    private function redondearPorUnidad(float $cantidad, string $unidad): float
    {
        $unidad = strtolower(trim($unidad));
        
        $unidadesEnteras = [
            'und', 'pza', 'bol', 'pln', 'p²', 'p2', 'bal', 'cja', 'rll', 
            'tub', 'var', 'par', 'jgo', 'set', 'kit', 'glb', 'gbl', 'mes', 
            'día', 'dia', 'hor', 'hora', 'sem', 'semana', 'quin', 'quincena'
        ];
        
        $unidadesDecimales = [
            'm³', 'm3', 'm²', 'm2', 'm', 'km', 'kg', 'gln', 'gal', 'l', 
            'lt', 't', 'tn', 'ml', 'cc', 'cm³', 'cm3', 'mm', 'ha', 'lb'
        ];
        
        if (in_array($unidad, $unidadesEnteras)) {
            return round($cantidad, 0);
        }
        
        if (in_array($unidad, $unidadesDecimales) || preg_match('/[³²]/', $unidad)) {
            return round($cantidad, 3);
        }
        
        return round($cantidad, 2);
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