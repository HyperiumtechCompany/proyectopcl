<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Services\CostoDatabaseService;

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

        // ✅ 1. Obtener todos los ACUs
        $acus = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->get();

        if ($acus->isEmpty()) {
            return $this->renderEmpty($projectId, $costoProject->nombre, false);
        }

        // ✅ 2. Obtener metrados desde presupuesto_general
        $metradosPorPartida = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->get()
            ->keyBy(fn ($row) => trim($row->partida ?? ''));

        // ✅ 3. Extraer materiales del JSON de cada ACU
        $materialesApu = collect();
        foreach ($acus as $acu) {
            $partida = trim($acu->partida);
            
            // Procesar materiales
            if ($acu->materiales) {
                $items = json_decode($acu->materiales, true);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $materialesApu->push((object) [
                            'partida' => $partida,
                            'descripcion' => $item['descripcion'] ?? '',
                            'unidad' => $item['unidad'] ?? '',
                            'precio' => (float) ($item['precio'] ?? 0),
                            'cantidad' => (float) ($item['cantidad'] ?? 0),
                            'factor_desperdicio' => (float) ($item['factor_desperdicio'] ?? 1),
                        ]);
                    }
                }
            }
            
            // Procesar mano de obra
            if ($acu->mano_de_obra) {
                $items = json_decode($acu->mano_de_obra, true);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $materialesApu->push((object) [
                            'partida' => $partida,
                            'descripcion' => $item['descripcion'] ?? '',
                            'unidad' => $item['unidad'] ?? '',
                            'precio' => (float) ($item['precio'] ?? 0),
                            'cantidad' => (float) ($item['cantidad'] ?? 0),
                            'factor_desperdicio' => 1,
                        ]);
                    }
                }
            }
            
            // Procesar equipos
            if ($acu->equipos) {
                $items = json_decode($acu->equipos, true);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $materialesApu->push((object) [
                            'partida' => $partida,
                            'descripcion' => $item['descripcion'] ?? '',
                            'unidad' => $item['unidad'] ?? '',
                            'precio' => (float) ($item['precio'] ?? 0),
                            'cantidad' => (float) ($item['cantidad'] ?? 0),
                            'factor_desperdicio' => 1,
                        ]);
                    }
                }
            }
            
            // Procesar subcontratos
            if ($acu->subcontratos) {
                $items = json_decode($acu->subcontratos, true);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $materialesApu->push((object) [
                            'partida' => $partida,
                            'descripcion' => $item['descripcion'] ?? '',
                            'unidad' => $item['unidad'] ?? '',
                            'precio' => (float) ($item['precio'] ?? 0),
                            'cantidad' => (float) ($item['cantidad'] ?? 0),
                            'factor_desperdicio' => 1,
                        ]);
                    }
                }
            }
            
            // Procesar subpartidas
            if ($acu->subpartidas) {
                $items = json_decode($acu->subpartidas, true);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $materialesApu->push((object) [
                            'partida' => $partida,
                            'descripcion' => $item['descripcion'] ?? '',
                            'unidad' => $item['unidad'] ?? '',
                            'precio' => (float) ($item['precio'] ?? 0),
                            'cantidad' => (float) ($item['cantidad'] ?? 0),
                            'factor_desperdicio' => 1,
                        ]);
                    }
                }
            }
        }

        if ($materialesApu->isEmpty()) {
            return $this->renderEmpty($projectId, $costoProject->nombre, false);
        }

    
        $inicio = Carbon::now()->startOfYear();
        $fin = Carbon::now()->endOfYear();
        $periodos = $this->buildPeriodos($inicio, $fin);
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();

        // ✅ 5. Procesar materiales agrupados por descripción
        $materialesFinales = $materialesApu
            ->groupBy('descripcion')
            ->map(function ($filas, $descripcion) use ($metradosPorPartida, $clavesPeriodos) {
                $primerFila = $filas->first();
                $mensual = array_fill_keys($clavesPeriodos, 0.0);
                $cantidadTotal = 0.0;
                $costoTotal = 0.0;

                foreach ($filas as $fila) {
                    $partida = trim($fila->partida);
                    $metrado = $metradosPorPartida->get($partida)?->metrado ?? 0;

                    $cantidadPartida = (float) ($fila->cantidad * $fila->factor_desperdicio * $metrado);
                    $costoPartida = $cantidadPartida * $fila->precio;

                    $cantidadTotal += $cantidadPartida;
                    $costoTotal += $costoPartida;

                    // Distribuir uniformemente en todos los meses
                    $meses = count($clavesPeriodos);
                    $distribucion = $meses > 0 ? $cantidadPartida / $meses : 0;

                    foreach ($clavesPeriodos as $key) {
                        $mensual[$key] += $distribucion;
                    }
                }

                return [
                    'descripcion' => $descripcion,
                    'unidad' => $primerFila->unidad,
                    'precio' => (float) $primerFila->precio,
                    'cantidad_total' => round($cantidadTotal, 4),
                    'presupuesto' => round($costoTotal, 2),
                    'mensual' => array_map(fn ($value) => round($value, 4), $mensual),
                ];
            })
            ->filter(fn ($material) => $material['cantidad_total'] > 0)
            ->sortBy('descripcion')
            ->values();

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'materiales' => $materialesFinales->toArray(),
            'periodos' => $periodos,
            'resumen' => $this->calcularResumen($materialesFinales->toArray(), $periodos),
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
                    'presupuesto_total' => $material['presupuesto'],
                    'distribucion_mensual' => json_encode($material['mensual']),
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

    public function getData(Request $request)
    {
        $projectId = (int) $request->query('project');
        if (! $projectId) {
            return response()->json(['error' => 'ID de proyecto no recibido'], 422);
        }

        $costoProject = CostoProject::findOrFail($projectId);
        app(CostoDatabaseService::class)->setTenantConnection($costoProject->database_name);

        $presupuestoId = $this->resolvePresupuestoId();

        // Misma lógica que index() pero devolviendo JSON
        $acus = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->get();

        if ($acus->isEmpty()) {
            return response()->json([
                'materiales' => [],
                'periodos' => [],
                'resumen' => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt' => false,
            ]);
        }

        $metradosPorPartida = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->get()
            ->keyBy(fn ($row) => trim($row->partida ?? ''));

        $materialesApu = collect();
        foreach ($acus as $acu) {
            $partida = trim($acu->partida);
            
            if ($acu->materiales) {
                $items = json_decode($acu->materiales, true);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $materialesApu->push((object) [
                            'partida' => $partida,
                            'descripcion' => $item['descripcion'] ?? '',
                            'unidad' => $item['unidad'] ?? '',
                            'precio' => (float) ($item['precio'] ?? 0),
                            'cantidad' => (float) ($item['cantidad'] ?? 0),
                            'factor_desperdicio' => (float) ($item['factor_desperdicio'] ?? 1),
                        ]);
                    }
                }
            }
        }

        if ($materialesApu->isEmpty()) {
            return response()->json([
                'materiales' => [],
                'periodos' => [],
                'resumen' => $this->resumenVacio(),
                'estaGuardado' => false,
                'sinGantt' => false,
            ]);
        }

        $inicio = now()->startOfYear();
        $fin = now()->endOfYear();
        $periodos = $this->buildPeriodos($inicio, $fin);
        $clavesPeriodos = collect($periodos)->pluck('key')->toArray();

        $materialesFinales = $materialesApu
            ->groupBy('descripcion')
            ->map(function ($filas, $descripcion) use ($metradosPorPartida, $clavesPeriodos) {
                $primerFila = $filas->first();
                $mensual = array_fill_keys($clavesPeriodos, 0.0);
                $cantidadTotal = 0.0;
                $costoTotal = 0.0;

                foreach ($filas as $fila) {
                    $partida = trim($fila->partida);
                    $metrado = $metradosPorPartida->get($partida)?->metrado ?? 0;

                    $cantidadPartida = (float) ($fila->cantidad * $fila->factor_desperdicio * $metrado);
                    $costoPartida = $cantidadPartida * $fila->precio;

                    $cantidadTotal += $cantidadPartida;
                    $costoTotal += $costoPartida;

                    $meses = count($clavesPeriodos);
                    $distribucion = $meses > 0 ? $cantidadPartida / $meses : 0;

                    foreach ($clavesPeriodos as $key) {
                        $mensual[$key] += $distribucion;
                    }
                }

                return [
                    'partida_origen' => '',
                    'descripcion' => $descripcion,
                    'descripcion_partida' => '',
                    'unidad' => $primerFila->unidad,
                    'tipo' => $this->determinarTipoMaterial($descripcion),
                    'precio' => (float) $primerFila->precio,
                    'cantidad_total' => round($cantidadTotal, 4),
                    'costo_total' => round($costoTotal, 2),
                    'distribucion' => array_map(fn ($value) => [
                        'cantidad' => round($value, 4),
                        'monto' => round($value * (float) $primerFila->precio, 2),
                    ], $mensual),
                ];
            })
            ->filter(fn ($material) => $material['cantidad_total'] > 0)
            ->sortBy('descripcion')
            ->values();

        $estaGuardado = DB::connection('costos_tenant')
            ->table('cronograma_materiales')
            ->where('presupuesto_id', $presupuestoId)
            ->exists();

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
                'total_partidas' => 0,
            ],
            'estaGuardado' => $estaGuardado,
            'sinGantt' => false,
        ]);
    }

  private function buildPeriodos($inicio, $fin): array
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

    private function calcularResumen(array $materiales, array $periodos): array
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
            'total_partidas' => 0,
        ];
    }

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