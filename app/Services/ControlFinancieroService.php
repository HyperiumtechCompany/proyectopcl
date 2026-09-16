<?php

namespace App\Services;

use App\Models\CostoProject;
use Illuminate\Support\Facades\DB;

/**
 * CONTROL FINANCIERO DE LA OBRA — Adelantos + valorizaciones, cada una con
 * su monto facturable (Costo Directo del periodo con GG/Utilidad/IGV ya
 * aplicados, vía FinancieroContratoService) y su estado de "devengado"
 * (trámite de aprobación — ver valorizacion_estado, no se infiere solo del
 * ejecutado). Los adelantos se tratan como siempre devengados: una vez
 * otorgados, ya están desembolsados.
 */
class ControlFinancieroService
{
    public function __construct(
        private readonly AvanceObraCalculoService $avanceService,
        private readonly FinancieroContratoService $financieroService,
    ) {}

    public function calcular(CostoProject $costoProject, int $presupuestoId, string $modoCalculo, float $montoContrato): array
    {
        $avance = $this->avanceService->calcular($costoProject, $presupuestoId, $modoCalculo);
        $pct = $this->financieroService->porcentajes($presupuestoId);

        $adelantosRow = DB::connection('costos_tenant')
            ->table('adelantos_valorizado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();
        $adelantoDirecto = $adelantosRow ? (float) $adelantosRow->adelanto_directo : 0.0;
        $adelantoMateriales = $adelantosRow ? (float) $adelantosRow->adelanto_materiales : 0.0;

        $estados = DB::connection('costos_tenant')
            ->table('valorizacion_estado')
            ->where('presupuesto_id', $presupuestoId)
            ->get()
            ->keyBy('periodo_key');

        $filasValorizaciones = [];
        $sumaFacturable = 0.0;
        $sumaDevengado = 0.0;

        foreach ($avance['filas'] as $i => $fila) {
            $cascada = $this->financieroService->aplicarCascada($fila['ejecutadoMensual'], $pct);
            $montoFacturable = $cascada['montoTotal'];
            $devengado = (bool) ($estados[$fila['key']]->devengado ?? false);
            $montoDevengado = $devengado ? $montoFacturable : 0.0;
            $montoPendiente = round($montoFacturable - $montoDevengado, 2);
            $pctDevengado = $montoContrato > 0 ? round($montoDevengado / $montoContrato * 100, 4) : 0.0;

            $sumaFacturable += $montoFacturable;
            $sumaDevengado += $montoDevengado;

            $filasValorizaciones[] = [
                'numero' => $i + 1,
                'periodo' => $fila['periodo'],
                'periodoCal' => $fila['periodoCal'],
                'key' => $fila['key'],
                'montoFacturable' => round($montoFacturable, 2),
                'devengado' => $devengado,
                'montoDevengado' => round($montoDevengado, 2),
                'pctDevengado' => $pctDevengado,
                'montoPendiente' => $montoPendiente,
            ];
        }

        $totalFacturable = round($adelantoDirecto + $adelantoMateriales + $sumaFacturable, 2);
        $totalDevengado = round($adelantoDirecto + $adelantoMateriales + $sumaDevengado, 2);
        $totalPendiente = round($totalFacturable - $totalDevengado, 2);
        $pctTotalDevengado = $montoContrato > 0 ? round($totalDevengado / $montoContrato * 100, 4) : 0.0;

        $saldoFacturable = round($montoContrato - $totalFacturable, 2);
        $saldoDevengado = round($montoContrato - $totalDevengado, 2);
        $pctSaldoDevengado = $montoContrato > 0 ? round($saldoDevengado / $montoContrato * 100, 4) : 0.0;

        return [
            'adelantoDirecto' => $adelantoDirecto,
            'adelantoMateriales' => $adelantoMateriales,
            'filasValorizaciones' => $filasValorizaciones,
            'totalFacturable' => $totalFacturable,
            'totalDevengado' => $totalDevengado,
            'pctTotalDevengado' => $pctTotalDevengado,
            'totalPendiente' => $totalPendiente,
            'saldoFacturable' => $saldoFacturable,
            'saldoDevengado' => $saldoDevengado,
            'pctSaldoDevengado' => $pctSaldoDevengado,
            'saldoPendiente' => $saldoFacturable,
            'pie' => $this->construirPie($montoContrato, $adelantoDirecto, $adelantoMateriales, $filasValorizaciones),
        ];
    }

    private function construirPie(float $montoContrato, float $adelantoDirecto, float $adelantoMateriales, array $filasValorizaciones): array
    {
        if ($montoContrato <= 0) {
            return [];
        }

        $pie = [];
        if ($adelantoDirecto > 0) {
            $pie[] = ['label' => 'Adelanto directo', 'monto' => $adelantoDirecto, 'pct' => round($adelantoDirecto / $montoContrato * 100, 2)];
        }
        if ($adelantoMateriales > 0) {
            $pie[] = ['label' => 'Adelanto de materiales', 'monto' => $adelantoMateriales, 'pct' => round($adelantoMateriales / $montoContrato * 100, 2)];
        }
        foreach ($filasValorizaciones as $f) {
            if ($f['devengado'] && $f['montoDevengado'] > 0) {
                $pie[] = [
                    'label' => 'Valorización N°'.str_pad((string) $f['numero'], 2, '0', STR_PAD_LEFT),
                    'monto' => $f['montoDevengado'],
                    'pct' => $f['pctDevengado'],
                ];
            }
        }

        $montoUsado = array_sum(array_column($pie, 'monto'));
        $pctUsado = array_sum(array_column($pie, 'pct'));
        $pie[] = [
            'label' => 'Saldo',
            'monto' => round($montoContrato - $montoUsado, 2),
            'pct' => round(100 - $pctUsado, 2),
        ];

        return $pie;
    }
}
