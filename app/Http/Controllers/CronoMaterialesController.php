<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CronoMaterialesController extends Controller
{
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (! $projectId) {
            abort(404, 'ID de proyecto no recibido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();
        $tasks = $this->loadGanttTasks($presupuestoId);

        if (empty($tasks)) {
            return $this->renderEmpty($projectId, $costoProject->nombre, true);
        }

        $parentIds = collect($tasks)->pluck('parent')->filter(fn ($parent) => $parent !== '0')->unique()->toArray();
        $leafTasks = collect($tasks)
            ->filter(fn ($task) => ! in_array($task['id'], $parentIds) && $task['item'] !== '')
            ->values()
            ->toArray();

        if (empty($leafTasks)) {
            return $this->renderEmpty($projectId, $costoProject->nombre, false);
        }

        $fechas = collect($leafTasks)->filter(fn ($task) => $task['start_date'] && $task['end_date']);
        $inicio = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->min(fn ($task) => $task['start_date']))->startOfMonth()
            : now()->startOfMonth();
        $fin = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->max(fn ($task) => $task['end_date']))->endOfMonth()
            : $inicio->copy()->addMonths(5)->endOfMonth();

        $periodos = $this->buildPeriodos($inicio, $fin);
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();
        $codigosPartidas = collect($leafTasks)->pluck('item')->unique()->filter()->map(fn ($item) => trim($item))->toArray();

        $tareasPorPartida = collect($leafTasks)->keyBy(fn ($task) => trim($task['item']));
        $materialesFinales = $this->buildAcuResources(
            $presupuestoId,
            $codigosPartidas,
            $tareasPorPartida,
            $clavesPeriodos,
        );

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'materiales' => $materialesFinales->toArray(),
            'periodos' => $periodos,
            'resumen' => $this->calcularResumenActual($materialesFinales, $periodos, $leafTasks),
            'estaGuardado' => $estaGuardado,
            'sinGantt' => false,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|integer',
            'materiales' => 'required|array',
        ]);

        $projectId = (int) $request->input('project_id');
        $materiales = $request->input('materiales');
        $costoProject = CostoProject::findOrFail($projectId);

        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        DB::connection('costos_tenant')->transaction(function () use ($presupuestoId, $materiales) {
            DB::connection('costos_tenant')
                ->table('cronograma_materiales')
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $rows = [];
            foreach ($materiales as $idx => $material) {
                $rows[] = [
                    'presupuesto_id' => $presupuestoId,
                    'item_order' => $idx + 1,
                    'descripcion' => $material['descripcion'],
                    'unidad' => $material['unidad'] ?? '',
                    'cantidad_total' => $material['cantidad_total'],
                    'precio_unitario' => $material['precio'],
                    'presupuesto_total' => $material['costo_total'] ?? $material['presupuesto'],
                    'distribucion_mensual' => json_encode($material['distribucion'] ?? $material['mensual']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            foreach (array_chunk($rows, 200) as $chunk) {
                DB::connection('costos_tenant')->table('cronograma_materiales')->insert($chunk);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Cronograma de materiales guardado correctamente.',
            'total' => count($materiales),
        ]);
    }

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
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Se eliminaron {$deleted} registros del cronograma de materiales.",
        ]);
    }

    private function renderEmpty(int $projectId, string $projectName, bool $sinGantt)
    {
        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string) $projectId,
            'projectName' => $projectName,
            'materiales' => [],
            'periodos' => [],
            'resumen' => $this->resumenVacio(),
            'estaGuardado' => false,
            'sinGantt' => $sinGantt,
        ]);
    }

    private function buildPeriodos(Carbon $inicio, Carbon $fin): array
    {
        $periodos = [];
        $cursor = $inicio->copy();

        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label' => ucfirst($cursor->translatedFormat('M Y')),
                'key' => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
        }

        return $periodos;
    }

    private function activeMonths(?array $tarea, array $clavesPeriodos): array
    {
        if (! $tarea || ! $tarea['start_date'] || ! $tarea['end_date']) {
            return [];
        }

        $inicio = Carbon::parse($tarea['start_date'])->startOfMonth();
        $fin = Carbon::parse($tarea['end_date'])->endOfMonth();

        return array_values(array_filter($clavesPeriodos, function ($key) use ($inicio, $fin) {
            return Carbon::parse("{$key}-01")->between($inicio, $fin);
        }));
    }

    private function buildAcuResources(
        int $presupuestoId,
        array $codigosPartidas,
        Collection $tareasPorPartida,
        array $clavesPeriodos,
    ): Collection {
        $service = app(CostoDatabaseService::class);
        $codigosNormalizados = collect($codigosPartidas)
            ->map(fn ($codigo) => $service->normalizePartidaCode($codigo))
            ->flip();
        $tareasNormalizadas = $tareasPorPartida->mapWithKeys(
            fn ($tarea, $codigo) => [$service->normalizePartidaCode($codigo) => $tarea]
        );
        $metrados = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', 'metrado'])
            ->mapWithKeys(fn ($fila) => [
                $service->normalizePartidaCode($fila->partida) => (float) $fila->metrado,
            ]);

        $tablas = [
            'mano_de_obra' => ['tabla' => 'acu_mano_de_obra', 'precio' => 'precio_unitario'],
            'materiales' => ['tabla' => 'acu_materiales', 'precio' => 'precio_unitario'],
            'equipos' => ['tabla' => 'acu_equipos', 'precio' => 'precio_hora'],
            'subcontratos' => ['tabla' => 'acu_subcontratos', 'precio' => 'precio_unitario'],
            'subpartidas' => ['tabla' => 'acu_subpartidas', 'precio' => 'precio_unitario'],
        ];
        $consolidados = [];

        foreach ($tablas as $tipo => $config) {
            $filas = DB::connection('costos_tenant')
                ->table($config['tabla'].' as recurso')
                ->join('presupuesto_acus as acu', 'acu.id', '=', 'recurso.acu_id')
                ->where('acu.presupuesto_id', $presupuestoId)
                ->select([
                    'acu.partida',
                    'recurso.descripcion',
                    'recurso.unidad',
                    'recurso.cantidad',
                    DB::raw('recurso.'.$config['precio'].' as precio'),
                    DB::raw($tipo === 'materiales' ? 'recurso.factor_desperdicio' : '1 as factor_desperdicio'),
                ])
                ->get();

            foreach ($filas as $fila) {
                $codigo = $service->normalizePartidaCode($fila->partida);
                if (! $codigosNormalizados->has($codigo)) {
                    continue;
                }

                $precio = (float) $fila->precio;
                $cantidad = (float) $fila->cantidad * (float) ($fila->factor_desperdicio ?? 1) * ($metrados[$codigo] ?? 0);
                if ($cantidad <= 0 || $precio < 0) {
                    continue;
                }

                $clave = implode('|', [$tipo, trim($fila->descripcion), trim($fila->unidad), (string) $precio]);
                if (! isset($consolidados[$clave])) {
                    $consolidados[$clave] = [
                        'partida_origen' => trim($fila->partida),
                        'descripcion_partida' => '',
                        'descripcion' => trim($fila->descripcion),
                        'unidad' => trim($fila->unidad),
                        'tipo' => $tipo,
                        'precio' => $precio,
                        'cantidad_total' => 0.0,
                        'costo_total' => 0.0,
                        'distribucion' => array_fill_keys($clavesPeriodos, ['cantidad' => 0.0, 'monto' => 0.0]),
                    ];
                }

                $costo = $cantidad * $precio;
                $consolidados[$clave]['cantidad_total'] += $cantidad;
                $consolidados[$clave]['costo_total'] += $costo;
                $meses = $this->activeMonths($tareasNormalizadas->get($codigo), $clavesPeriodos);
                $meses = empty($meses) ? [$clavesPeriodos[0]] : $meses;

                foreach ($meses as $mes) {
                    $consolidados[$clave]['distribucion'][$mes]['cantidad'] += $cantidad / count($meses);
                    $consolidados[$clave]['distribucion'][$mes]['monto'] += $costo / count($meses);
                }
            }
        }

        return collect($consolidados)
            ->map(function (array $recurso) {
                $recurso['cantidad_total'] = round($recurso['cantidad_total'], 4);
                $recurso['costo_total'] = round($recurso['costo_total'], 2);
                $recurso['distribucion'] = array_map(fn (array $valor) => [
                    'cantidad' => round($valor['cantidad'], 4),
                    'monto' => round($valor['monto'], 2),
                ], $recurso['distribucion']);

                return $recurso;
            })
            ->sortBy([['tipo', 'asc'], ['descripcion', 'asc']])
            ->values();
    }

    private function calcularResumenActual(Collection $materiales, array $periodos, array $leafTasks): array
    {
        $acumuladoMensual = [];
        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = $materiales->sum(
                fn ($material) => $material['distribucion'][$periodo['key']]['monto'] ?? 0
            );
        }
        arsort($acumuladoMensual);

        return [
            'total_materiales' => $materiales->count(),
            'presupuesto_total' => round($materiales->sum('costo_total'), 2),
            'duracion_meses' => count($periodos),
            'mes_pico' => array_key_first($acumuladoMensual),
            'mes_pico_key' => array_key_first($acumuladoMensual),
            'monto_mes_pico' => round(reset($acumuladoMensual) ?: 0, 2),
            'total_partidas' => count($leafTasks),
        ];
    }

    private function calcularResumen(array $materiales, array $periodos, array $leafTasks): array
    {
        $acumuladoMensual = [];
        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = array_sum(array_map(
                fn ($material) => ($material['mensual'][$periodo['key']] ?? 0) * $material['precio'],
                $materiales
            ));
        }

        arsort($acumuladoMensual);
        $mesPico = array_key_first($acumuladoMensual);

        return [
            'total_materiales' => count($materiales),
            'presupuesto_total' => round(array_sum(array_column($materiales, 'presupuesto')), 2),
            'duracion_meses' => count($periodos),
            'mes_pico' => $mesPico,
            'monto_mes_pico' => round($acumuladoMensual[$mesPico] ?? 0, 2),
            'total_partidas' => count($leafTasks),
        ];
    }

    private function resumenVacio(): array
    {
        return [
            'total_materiales' => 0,
            'presupuesto_total' => 0,
            'duracion_meses' => 0,
            'mes_pico' => null,
            'monto_mes_pico' => 0,
            'total_partidas' => 0,
        ];
    }

    private function loadGanttTasks(int $presupuestoId): array
    {
        $records = DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get();

        if ($records->isEmpty()) {
            return [];
        }

        return $records
            ->map(fn ($row) => [
                'id' => (string) ($row->id),
                'item' => trim((string) ($row->partida ?? '')),
                'parent' => (string) ($row->parent_id ?? '0'),
                'start_date' => $row->fecha_inicio,
                'end_date' => $row->fecha_fin,
                'cost' => 0.0, // Se puede obtener de presupuesto_general si se desea
            ])
            ->filter(fn ($task) => $task['id'] !== '')
            ->values()
            ->toArray();
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
     * Obtiene los datos de materiales en formato JSON para ser consumido desde el frontend
     * (para la vista integrada de Valorizado)
     */
    public function getData(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (! $projectId) {
            return response()->json(['error' => 'ID de proyecto no recibido'], 422);
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();
        $tasks = $this->loadGanttTasks($presupuestoId);

        if (empty($tasks)) {
            return response()->json([
                'materiales' => [],
                'periodos' => [],
                'resumen' => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt' => true,
            ]);
        }

        $parentIds = collect($tasks)->pluck('parent')->filter(fn ($parent) => $parent !== '0')->unique()->toArray();
        $leafTasks = collect($tasks)
            ->filter(fn ($task) => ! in_array($task['id'], $parentIds) && $task['item'] !== '')
            ->values()
            ->toArray();

        if (empty($leafTasks)) {
            return response()->json([
                'materiales' => [],
                'periodos' => [],
                'resumen' => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt' => false,
            ]);
        }

        $fechas = collect($leafTasks)->filter(fn ($task) => $task['start_date'] && $task['end_date']);
        $inicio = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->min(fn ($task) => $task['start_date']))->startOfMonth()
            : now()->startOfMonth();
        $fin = $fechas->isNotEmpty()
            ? Carbon::parse($fechas->max(fn ($task) => $task['end_date']))->endOfMonth()
            : $inicio->copy()->addMonths(5)->endOfMonth();

        $periodos = $this->buildPeriodos($inicio, $fin);
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();
        $codigosPartidas = collect($leafTasks)->pluck('item')->unique()->filter()->map(fn ($item) => trim($item))->toArray();

        $tareasPorPartida = collect($leafTasks)->keyBy(fn ($task) => trim($task['item']));
        $materialesFinales = $this->buildAcuResources(
            $presupuestoId,
            $codigosPartidas,
            $tareasPorPartida,
            $clavesPeriodos,
        );

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

        // Calcular mes pico para el resumen
        $acumuladoMensual = [];
        foreach ($periodos as $periodo) {
            $acumuladoMensual[$periodo['key']] = array_sum(array_map(
                fn ($material) => $material['distribucion'][$periodo['key']]['monto'] ?? 0,
                $materialesFinales->toArray()
            ));
        }
        arsort($acumuladoMensual);
        $mesPicoKey = array_key_first($acumuladoMensual);
        $mesPicoLabel = '';
        foreach ($periodos as $p) {
            if ($p['key'] === $mesPicoKey) {
                $mesPicoLabel = $p['label'];
                break;
            }
        }

        return response()->json([
            'materiales' => $materialesFinales->toArray(),
            'periodos' => $periodos,
            'resumen' => [
                'total_materiales' => $materialesFinales->count(),
                'presupuesto_total' => round($materialesFinales->sum('costo_total'), 2),
                'duracion_meses' => count($periodos),
                'mes_pico' => $mesPicoLabel,
                'mes_pico_key' => $mesPicoKey,
                'monto_mes_pico' => round($acumuladoMensual[$mesPicoKey] ?? 0, 2),
                'total_partidas' => count($leafTasks),
            ],
            'estaGuardado' => $estaGuardado,
            'sinGantt' => false,
        ]);
    }

    /**
     * Determina el tipo de material basado en la descripción
     */
    private function determinarTipoMaterial(string $descripcion): string
    {
        $descripcionLower = strtolower($descripcion);

        if (str_contains($descripcionLower, 'mano') || str_contains($descripcionLower, 'obra')) {
            return 'mano_de_obra';
        }
        if (str_contains($descripcionLower, 'equipo') || str_contains($descripcionLower, 'maquinaria')) {
            return 'equipos';
        }
        if (str_contains($descripcionLower, 'subcontrato')) {
            return 'subcontratos';
        }
        if (str_contains($descripcionLower, 'subpartida')) {
            return 'subpartidas';
        }

        return 'materiales';
    }
}
