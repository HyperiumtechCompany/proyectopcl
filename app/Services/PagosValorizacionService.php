<?php

namespace App\Services;

use App\Models\CostoProject;
use Illuminate\Support\Facades\DB;

class PagosValorizacionService
{
    public function __construct(
        private readonly AvanceObraCalculoService $avanceService,
        private readonly FinancieroContratoService $financieroService,
    ) {}

    public function calcular(CostoProject $project, int $presupuestoId, string $modo): array
    {
        $avance = $this->avanceService->calcular($project, $presupuestoId, $modo);
        $porcentajes = $this->financieroService->porcentajes($presupuestoId);
        $pagos = DB::connection('costos_tenant')->table('pagos_valorizacion')
            ->where('presupuesto_id', $presupuestoId)->get()->keyBy('periodo_key');

        $filas = [];
        $acumuladoValorizado = 0.0;
        $acumuladoPagado = 0.0;
        $hayPagoInformado = false;

        foreach ($avance['filas'] as $i => $fila) {
            $cascada = $this->financieroService->aplicarCascada($fila['ejecutadoMensual'], $porcentajes);
            $pago = $pagos->get($fila['key']);
            $acumuladoValorizado = round($acumuladoValorizado + $cascada['montoTotal'], 2);
            if ($pago?->monto_pagado !== null) {
                $hayPagoInformado = true;
                $acumuladoPagado = round($acumuladoPagado + (float) $pago->monto_pagado, 2);
            }

            $filas[] = [
                'numero' => $i + 1,
                'periodo' => $fila['periodoCal'],
                'key' => $fila['key'],
                'cascada' => $cascada,
                'reajuste' => $pago?->reajuste === null ? null : (float) $pago->reajuste,
                'penalidades' => $pago?->penalidades === null ? null : (float) $pago->penalidades,
                'montoPagado' => $pago?->monto_pagado === null ? null : (float) $pago->monto_pagado,
                'fechaPago' => $pago?->fecha_pago,
                'acumuladoValorizado' => $acumuladoValorizado,
                'acumuladoPagado' => $hayPagoInformado ? $acumuladoPagado : null,
            ];
        }

        return [
            'filas' => $filas,
            'totalValorizado' => $acumuladoValorizado,
            'totalPagado' => $hayPagoInformado ? $acumuladoPagado : null,
            'sinProgramado' => $avance['sinProgramado'],
            'sinEjecutado' => $avance['sinEjecutado'],
        ];
    }
}
