<?php

namespace App\Services;

/**
 * R.F.C. — Retención de Garantía de Fiel Cumplimiento (Art. 114 del
 * Reglamento de la Ley N°32069, Ley General de Contrataciones Públicas):
 * 10% del monto del contrato original, retenido de forma prorrateada con
 * cargo a las primeras valorizaciones, hasta completar el total. Verificado
 * contra un caso real: si la primera valorización ya cubre el 10% completo,
 * TODA la retención se toma en esa primera valorización y las siguientes no
 * retienen nada más (no se reparte en partes iguales entre periodos).
 */
class RetencionGFCService
{
    public function calcular(float $montoContrato, array $filasValorizacion): array
    {
        $retencionTotal = round($montoContrato * 0.10, 2);
        $retencionAcumulada = 0.0;
        $filas = [];

        foreach ($filasValorizacion as $i => $f) {
            $retencionPendiente = round($retencionTotal - $retencionAcumulada, 2);
            $retencionEfectiva = max(0.0, min($f['montoValorizado'], $retencionPendiente));
            $retencionAcumulada = round($retencionAcumulada + $retencionEfectiva, 2);

            $filas[] = [
                'periodo' => $f['periodo'],
                'periodoCal' => $f['periodoCal'],
                'montoValorizado' => round($f['montoValorizado'], 2),
                // Solo informativo en la primera fila (así viene en el
                // Excel de referencia) — el total al que apunta la cascada.
                'retencionMensualProgramada' => $i === 0 ? $retencionTotal : null,
                'retencionEfectiva' => $retencionEfectiva,
                'retencionAcumulada' => $retencionAcumulada,
            ];
        }

        return [
            'montoContrato' => round($montoContrato, 2),
            'retencionTotal' => $retencionTotal,
            'filas' => $filas,
            'retencionAcumuladaFinal' => $retencionAcumulada,
            'saldoPorRetener' => round($retencionTotal - $retencionAcumulada, 2),
        ];
    }
}
