<?php

namespace App\Http\Controllers;

use App\Http\Requests\GuardarPagoValorizacionRequest;
use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use App\Services\PagosValorizacionService;
use App\Services\ResumenValorizacionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PagosValorizacionController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly PagosValorizacionService $pagosService,
        private readonly CronogramaEstadoService $estadoService,
        private readonly ResumenValorizacionService $resumenService,
    ) {}

    public function mensual(Request $request): Response
    {
        return $this->render($request, 'mensual');
    }

    public function acumulados(Request $request): Response
    {
        return $this->render($request, 'acumulados');
    }

    public function control(Request $request): Response
    {
        return $this->render($request, 'control');
    }

    public function store(GuardarPagoValorizacionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $project = CostoProject::findOrFail($data['project_id']);
        $this->dbService->setTenantConnection($project->database_name);
        $presupuestoId = $this->resolvePresupuestoId();
        $resultado = $this->pagosService->calcular($project, $presupuestoId, CronogramaPeriodosService::MODO_CALENDARIO);
        abort_unless(
            in_array($data['periodo_key'], array_column($resultado['filas'], 'key'), true),
            422,
            'El periodo no pertenece al calendario del proyecto.'
        );

        DB::connection('costos_tenant')->table('pagos_valorizacion')->updateOrInsert(
            ['presupuesto_id' => $presupuestoId, 'periodo_key' => $data['periodo_key']],
            [
                'reajuste' => isset($data['reajuste']) ? round((float) $data['reajuste'], 2) : null,
                'penalidades' => isset($data['penalidades']) ? round((float) $data['penalidades'], 2) : null,
                'monto_pagado' => isset($data['monto_pagado']) ? round((float) $data['monto_pagado'], 2) : null,
                'fecha_pago' => $data['fecha_pago'] ?? null,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json(['status' => 'success', 'message' => 'Datos de pago guardados.']);
    }

    private function render(Request $request, string $vista): Response
    {
        $projectId = (int) $request->query('project');
        abort_unless($projectId > 0, 404, 'ID de proyecto no recibido');

        $project = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($project->database_name);
        $presupuestoId = $this->resolvePresupuestoId();
        $resultado = $this->pagosService->calcular($project, $presupuestoId, CronogramaPeriodosService::MODO_CALENDARIO);
        $periodoSeleccionado = $request->query('periodo');
        $periodoSeleccionado = in_array($periodoSeleccionado, array_column($resultado['filas'], 'key'), true)
            ? $periodoSeleccionado
            : ($resultado['filas'][0]['key'] ?? null);
        $componentes = [];
        if ($vista === 'mensual' && $periodoSeleccionado) {
            $resumen = $this->resumenService->calcular(
                $project, $presupuestoId, CronogramaPeriodosService::MODO_CALENDARIO, $periodoSeleccionado
            );
            $componentes = array_values(array_map(
                fn (array $item): array => [
                    'item' => $item['item'],
                    'descripcion' => $item['descripcion'],
                    'contratado' => $item['parcial'],
                    'actual' => $item['ejecutadoMensual'],
                    'acumulado' => $item['ejecutadoAcumulado'],
                ],
                array_filter($resumen['items'], fn (array $item): bool => $item['nivel'] === 1)
            ));
        }

        return Inertia::render('costos/cronogramas/pagos/PagosValorizacion', [
            'project' => (string) $projectId,
            'projectName' => $project->nombre,
            'modoCalculo' => CronogramaPeriodosService::MODO_CALENDARIO,
            'vista' => $vista,
            'periodoSeleccionado' => $periodoSeleccionado,
            'componentes' => $componentes,
            ...$resultado,
            'estado' => $this->estadoService->resumen($presupuestoId),
        ]);
    }

    private function resolvePresupuestoId(): int
    {
        $id = DB::connection('costos_tenant')->table('presupuestos')
            ->whereNull('deleted_at')->orderBy('id')->value('id');
        abort_unless($id, 422, 'No existe un presupuesto para este proyecto.');

        return (int) $id;
    }
}
