<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class CronoValorizadoController extends Controller
{
    private const MAX_PERIODOS = 30;

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTANTES de modo de cálculo
    // ─────────────────────────────────────────────────────────────────────────
    const MODO_CALENDARIO = 'calendario'; // Corte último día de mes (Regla de Ejecución)

    const MODO_30_DIAS = '30dias';     // Bloques exactos de 30 días (Regla de Inicialización)

    public function __construct(private readonly CostoDatabaseService $dbService) {}

    // ─────────────────────────────────────────────────────────────────────────
    // INDEX — Cruza Cronograma General + presupuesto_general para calcular el valorizado
    // ─────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        $modoCalculo = $request->query('modo', self::MODO_CALENDARIO);

        if (! $projectId) {
            abort(404, 'ID de proyecto no recibido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();
        $finDefaults = $this->resolveFinDefaults($presupuestoId);

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

        // ── 1. Leer presupuesto_general (TODAS las partidas con metrado > 0) ──
        $presupuesto = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->where('metrado', '>', 0)
            ->orderBy('item_order')
            ->get()
            ->keyBy(fn ($p) => trim($p->partida ?? ''));

        $jerarquiaPresupuesto = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->orderBy('item_order')
            ->get(['partida', 'descripcion'])
            ->mapWithKeys(fn ($p) => [trim($p->partida ?? '') => $p->descripcion ?? ''])
            ->filter(fn ($descripcion, $partida) => $partida !== '' && $descripcion !== '');

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
                'jerarquiaPresupuesto' => [],
                'materiales' => [],
                'materialesResumen' => $this->materialesResumenVacio(),
                'projectData' => $projectData,
                'finDefaults' => $finDefaults,
            ]);
        }

        // ── 2. Fechas reales del Cronograma General (no las del proyecto) ──────
        // El rango de meses del valorizado debe salir de lo que el usuario
        // programó en Cronograma General (fecha_inicio/fecha_fin por partida),
        // no de costo_projects.fecha_inicio/fecha_fin — esas son las fechas
        // "marco" del proyecto y casi siempre cubren un rango mucho más largo
        // que la duración real programada (ver nota en el chat: 60 días
        // programados mostraban 7 meses porque antes se usaba el rango del
        // proyecto completo).
        $cronoPorPartida = $this->resolveCronoPorPartida($presupuestoId);
        $fechasProgramadas = $cronoPorPartida->filter(
            fn ($c) => ! empty($c->fecha_inicio) && ! empty($c->fecha_fin)
        );

        if ($fechasProgramadas->isNotEmpty()) {
            $inicio = Carbon::parse($fechasProgramadas->min('fecha_inicio'))->startOfMonth();
            $fin = Carbon::parse($fechasProgramadas->max('fecha_fin'))->endOfMonth();
        } else {
            $inicio = $costoProject->fecha_inicio
                ? Carbon::parse($costoProject->fecha_inicio)->startOfMonth()
                : now()->startOfMonth();
            $fin = $costoProject->fecha_fin
                ? Carbon::parse($costoProject->fecha_fin)->endOfMonth()
                : $inicio->copy()->addMonths(5);
        }

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

        // ── 4. Leer valorizado guardado (edición manual / redistribución previa) ──
        $valorizadoGuardado = DB::connection('costos_tenant')
            ->table('cronograma_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->get()
            ->keyBy(fn ($v) => trim($v->partida ?? ''));

        $estaGuardado = $valorizadoGuardado->isNotEmpty();

        // ── 5. Construir la lista de items desde presupuesto_general ───────
        $allItems = [];
        $totalPresupuesto = 0.0;

        foreach ($presupuesto as $pItem) {
            $partida = trim($pItem->partida ?? '');
            $parcial = (float) ($pItem->parcial ?? 0);
            $metrado = (float) ($pItem->metrado ?? 0);
            $precio = (float) ($pItem->precio_unitario ?? 0);

            $crono = $cronoPorPartida->get($partida);
            $fechaInicioItem = $crono->fecha_inicio ?? null;
            $fechaFinItem = $crono->fecha_fin ?? null;

            $valRow = $valorizadoGuardado->get($partida);
            if ($valRow) {
                // El usuario ya guardó/editó manualmente esta distribución — se respeta.
                $distribucion = $this->normalizarDistribucionMensual(
                    json_decode($valRow->distribucion_mensual, true) ?? [],
                    $periodos,
                    $parcial
                );
            } elseif ($fechaInicioItem && $fechaFinItem && $parcial > 0) {
                // Prorrateo real según las fechas de ESTA partida en Cronograma General.
                $distribucion = $this->distribuir(
                    $parcial, $fechaInicioItem, $fechaFinItem,
                    $clavesPeriodos, $periodos, $modoCalculo
                );
            } else {
                // Partida sin programar aún — reparto uniforme como respaldo.
                $distribucion = $this->distribucionUniforme($parcial, $periodos);
            }

            $allItems[] = [
                'id' => (string) $pItem->id,
                'item' => $partida,
                'descripcion' => $pItem->descripcion ?? '',
                'und' => $pItem->unidad ?? '',
                'metrado' => $metrado,
                'precio' => $precio,
                'parcial' => $parcial,
                'is_leaf' => true,
                'distribucion' => $distribucion,
                'parent_id' => '0',
                'start_date' => $fechaInicioItem,
                'end_date' => $fechaFinItem,
            ];

            $totalPresupuesto += $parcial;
        }

        $resumen = $this->calcularResumen($allItems, $periodos, $totalPresupuesto);

        // ── 6. Materiales / mano de obra / equipos / subcontratos / subpartidas ──
        // desde los ACUs, distribuidos por las mismas fechas de Cronograma General.
        try {
            [$materialesFormateados, $materialesResumen] = $this->construirMaterialesDesdeAcus(
                $presupuestoId, $presupuesto, $cronoPorPartida, $periodos, $clavesPeriodos, $modoCalculo
            );
        } catch (\Throwable $e) {
            Log::error('Error generando materiales desde ACU: '.$e->getMessage());
            $materialesFormateados = collect([]);
            $materialesResumen = $this->materialesResumenVacio(count($periodos));
        }

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
            'jerarquiaPresupuesto' => $jerarquiaPresupuesto->toArray(),
            'materiales' => $materialesFormateados->toArray(),
            'materialesResumen' => $materialesResumen,
            'projectData' => $projectData,
            'finDefaults' => $finDefaults,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STORE — Guarda la distribución mensual editada/redistribuida por el usuario
    // ─────────────────────────────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => 'required',
            'items' => 'required|array',
        ]);

        try {
            $costoProject = CostoProject::findOrFail($request->input('project_id'));
            $this->dbService->setTenantConnection($costoProject->database_name);
            $presupuestoId = $this->resolvePresupuestoId();

            DB::connection('costos_tenant')->beginTransaction();

            DB::connection('costos_tenant')
                ->table('cronograma_valorizado')
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $insertData = [];
            foreach ($request->input('items') as $index => $item) {
                $partida = trim((string) ($item['item'] ?? ''));
                if ($partida === '') {
                    continue;
                }

                $parentIdRaw = $item['parent_id'] ?? null;
                $parentId = (is_numeric($parentIdRaw) && (int) $parentIdRaw > 0)
                    ? (int) $parentIdRaw
                    : null;

                $insertData[] = [
                    'presupuesto_id' => $presupuestoId,
                    'item_order' => $index + 1,
                    'partida' => $partida,
                    'descripcion' => $item['descripcion'] ?? '',
                    'presupuesto_total' => (float) ($item['parcial'] ?? 0),
                    'distribucion_mensual' => json_encode($item['distribucion'] ?? []),
                    'parent_id' => $parentId,
                    'nivel' => substr_count($partida, '.') + 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            foreach (array_chunk($insertData, 500) as $chunk) {
                DB::connection('costos_tenant')->table('cronograma_valorizado')->insert($chunk);
            }

            DB::connection('costos_tenant')->commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Cronograma valorizado guardado correctamente.',
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Error al guardar: '.$e->getMessage(),
            ], 500);
        }
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
        $this->dbService->setTenantConnection($costoProject->database_name);
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

    // =========================================================================
    // GENERADORES DE PERÍODOS
    // =========================================================================

    /**
     * REGLA DE EJECUCIÓN: Cortes al último día de cada mes calendario.
     */
    private function generarPeriodosCalendario($inicio, $fin): array
    {
        if ($inicio instanceof CarbonImmutable) {
            $inicio = Carbon::createFromImmutable($inicio);
        }
        if ($fin instanceof CarbonImmutable) {
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

    private function distribucionUniforme(float $parcial, array $periodos): array
    {
        $countPeriodos = count($periodos);
        $distribucion = [];

        foreach ($periodos as $periodo) {
            $distribucion[$periodo['key']] = [
                'monto' => $parcial > 0 && $countPeriodos > 0 ? round($parcial / $countPeriodos, 2) : 0.0,
                'porcentaje' => $parcial > 0 && $countPeriodos > 0 ? round((1 / $countPeriodos) * 100, 6) : 0.0,
            ];
        }

        return $distribucion;
    }

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

        if ($inicio->eq($fin)) {
            $key = $inicio->format('Y-m');
            if (isset($distribucion[$key])) {
                $distribucion[$key] = ['monto' => $parcial, 'porcentaje' => 100.0];
            }

            return $distribucion;
        }

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

            $solapeInicio = $inicio->gt($pInicio) ? $inicio : $pInicio;
            $solapeFin = $fin->lt($pFin) ? $fin : $pFin;

            if ($solapeInicio->lte($solapeFin)) {
                $diasPorPeriodo[$p['key']] = $solapeInicio->diffInDays($solapeFin) + 1;
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
    // MATERIALES / MANO DE OBRA / EQUIPOS / SUBCONTRATOS / SUBPARTIDAS
    // =========================================================================

    /**
     * Consolida los 5 tipos de recursos de los ACUs (acu_mano_de_obra,
     * acu_materiales, acu_equipos, acu_subcontratos, acu_subpartidas),
     * multiplicados por el metrado de su partida, y distribuidos en el
     * tiempo con las mismas fechas de Cronograma General que usa el
     * valorizado (o reparto uniforme si la partida no está programada).
     *
     * Las tablas de recursos no tienen columna `partida` propia — cuelgan de
     * `presupuesto_acus` via `acu_id`, y `presupuesto_acus.partida` puede
     * traer distinto padding de ceros que presupuesto_general.partida (ver
     * CostoDatabaseService::normalizePartidaCode()), así que el cruce con
     * presupuesto/cronograma se hace por código normalizado, no por igualdad
     * exacta de string.
     *
     * @return array{0: Collection, 1: array}
     */
    private function construirMaterialesDesdeAcus(
        int $presupuestoId,
        Collection $presupuesto,
        Collection $cronoPorPartida,
        array $periodos,
        array $clavesPeriodos,
        string $modo
    ): array {
        $presupuestoPorCodigoNormalizado = $presupuesto->mapWithKeys(
            fn ($p, $partida) => [$this->dbService->normalizePartidaCode($partida) => $p]
        );
        $cronoPorCodigoNormalizado = $cronoPorPartida->mapWithKeys(
            fn ($c, $partida) => [$this->dbService->normalizePartidaCode($partida) => $c]
        );

        $tablasPorTipo = [
            'mano_de_obra' => 'acu_mano_de_obra',
            'materiales' => 'acu_materiales',
            'equipos' => 'acu_equipos',
            'subcontratos' => 'acu_subcontratos',
            'subpartidas' => 'acu_subpartidas',
        ];

        $consolidados = [];
        $acumuladoMensual = array_fill_keys($clavesPeriodos, 0.0);
        $presupuestoTotal = 0.0;

        foreach ($tablasPorTipo as $tipo => $tabla) {
            $rows = DB::connection('costos_tenant')
                ->table($tabla.' as r')
                ->join('presupuesto_acus as pa', 'pa.id', '=', 'r.acu_id')
                ->where('pa.presupuesto_id', $presupuestoId)
                ->select('r.*', 'pa.partida as partida')
                ->get();

            foreach ($rows as $item) {
                $codigoNormalizado = $this->dbService->normalizePartidaCode(trim($item->partida ?? ''));
                $presupuestoItem = $presupuestoPorCodigoNormalizado->get($codigoNormalizado);
                $metrado = $presupuestoItem ? (float) ($presupuestoItem->metrado ?? 0) : 0.0;
                if ($metrado <= 0) {
                    continue;
                }

                $unidad = $item->unidad ?? '';
                $cantidad = (float) ($item->cantidad ?? 0);
                $precio = (float) ($item->precio_unitario ?? $item->precio_hora ?? 0);
                $factor = (float) ($item->factor_desperdicio ?? 1);
                $descripcion = $item->descripcion ?? 'Sin descripción';

                if ($cantidad <= 0 || $precio <= 0) {
                    continue;
                }

                $cantidadTotal = $cantidad * $factor * $metrado;
                $costoTotal = $cantidadTotal * $precio;
                if ($cantidadTotal <= 0) {
                    continue;
                }

                $crono = $cronoPorCodigoNormalizado->get($codigoNormalizado);
                $distribucionMonto = ($crono && $crono->fecha_inicio && $crono->fecha_fin)
                    ? $this->distribuir($costoTotal, $crono->fecha_inicio, $crono->fecha_fin, $clavesPeriodos, $periodos, $modo)
                    : null;

                $clave = $tipo.'|'.$descripcion.'|'.$unidad;
                if (! isset($consolidados[$clave])) {
                    $distInicial = [];
                    foreach ($periodos as $periodo) {
                        $distInicial[$periodo['key']] = ['cantidad' => 0.0, 'monto' => 0.0];
                    }
                    $consolidados[$clave] = [
                        'partida_origen' => trim($item->partida ?? ''),
                        'descripcion_partida' => '',
                        'descripcion' => $descripcion,
                        'unidad' => $unidad,
                        'tipo' => $tipo,
                        'precio' => round($precio, 2),
                        'cantidad_total' => 0.0,
                        'costo_total' => 0.0,
                        'distribucion' => $distInicial,
                    ];
                }

                $consolidados[$clave]['cantidad_total'] += $cantidadTotal;
                $consolidados[$clave]['costo_total'] += $costoTotal;

                foreach ($periodos as $periodo) {
                    $key = $periodo['key'];
                    if ($distribucionMonto !== null) {
                        $montoMes = $distribucionMonto[$key]['monto'] ?? 0.0;
                    } else {
                        $montoMes = count($periodos) > 0 ? $costoTotal / count($periodos) : 0.0;
                    }
                    $cantidadMes = $costoTotal > 0 ? $cantidadTotal * ($montoMes / $costoTotal) : 0.0;

                    $consolidados[$clave]['distribucion'][$key]['cantidad'] += round($cantidadMes, 4);
                    $consolidados[$clave]['distribucion'][$key]['monto'] += round($montoMes, 2);
                    $acumuladoMensual[$key] += $montoMes;
                }

                $presupuestoTotal += $costoTotal;
            }
        }

        $materialesFormateados = collect(array_values($consolidados))
            ->map(function ($m) {
                $m['cantidad_total'] = round($m['cantidad_total'], 4);
                $m['costo_total'] = round($m['costo_total'], 2);

                return $m;
            });

        $mesPicoKey = '';
        $mesPicoMonto = 0.0;
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

        $resumen = [
            'total_materiales' => $materialesFormateados->count(),
            'presupuesto_total' => round($presupuestoTotal, 2),
            'duracion_meses' => count($periodos),
            'total_partidas' => $materialesFormateados->count(),
            'mes_pico' => $mesPicoLabel,
            'mes_pico_key' => $mesPicoKey,
            'monto_mes_pico' => round($mesPicoMonto, 2),
        ];

        return [$materialesFormateados, $resumen];
    }

    private function materialesResumenVacio(int $duracionMeses = 0): array
    {
        return [
            'total_materiales' => 0,
            'presupuesto_total' => 0,
            'duracion_meses' => $duracionMeses,
            'total_partidas' => 0,
            'mes_pico' => null,
            'mes_pico_key' => null,
            'monto_mes_pico' => 0,
        ];
    }

    // =========================================================================
    // HELPERS PRIVADOS
    // =========================================================================

    private function resolveCronoPorPartida(int $presupuestoId): Collection
    {
        return DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', 'fecha_inicio', 'fecha_fin'])
            ->keyBy(fn ($r) => trim($r->partida ?? ''));
    }

    private function validarLimitePeriodos(array $periodos): void
    {
        if (count($periodos) > self::MAX_PERIODOS) {
            abort(422, 'El cronograma valorizado admite como máximo '.self::MAX_PERIODOS.' periodos.');
        }
    }

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

    /**
     * Porcentajes/montos reales del presupuesto (tabla gg_consolidado), para
     * usarlos como valor inicial del Resumen Financiero del valorizado —
     * antes esa sección arrancaba siempre con placeholders fijos (11.56% GG,
     * 5% Utilidad) sin relación con lo que el proyecto tiene realmente
     * configurado en Presupuesto/Delphin (ej. 10%/10%), así que el
     * "Presupuesto Total" del valorizado no coincidía con el real hasta que
     * alguien lo corregía a mano en cada carga de página.
     *
     * Misma fuente y mismo criterio que DelphinController::resumenPresupuesto():
     * gg_consolidado tiene prioridad (snapshot guardado por el usuario), con
     * fallback al desagregado de gg_fijos/gg_variables si no hay override de
     * gastos generales. Los % siguen siendo editables en la tabla (PctCell/
     * MontoCell) — esto solo evita arrancar con un valor que no es el real.
     */
    private function resolveFinDefaults(int $presupuestoId): array
    {
        $connection = DB::connection('costos_tenant');

        $snapshot = $connection->table('gg_consolidado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();

        $costoDirecto = (float) $connection->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->where('metrado', '>', 0)
            ->sum('parcial');

        $gastosGeneralesDetalle = (float) $connection->table('gg_fijos')
            ->where('presupuesto_id', $presupuestoId)
            ->where('tipo_fila', 'detalle')
            ->sum('parcial')
            + (float) $connection->table('gg_variables')
                ->where('presupuesto_id', $presupuestoId)
                ->where('tipo_fila', 'detalle')
                ->sum('parcial');

        $gastosGeneralesOverride = $snapshot?->gastos_generales_porcentaje ?? null;
        $gastosGenerales = $gastosGeneralesOverride !== null
            ? $costoDirecto * ((float) $gastosGeneralesOverride / 100)
            : $gastosGeneralesDetalle;

        $supervisionTotal = (float) ($snapshot?->total_supervision ?? 0);

        return [
            'pctGastosGenerales' => $costoDirecto > 0
                ? round(($gastosGenerales / $costoDirecto) * 100, 4)
                : 0.0,
            'pctUtilidad' => (float) ($snapshot?->utilidad_porcentaje ?? 5),
            'pctIGV' => (float) ($snapshot?->igv_porcentaje ?? 18),
            'montoMobiliario' => (float) ($snapshot?->componente_ii_monto ?? 0),
            'pctIGVMobiliario' => (float) ($snapshot?->igv_porcentaje ?? 18),
            'pctSupervision' => $costoDirecto > 0
                ? round(($supervisionTotal / $costoDirecto) * 100, 4)
                : 0.0,
        ];
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
}
