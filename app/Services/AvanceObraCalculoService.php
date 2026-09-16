<?php

namespace App\Services;

use App\Models\CostoProject;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Cálculo programado vs. ejecutado por periodo — la misma tabla que arma
 * CONTROL GEN. AVAN. OBRA., reutilizada tal cual por CURVA S (que en el
 * Excel de referencia literalmente copia las columnas C/D/H/P de esa hoja,
 * ver 'Hoja: CURVA S' del reporte). Lectura pura sobre 'cronograma_valorizado'
 * y 'cronograma_ejecutado' — nunca recalcula una distribución, solo suma
 * montos ya persistidos por periodo.
 */
class AvanceObraCalculoService
{
    public function __construct(
        private readonly CostoDatabaseService $dbService,
        private readonly CronogramaPeriodosService $periodosService,
    ) {}

    public function calcular(CostoProject $costoProject, int $presupuestoId, string $modoCalculo): array
    {
        $calendarSettings = $this->periodosService->fetchCalendarSettings($costoProject->id);
        $cronoPorPartida = $this->resolveCronoPorPartida($presupuestoId);
        $fechasProgramadas = $cronoPorPartida->filter(
            fn ($c) => ! empty($c->fecha_inicio) && ! empty($c->fecha_fin)
        );

        [$rangoInicio, $rangoFin] = $this->periodosService->resolveRango($costoProject, $calendarSettings, $fechasProgramadas);
        $periodos = $this->periodosService->generarPeriodos($modoCalculo, $rangoInicio, $rangoFin, $calendarSettings);
        $clavesPeriodos = array_column($periodos, 'key');

        $valorizadoGuardado = DB::connection('costos_tenant')
            ->table('cronograma_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['distribucion_mensual']);

        $ejecutadoGuardado = DB::connection('costos_tenant')
            ->table('cronograma_ejecutado')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['ejecucion_mensual']);

        $sinProgramado = $valorizadoGuardado->isEmpty();
        $sinEjecutado = $ejecutadoGuardado->isEmpty();

        $totalPresupuesto = $this->dbService->costoDirectoOficial($presupuestoId);

        $programadoPorPeriodo = $this->sumarMontosPorPeriodo($valorizadoGuardado, 'distribucion_mensual', $clavesPeriodos);
        $ejecutadoPorPeriodo = $this->sumarMontosPorPeriodo($ejecutadoGuardado, 'ejecucion_mensual', $clavesPeriodos);

        $filas = [];
        $progAcum = 0.0;
        $ejecAcum = 0.0;

        foreach ($periodos as $p) {
            $progMensual = round($programadoPorPeriodo[$p['key']] ?? 0.0, 2);
            $ejecMensual = round($ejecutadoPorPeriodo[$p['key']] ?? 0.0, 2);
            $progAcum = round($progAcum + $progMensual, 2);
            $ejecAcum = round($ejecAcum + $ejecMensual, 2);

            $pctProgMensual = $totalPresupuesto > 0 ? round($progMensual / $totalPresupuesto * 100, 4) : 0.0;
            $pctProgAcum = $totalPresupuesto > 0 ? round($progAcum / $totalPresupuesto * 100, 4) : 0.0;
            $pctEjecMensual = $totalPresupuesto > 0 ? round($ejecMensual / $totalPresupuesto * 100, 4) : 0.0;
            $pctEjecAcum = $totalPresupuesto > 0 ? round($ejecAcum / $totalPresupuesto * 100, 4) : 0.0;

            $estado = match (true) {
                $pctEjecAcum + 0.0001 < $pctProgAcum => 'ATRASADA',
                $pctEjecAcum >= 100 => 'CULMINADA',
                default => 'ADELANTADA',
            };

            // Meta mínima 80% del programado acumulado — umbral que usa la
            // Ley de Contrataciones del Estado (Perú) para evaluar riesgo de
            // resolución de contrato cuando el avance ejecutado cae debajo de
            // eso. Es más grave que un simple "ATRASADA".
            $metaMinima80 = round($pctProgAcum * 0.8, 4);
            $bajoMeta80 = $pctEjecAcum + 0.0001 < $metaMinima80;

            $filas[] = [
                'periodo' => $p['label'],
                'periodoCal' => $p['labelCal'],
                'key' => $p['key'],
                'programadoMensual' => $progMensual,
                'programadoAcumulado' => $progAcum,
                'pctProgramadoMensual' => $pctProgMensual,
                'pctProgramadoAcumulado' => $pctProgAcum,
                'ejecutadoMensual' => $ejecMensual,
                'ejecutadoAcumulado' => $ejecAcum,
                'pctEjecutadoMensual' => $pctEjecMensual,
                'pctEjecutadoAcumulado' => $pctEjecAcum,
                'desviacion' => round($pctEjecAcum - $pctProgAcum, 4),
                'estado' => $estado,
                'metaMinima80' => $metaMinima80,
                'bajoMeta80' => $bajoMeta80,
            ];
        }

        return [
            'filas' => $filas,
            'totalPresupuesto' => $totalPresupuesto,
            'sinProgramado' => $sinProgramado,
            'sinEjecutado' => $sinEjecutado,
        ];
    }

    /**
     * Suma, por periodo, el campo 'monto' de todas las filas de una tabla
     * (cronograma_valorizado.distribucion_mensual o
     * cronograma_ejecutado.ejecucion_mensual) — mismo shape en ambas:
     * { "<periodoKey>": { "monto": n, ... } }.
     */
    private function sumarMontosPorPeriodo(Collection $filas, string $campoJson, array $clavesPeriodos): array
    {
        $totales = array_fill_keys($clavesPeriodos, 0.0);

        foreach ($filas as $fila) {
            $data = json_decode($fila->{$campoJson} ?? '', true) ?? [];
            foreach ($data as $key => $valor) {
                if (isset($totales[$key])) {
                    $totales[$key] += (float) ($valor['monto'] ?? 0);
                }
            }
        }

        return $totales;
    }

    private function resolveCronoPorPartida(int $presupuestoId): Collection
    {
        return DB::connection('costos_tenant')
            ->table('cronograma_general')
            ->where('presupuesto_id', $presupuestoId)
            ->get(['partida', 'fecha_inicio', 'fecha_fin'])
            ->keyBy(fn ($r) => trim($r->partida ?? ''));
    }
}
