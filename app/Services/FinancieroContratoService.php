<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Los 3 porcentajes financieros (Gastos Generales, Utilidad, IGV) que ya
 * captura Valorizado (gg_consolidado/gg_fijos/gg_variables — misma fuente
 * que CronoValorizadoController::resolveFinDefaults()) y que RESUMEN VAL. /
 * PAGOS ACUMULADOS necesitan para su propia cascada Costo Directo → GG →
 * Utilidad → Sub Total → IGV → Monto Total, aplicada sobre el ejecutado
 * (no sobre el total del contrato, que es solo UNA fila más de esa misma
 * cascada). No duplica la lógica de Componentes II/III ni conceptos
 * adicionales (amarillo/rojo/rojo_final) — esas hojas del Excel de
 * referencia no las usan, solo Costo Directo/GG/Utilidad/IGV.
 */
class FinancieroContratoService
{
    public function __construct(private readonly CostoDatabaseService $dbService) {}

    public function porcentajes(int $presupuestoId): array
    {
        $connection = DB::connection('costos_tenant');

        $snapshot = $connection->table('gg_consolidado')
            ->where('presupuesto_id', $presupuestoId)
            ->first();

        $costoDirecto = $this->dbService->costoDirectoOficial($presupuestoId);

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

        return [
            'pctGastosGenerales' => $costoDirecto > 0
                ? round(($gastosGenerales / $costoDirecto) * 100, 4)
                : 0.0,
            'pctUtilidad' => (float) ($snapshot?->utilidad_porcentaje ?? 5),
            'pctIGV' => (float) ($snapshot?->igv_porcentaje ?? 18),
        ];
    }

    /**
     * Aplica la cascada Costo Directo → GG → Utilidad → Sub Total → IGV →
     * Monto Total a UN monto de costo directo (puede ser el total
     * contratado, o el ejecutado acumulado a un corte — misma fórmula,
     * distinta base).
     */
    public function aplicarCascada(float $costoDirecto, array $pct): array
    {
        $montoGG = round($costoDirecto * $pct['pctGastosGenerales'] / 100, 2);
        $montoUtilidad = round($costoDirecto * $pct['pctUtilidad'] / 100, 2);
        $subTotal = round($costoDirecto + $montoGG + $montoUtilidad, 2);
        $montoIGV = round($subTotal * $pct['pctIGV'] / 100, 2);
        $montoTotal = round($subTotal + $montoIGV, 2);

        return [
            'costoDirecto' => round($costoDirecto, 2),
            'montoGG' => $montoGG,
            'montoUtilidad' => $montoUtilidad,
            'subTotal' => $subTotal,
            'montoIGV' => $montoIGV,
            'montoTotal' => $montoTotal,
        ];
    }
}
