<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

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
                'projectData'  => $costoProject,
            ]);
        }

        // ── 2. Mapear tareas ─────────────────────────────────────────────────
        $tasks = $filas->map(fn($f) => [
            'id'           => (string) $f->gantt_id,
            'item'         => $f->partida,
            'parent'       => $f->parent_id ? (string) $f->parent_id : '0',
            'start_date'   => $f->fecha_inicio,
            'end_date'     => $f->fecha_fin,
            'cost'         => (float) ($f->costo ?? 0),
            'duracion_dias' => (int) ($f->duracion_dias ?? 0),
            'updated_at'   => $f->updated_at ?? now(),
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
                'projectData'  => $costoProject,
            ]);
        }

        // ── 4. Rango de fechas del proyecto ──────────────────────────────────
        $fechas   = $leafTasks->filter(fn($t) => !empty($t['start_date']) && !empty($t['end_date']));
        $minFecha = $fechas->min(fn($t) => $t['start_date']);
        $maxFecha = $fechas->max(fn($t) => $t['end_date']);

        $inicio = $minFecha ? Carbon::parse($minFecha)->startOfMonth() : now()->startOfMonth();
        $fin    = $maxFecha ? Carbon::parse($maxFecha)->endOfMonth()   : $inicio->copy()->addMonths(5);

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
            $totalDias  = max(1, $inicioTask->diffInDays($finTask) + 1);

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

        // ── 7. Obtener presupuesto_id correcto ────────────────────────────────
        $presupuestoIdCorrecto = $costoProject->presupuesto_id ?? 2;

        // ── 8. Obtener porcentajes de avance desde cronograma_valorizado ──────
        $valorizadoData = DB::connection('mysql')
            ->table("{$db}.cronograma_valorizado")
            ->where('presupuesto_id', $presupuestoIdCorrecto)
            ->get()
            ->keyBy('partida');

        // ── 9. Obtener TODOS los insumos (5 tablas) ───────────────────────────
        $codigosPartidas = $leafTasks->pluck('item')->unique()->filter()->values()->toArray();

        // ── MANO DE OBRA ─────────────────────────────────────────────────────
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
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'mano_de_obra' as tipo_insumo"),
            ]);

        // ── MATERIALES ───────────────────────────────────────────────────────
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
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("COALESCE(ins.factor_desperdicio, 1.05) as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'materiales' as tipo_insumo"),
            ]);

        // ── EQUIPOS ──────────────────────────────────────────────────────────
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
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_hora as precio_apu',
                'ins.insumo_id',
                DB::raw("'equipos' as tipo_insumo"),
            ]);

        // ── SUBCONTRATOS ─────────────────────────────────────────────────────
        $querySubcontratos = DB::connection('mysql')
            ->table("{$db}.presupuesto_general as pg")
            ->join("{$db}.presupuesto_acus as pa", 'pa.partida', '=', 'pg.partida')
            ->join("{$db}.acu_subcontratos as ins", 'ins.acu_id', '=', 'pa.id')
            ->where('pg.presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(pg.partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('pg.deleted_at')
            ->select([
                DB::raw('TRIM(pg.partida) as partida'),
                'pg.metrado as metrado_partida',
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'subcontratos' as tipo_insumo"),
            ]);

        // ── SUBPARTIDAS ──────────────────────────────────────────────────────
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
                'ins.descripcion as insumo_descripcion',
                'ins.unidad as insumo_unidad',
                'ins.cantidad as aporte_unitario',
                DB::raw("1.0 as factor_desperdicio"),
                'ins.precio_unitario as precio_apu',
                'ins.insumo_id',
                DB::raw("'subpartidas' as tipo_insumo"),
            ]);

        // ── UNIR TODAS LAS CONSULTAS ──────────────────────────────────────────
        $materialesApu = $queryManoObra
            ->union($queryMateriales)
            ->union($queryEquipos)
            ->union($querySubcontratos)
            ->union($querySubpartidas)
            ->get();

        // ── 10. Obtener precios desde insumo_productos ────────────────────────
        $insumoIds = $materialesApu->pluck('insumo_id')->unique()->filter()->toArray();
        $insumoProductos = DB::connection('mysql')
            ->table("{$db}.insumo_productos")
            ->whereIn('id', $insumoIds)
            ->get()
            ->keyBy('id');

        // ── 11. Obtener descripciones de partidas ─────────────────────────────
        $descripcionesPartidas = DB::connection('mysql')
            ->table("{$db}.presupuesto_general")
            ->where('presupuesto_id', $presupuestoIdCorrecto)
            ->whereIn(DB::raw('TRIM(partida)'), array_map('trim', $codigosPartidas))
            ->whereNull('deleted_at')
            ->pluck('descripcion', DB::raw('TRIM(partida)'))
            ->toArray();

        // ── 12. Procesar cada insumo y AGRUPAR GLOBALMENTE por descripción+tipo
        //        ► La clave de agrupación es: descripcion|tipo  (NO incluye partida)
        //          Así el mismo insumo que aparece en varias partidas se SUMA
        // ─────────────────────────────────────────────────────────────────────
        $insumosAgrupados = [];   // [clave] => datos acumulados
        $precioPorInsumo  = [];   // [descripcion] => precio para consistencia

        foreach ($materialesApu as $mat) {
            $insumoDescripcion = trim($mat->insumo_descripcion ?? '');
            if (empty($insumoDescripcion)) continue;

            $insumoId   = (int) $mat->insumo_id;
            $insumo     = $insumoProductos->get($insumoId);
            $tipoInsumo = $mat->tipo_insumo ?? ($insumo->tipo ?? 'materiales');

            // ── Precio: catálogo > APU (nunca 0) ─────────────────────────────
            $precioReal = (float) ($insumo->costo_unitario ?? 0);
            if ($precioReal <= 0) {
                $precioReal = (float) ($mat->precio_apu ?? 0);
            }
            if ($precioReal <= 0) continue;   // sin precio no se puede calcular

            // ── Unidad: del insumo en el ACU (hh, m³, m, etc.) ───────────────
            $unidad = trim($mat->insumo_unidad ?? 'und');
            if (empty($unidad)) $unidad = 'und';

            // ── Cantidades ────────────────────────────────────────────────────
            $aporteUnitario  = (float) ($mat->aporte_unitario  ?? 0);
            $factorDesp      = (float) ($mat->factor_desperdicio ?? 1.0);
            $metradoPartida  = (float) ($mat->metrado_partida   ?? 0);

            // cantidad total que se necesita de este insumo para ESTA PARTIDA
            $cantidadParaEstaPartida = $metradoPartida * $aporteUnitario * $factorDesp;
            if ($cantidadParaEstaPartida <= 0) continue;

            $cantidadParaEstaPartidaRedondeada = $this->redondearPorUnidad($cantidadParaEstaPartida, $unidad);
            $costoParaEstaPartida              = $cantidadParaEstaPartidaRedondeada * $precioReal;

            // ── Clave GLOBAL (agrupa el mismo insumo de todas las partidas) ───
            // Usamos descripcion + tipo para evitar mezclar, ej. AGUA-materiales
            $claveGlobal = strtoupper(trim($insumoDescripcion)) . '|' . $tipoInsumo;

            // ── Validar consistencia de precios ───────────────────────────────
            if (isset($precioPorInsumo[$claveGlobal])) {
                if (abs($precioPorInsumo[$claveGlobal] - $precioReal) > 0.001) {
                    Log::warning("Precio inconsistente para '{$insumoDescripcion}' [{$tipoInsumo}]: " .
                        "previo={$precioPorInsumo[$claveGlobal]}, nuevo={$precioReal}. Se usa el del catálogo.");
                }
                // Siempre usar el precio ya registrado (del catálogo, consistente)
                $precioReal = $precioPorInsumo[$claveGlobal];
            } else {
                $precioPorInsumo[$claveGlobal] = $precioReal;
            }

            // ── Inicializar si no existe ──────────────────────────────────────
            if (!isset($insumosAgrupados[$claveGlobal])) {
                $insumosAgrupados[$claveGlobal] = [
                    'descripcion'    => $insumoDescripcion,
                    'unidad'         => $unidad,
                    'tipo'           => $tipoInsumo,
                    'precio'         => $precioReal,
                    'cantidad_total' => 0.0,
                    'costo_total'    => 0.0,
                    'distribucion'   => array_fill_keys($clavesPeriodos, ['cantidad' => 0.0, 'monto' => 0.0]),
                    // trazabilidad: lista de partidas que aportan a este insumo
                    'partidas_origen' => [],
                ];
            }

            // ── Acumular cantidad y costo totales ─────────────────────────────
            $insumosAgrupados[$claveGlobal]['cantidad_total'] += $cantidadParaEstaPartidaRedondeada;
            $insumosAgrupados[$claveGlobal]['costo_total']    += $costoParaEstaPartida;
            $insumosAgrupados[$claveGlobal]['partidas_origen'][] = trim($mat->partida);

            // ── Distribución mensual de ESTA PARTIDA ──────────────────────────
            $partida        = trim($mat->partida);
            $valorizadoItem = $valorizadoData->get($partida);
            $diasData       = $diasPorMesTarea[$partida] ?? null;

            if ($valorizadoItem && !empty($valorizadoItem->distribucion_mensual)) {
                // Distribuir según porcentajes del cronograma valorizado
                $distValorizado = json_decode($valorizadoItem->distribucion_mensual, true);
                foreach ($clavesPeriodos as $key) {
                    $porcentaje = (float) ($distValorizado[$key]['porcentaje'] ?? 0);
                    $cantMes    = $cantidadParaEstaPartidaRedondeada * ($porcentaje / 100);
                    $cantMesRed = $this->redondearPorUnidad($cantMes, $unidad);
                    $montoMes   = $cantMesRed * $precioReal;

                    $insumosAgrupados[$claveGlobal]['distribucion'][$key]['cantidad'] += $cantMesRed;
                    $insumosAgrupados[$claveGlobal]['distribucion'][$key]['monto']    += $montoMes;
                }
            } elseif ($diasData) {
                // Distribuir proporcionalmente por días
                $totalDias  = $diasData['total_dias'];
                $diasPorMes = $diasData['dias_por_mes'];

                foreach ($clavesPeriodos as $key) {
                    $diasMes = $diasPorMes[$key] ?? 0;
                    if ($diasMes > 0 && $totalDias > 0) {
                        $cantMes    = $cantidadParaEstaPartidaRedondeada * ($diasMes / $totalDias);
                        $cantMesRed = $this->redondearPorUnidad($cantMes, $unidad);
                        $montoMes   = $cantMesRed * $precioReal;

                        $insumosAgrupados[$claveGlobal]['distribucion'][$key]['cantidad'] += $cantMesRed;
                        $insumosAgrupados[$claveGlobal]['distribucion'][$key]['monto']    += $montoMes;
                    }
                }
            } else {
                // Sin fechas: todo va al primer período
                $primerKey = $clavesPeriodos[0] ?? null;
                if ($primerKey) {
                    $insumosAgrupados[$claveGlobal]['distribucion'][$primerKey]['cantidad'] += $cantidadParaEstaPartidaRedondeada;
                    $insumosAgrupados[$claveGlobal]['distribucion'][$primerKey]['monto']    += $costoParaEstaPartida;
                }
            }
        }

        // ── 13. Ajuste de residuos por precisión (distribucion suma exacta) ───
        foreach ($insumosAgrupados as &$insumo) {
            $sumaCantidad = 0.0;
            $sumaMonto    = 0.0;
            $ultimaKey    = null;

            foreach ($clavesPeriodos as $key) {
                $sumaCantidad += $insumo['distribucion'][$key]['cantidad'];
                $sumaMonto    += $insumo['distribucion'][$key]['monto'];
                $ultimaKey     = $key;
            }

            if ($ultimaKey) {
                $residuoCantidad = round($insumo['cantidad_total'] - $sumaCantidad, 4);
                $residuoMonto    = round($insumo['costo_total']    - $sumaMonto,    2);

                if (abs($residuoCantidad) > 0.0001) {
                    $insumo['distribucion'][$ultimaKey]['cantidad'] += $residuoCantidad;
                    $insumo['distribucion'][$ultimaKey]['cantidad']  = $this->redondearPorUnidad(
                        $insumo['distribucion'][$ultimaKey]['cantidad'], $insumo['unidad']
                    );
                }
                if (abs($residuoMonto) > 0.01) {
                    $insumo['distribucion'][$ultimaKey]['monto'] += $residuoMonto;
                    $insumo['distribucion'][$ultimaKey]['monto']  = round($insumo['distribucion'][$ultimaKey]['monto'], 2);
                }
            }
        }
        unset($insumo);

        // ── 14. Clasificar por tipo y ordenar alfabéticamente ─────────────────
        $tiposOrden    = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas', 'otros'];
        $insumosPorTipo = array_fill_keys($tiposOrden, []);

        foreach ($insumosAgrupados as $insumo) {
            // Redondeo final
            $insumo['cantidad_total'] = $this->redondearPorUnidad($insumo['cantidad_total'], $insumo['unidad']);
            $insumo['costo_total']    = round($insumo['costo_total'], 2);

            foreach ($clavesPeriodos as $key) {
                $insumo['distribucion'][$key]['cantidad'] = $this->redondearPorUnidad(
                    $insumo['distribucion'][$key]['cantidad'], $insumo['unidad']
                );
                $insumo['distribucion'][$key]['monto'] = round($insumo['distribucion'][$key]['monto'], 2);
            }

            // Convertir partidas_origen a string para el front (trazabilidad)
            $insumo['partida_origen'] = implode(', ', array_unique($insumo['partidas_origen']));
            unset($insumo['partidas_origen']);

            $tipo = $insumo['tipo'];
            if (!isset($insumosPorTipo[$tipo])) {
                $insumosPorTipo[$tipo] = [];
            }
            $insumosPorTipo[$tipo][] = $insumo;
        }

        foreach ($insumosPorTipo as &$grupo) {
            $grupo = collect($grupo)->sortBy('descripcion')->values()->toArray();
        }
        unset($grupo);

        // ── 15. Aplanar en lista final ────────────────────────────────────────
        $insumosFinales = [];
        foreach ($tiposOrden as $tipo) {
            foreach (($insumosPorTipo[$tipo] ?? []) as $item) {
                $insumosFinales[] = $item;
            }
        }

        // ── 16. Resumen y estado guardado ─────────────────────────────────────
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
            'projectData'       => $costoProject,
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

        // ── Eliminar duplicados antes de guardar (por si llegan del front) ────
        $materialesUnicos = [];
        foreach ($materiales as $mat) {
            $clave = strtoupper(trim($mat['descripcion'] ?? '')) . '|' . ($mat['tipo'] ?? '');
            if (!isset($materialesUnicos[$clave])) {
                $materialesUnicos[$clave] = $mat;
            } else {
                // Sumar si por algún motivo llegaran duplicados
                $materialesUnicos[$clave]['cantidad_total'] += $mat['cantidad_total'] ?? 0;
                $materialesUnicos[$clave]['costo_total']    += $mat['costo_total']    ?? 0;
                foreach (($mat['distribucion'] ?? []) as $key => $vals) {
                    $materialesUnicos[$clave]['distribucion'][$key]['cantidad'] =
                        ($materialesUnicos[$clave]['distribucion'][$key]['cantidad'] ?? 0) + ($vals['cantidad'] ?? 0);
                    $materialesUnicos[$clave]['distribucion'][$key]['monto'] =
                        ($materialesUnicos[$clave]['distribucion'][$key]['monto']    ?? 0) + ($vals['monto']    ?? 0);
                }
            }
        }
        $materiales = array_values($materialesUnicos);

        $costoProject  = CostoProject::findOrFail($projectId);
        $db            = $costoProject->database_name;
        $presupuestoId = $costoProject->presupuesto_id ?? 2;

        DB::connection('mysql')->transaction(function () use ($db, $presupuestoId, $materiales) {
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
                        'monto'    => $values['monto']    ?? 0,
                    ];
                }

                $rows[] = [
                    'presupuesto_id'    => $presupuestoId,
                    'item_order'        => $idx + 1,
                    'descripcion'       => $mat['descripcion'],
                    'partida_origen'    => $mat['partida_origen'] ?? null,
                    'unidad'            => $mat['unidad'] ?? '',
                    'cantidad_total'    => $mat['cantidad_total'],
                    'precio_unitario'   => $mat['precio'],
                    'presupuesto_total' => $mat['costo_total'],
                    'distribucion_mensual' => json_encode($distribucionSimplificada),
                    'created_at'        => now(),
                    'updated_at'        => now(),
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

        $costoProject  = CostoProject::findOrFail($projectId);
        $db            = $costoProject->database_name;
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
     * Redondea una cantidad según la unidad de medida.
     * - Unidades contables (und, bol, pza…) → entero
     * - Unidades de volumen/área/longitud/masa → 3 decimales
     * - Resto → 2 decimales
     */
    private function redondearPorUnidad(float $cantidad, string $unidad): float
    {
        $unidad = strtolower(trim($unidad));

        $unidadesEnteras = [
            'und', 'pza', 'bol', 'pln', 'p²', 'p2', 'bal', 'cja', 'rll',
            'tub', 'var', 'par', 'jgo', 'set', 'kit', 'glb', 'gbl', 'mes',
            'día', 'dia', 'hor', 'hora', 'sem', 'semana', 'quin', 'quincena',
        ];

        $unidadesDecimales = [
            'm³', 'm3', 'm²', 'm2', 'm', 'km', 'kg', 'gln', 'gal', 'l',
            'lt', 't', 'tn', 'ml', 'cc', 'cm³', 'cm3', 'mm', 'ha', 'lb',
            'hh', 'hm', 'he',   // horas-hombre, horas-máquina, horas-equipo
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

        $totalMateriales  = count($materiales);
        $presupuestoTotal = array_sum(array_column($materiales, 'costo_total'));

        $clavesPeriodos = array_column($periodos, 'key');
        $mensualPorTipo = array_fill_keys($clavesPeriodos, 0.0);

        foreach ($materiales as $mat) {
            foreach ($clavesPeriodos as $key) {
                $mensualPorTipo[$key] += $mat['distribucion'][$key]['monto'] ?? 0;
            }
        }

        arsort($mensualPorTipo);
        $mesPicoKey = array_key_first($mensualPorTipo) ?? null;
        $montoPico  = $mensualPorTipo[$mesPicoKey]     ?? 0;

        $mesPicoLabel = null;
        foreach ($periodos as $p) {
            if ($p['key'] === $mesPicoKey) {
                $mesPicoLabel = $p['labelCal'];
                break;
            }
        }

        return [
            'total_materiales'  => $totalMateriales,
            'presupuesto_total' => round($presupuestoTotal, 2),
            'duracion_meses'    => count($periodos),
            'mes_pico'          => $mesPicoLabel,
            'mes_pico_key'      => $mesPicoKey,
            'monto_mes_pico'    => round($montoPico, 2),
            'total_partidas'    => $totalPartidas,
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