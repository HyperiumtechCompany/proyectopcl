<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use App\Services\CronogramaEstadoService;
use App\Services\CronogramaPeriodosService;
use App\Services\FinancieroContratoService;
use App\Services\ResumenValorizacionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * RESUMEN VAL. — la misma tabla por partida que Prog vs Ejec
 * (ResumenValorizacionService), con 5 filas adicionales al final aplicando
 * la cascada financiera (Costo Directo → GG → Utilidad → Sub Total → IGV →
 * Monto Total Valorizado) a cada una de las 4 columnas de dinero
 * (Contratado, Acumulado Anterior, Actual, Acumulado Actual, Saldo).
 * Verificado contra un caso real: GG/Utilidad son un % FIJO de Costo
 * Directo en cada columna — no se reparten ni recalculan por partida.
 */
class ResumenValController extends Controller
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly ResumenValorizacionService $resumenService,
        private readonly FinancieroContratoService $financieroService,
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

        $resultado = $this->resumenService->calcular(
            $costoProject,
            $presupuestoId,
            $modoCalculo,
            $request->query('periodo')
        );

        $pct = $this->financieroService->porcentajes($presupuestoId);
        $filasCascada = $this->construirFilasCascada($resultado['items'], $pct);

        return Inertia::render('costos/cronogramas/resumenval/ResumenVal', [
            'project' => (string) $projectId,
            'projectName' => $costoProject->nombre,
            'modoCalculo' => $modoCalculo,
            'periodos' => $resultado['periodos'],
            'periodoSeleccionado' => $resultado['periodoSeleccionado'],
            'items' => $resultado['items'],
            'filasCascada' => $filasCascada,
            'pct' => $pct,
            'sinProgramado' => $resultado['sinProgramado'],
            'sinEjecutado' => $resultado['sinEjecutado'],
            'estado' => $this->estadoService->resumen($presupuestoId),
        ]);
    }

    /**
     * Filas COSTO DIRECTO / GASTOS GENERALES / UTILIDAD / SUB TOTAL / IGV /
     * MONTO TOTAL VALORIZADO — cada una aplica la cascada financiera sobre
     * el total de esa columna (sumado solo sobre las hojas, no los grupos,
     * para no duplicar).
     */
    private function construirFilasCascada(array $items, array $pct): array
    {
        $hojas = array_values(array_filter($items, fn ($i) => $i['isLeaf']));

        $columnas = [
            'contratado' => array_sum(array_column($hojas, 'parcial')),
            'acumuladoAnterior' => array_sum(array_column($hojas, 'ejecutadoAcumuladoAnterior')),
            'actual' => array_sum(array_column($hojas, 'ejecutadoMensual')),
            'acumuladoActual' => array_sum(array_column($hojas, 'ejecutadoAcumulado')),
        ];
        $columnas['saldo'] = $columnas['contratado'] - $columnas['acumuladoActual'];

        $cascadas = array_map(
            fn ($costoDirecto) => $this->financieroService->aplicarCascada($costoDirecto, $pct),
            $columnas
        );

        $filas = [];
        foreach (['costoDirecto' => 'COSTO DIRECTO', 'montoGG' => 'GASTOS GENERALES', 'montoUtilidad' => 'UTILIDAD', 'subTotal' => 'SUB TOTAL', 'montoIGV' => 'IGV', 'montoTotal' => 'MONTO TOTAL VALORIZADO'] as $campo => $etiqueta) {
            $filas[] = [
                'etiqueta' => $etiqueta,
                'contratado' => $cascadas['contratado'][$campo],
                'acumuladoAnterior' => $cascadas['acumuladoAnterior'][$campo],
                'actual' => $cascadas['actual'][$campo],
                'acumuladoActual' => $cascadas['acumuladoActual'][$campo],
                'saldo' => $cascadas['saldo'][$campo],
            ];
        }

        return $filas;
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
