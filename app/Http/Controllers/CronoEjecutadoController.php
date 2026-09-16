<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use App\Services\PresupuestoJerarquiaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Avance real ejecutado en campo (VAL. MENSUAL del Excel de referencia):
 * metrado realmente ejecutado por partida y periodo, capturado por el
 * equipo de campo. Vive en 'cronograma_ejecutado', independiente de
 * 'cronograma_valorizado' (que es SOLO lo programado) — nunca se escribe
 * una en la otra. Usa los MISMOS periodos (calendario/30 días) que el
 * Valorizado, vía CronogramaPeriodosService, para que los reportes de
 * comparación (PROG VS. EJEC, CONTROL GEN. AVAN. OBRA.) puedan cruzar
 * programado y ejecutado periodo a periodo sin desalinearse.
 */
class CronoEjecutadoController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly CronogramaPeriodosService $periodosService,
        private readonly PresupuestoJerarquiaService $jerarquiaService,
        private readonly CronogramaEstadoService $estadoService,
    ) {}

    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');
        $modoCalculo = $request->query('modo', CronogramaPeriodosService::MODO_CALENDARIO);

        if (! $projectId) {
            abort(404, 'ID de proyecto no recibido');
        }

        $costoProject = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        $projectData = [
            'nombre' => $costoProject->nombre ?? 'PROYECTO',
        ];

        $presupuesto = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->where('metrado', '>', 0)
            ->orderBy('item_order')
            ->get()
            ->keyBy(fn ($p) => trim($p->partida ?? ''));

        if ($presupuesto->isEmpty()) {
            return Inertia::render('costos/cronogramas/ejecutado/CronogramaEjecutado', [
                'project' => (string) $projectId,
                'projectName' => $costoProject->nombre,
                'items' => [],
                'periodos' => [],
                'totalPresupuesto' => 0,
                'jerarquiaPresupuesto' => [],
                'modoCalculo' => $modoCalculo,
                'sinGantt' => false,
                'estaGuardado' => false,
                'projectData' => $projectData,
                'estado' => $this->estadoService->resumen($presupuestoId),
            ]);
        }

        $jerarquiaPresupuesto = $this->jerarquiaService->resolve($presupuestoId);
        $calendarSettings = $this->periodosService->fetchCalendarSettings($projectId);
        $cronoPorPartida = $this->resolveCronoPorPartida($presupuestoId);
        $fechasProgramadas = $cronoPorPartida->filter(
            fn ($c) => ! empty($c->fecha_inicio) && ! empty($c->fecha_fin)
        );

        [$rangoInicio, $rangoFin] = $this->periodosService->resolveRango($costoProject, $calendarSettings, $fechasProgramadas);
        $periodos = $this->periodosService->generarPeriodos($modoCalculo, $rangoInicio, $rangoFin, $calendarSettings);

        $ejecutadoGuardado = DB::connection('costos_tenant')
            ->table('cronograma_ejecutado')
            ->where('presupuesto_id', $presupuestoId)
            ->get()
            ->keyBy(fn ($e) => trim($e->partida ?? ''));

        $estaGuardado = $ejecutadoGuardado->isNotEmpty();

        $items = [];
        foreach ($presupuesto as $pItem) {
            $partida = trim($pItem->partida ?? '');
            $metrado = (float) ($pItem->metrado ?? 0);
            $precio = (float) ($pItem->precio_unitario ?? 0);

            $eRow = $ejecutadoGuardado->get($partida);
            $ejecucionGuardada = $eRow ? (json_decode($eRow->ejecucion_mensual, true) ?? []) : [];

            // Normalizado a los periodos ACTUALES — si cambió el modo de
            // cálculo desde el último guardado, las keys viejas ya no
            // aparecen aquí (quedan intactas en la BD, no se destruyen; solo
            // no se muestran hasta que el modo vuelva a coincidir).
            $ejecucion = [];
            foreach ($periodos as $p) {
                $ejecucion[$p['key']] = $ejecucionGuardada[$p['key']] ?? ['metrado' => 0, 'monto' => 0];
            }

            $items[] = [
                'id' => (string) $pItem->id,
                'item' => $partida,
                'descripcion' => $pItem->descripcion ?? '',
                'und' => $pItem->unidad ?? '',
                'metradoContratado' => $metrado,
                'precio' => $precio,
                'ejecucion' => $ejecucion,
            ];
        }

        return Inertia::render('costos/cronogramas/ejecutado/CronogramaEjecutado', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'items' => $items,
            'periodos' => $periodos,
            'totalPresupuesto' => $this->dbService->costoDirectoOficial($presupuestoId),
            'jerarquiaPresupuesto' => $jerarquiaPresupuesto->toArray(),
            'modoCalculo' => $modoCalculo,
            'sinGantt' => false,
            'estaGuardado' => $estaGuardado,
            'projectData' => $projectData,
            'estado' => $this->estadoService->resumen($presupuestoId),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => 'required',
            'items' => 'required|array',
        ]);

        $costoProject = CostoProject::findOrFail($request->input('project_id'));
        $this->dbService->setTenantConnection($costoProject->database_name);
        $presupuestoId = $this->resolvePresupuestoId();

        DB::connection('costos_tenant')->beginTransaction();
        try {
            DB::connection('costos_tenant')
                ->table('cronograma_ejecutado')
                ->where('presupuesto_id', $presupuestoId)
                ->delete();

            $insertData = [];
            foreach ($request->input('items') as $index => $item) {
                $partida = trim((string) ($item['item'] ?? ''));
                if ($partida === '') {
                    continue;
                }

                $insertData[] = [
                    'presupuesto_id' => $presupuestoId,
                    'item_order' => $index + 1,
                    'partida' => $partida,
                    'descripcion' => $item['descripcion'] ?? '',
                    'metrado_contratado' => (float) ($item['metradoContratado'] ?? 0),
                    'precio_unitario' => (float) ($item['precio'] ?? 0),
                    'ejecucion_mensual' => json_encode($item['ejecucion'] ?? []),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            foreach (array_chunk($insertData, 500) as $chunk) {
                DB::connection('costos_tenant')->table('cronograma_ejecutado')->insert($chunk);
            }

            DB::connection('costos_tenant')->commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Avance real ejecutado guardado correctamente.',
            ]);
        } catch (\Throwable $e) {
            DB::connection('costos_tenant')->rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Error al guardar: '.$e->getMessage(),
            ], 500);
        }
    }

    private function resolveCronoPorPartida(int $presupuestoId): Collection
    {
        return DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', 'fecha_inicio', 'fecha_fin'])
            ->keyBy(fn ($r) => trim($r->partida ?? ''));
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
