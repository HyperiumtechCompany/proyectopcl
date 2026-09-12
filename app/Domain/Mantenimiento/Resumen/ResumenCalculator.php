<?php

namespace App\Domain\Mantenimiento\Resumen;

use App\Domain\Mantenimiento\Formula\DecimalMath;

/**
 * RESUMEN es 100% auto-generado a partir de MO + MAT + GG + "Parámetros del Programa"
 * (los únicos inputs reales: aprobado ideal por componente, IGV, descuento por adjudicación,
 * apoyo técnico, aportes de socios). No se replican los números mágicos del Excel original
 * (ajustes puntuales de un contrato específico) — ver planes/costos/campo/mantenimiento
 * plan_automatizacion_mantenimiento_v2.md sección 1.6.
 */
class ResumenCalculator
{
    private const ARMADAS = ['armada_1', 'armada_2', 'liquidacion'];

    private const MONTO_COMPONENTES = ['materiales', 'mano_obra', 'equipos', 'gastos_generales', 'descuento'];

    public function __construct(private readonly DecimalMath $math) {}

    public static function defaultParametros(): array
    {
        $armadas = array_fill_keys(self::ARMADAS, '0');

        return [
            'expediente' => ['equipos' => '0', 'utilidad' => '0', 'igv' => '0', 'descuento' => '0'],
            'aprobado_ideal' => [
                'materiales' => '0', 'mano_obra' => '0', 'equipos' => '0',
                'gastos_generales' => '0', 'utilidad' => '0', 'igv' => '0', 'descuento' => '0',
            ],
            'apoyo_tecnico' => ['ejecutado' => '0', 'por_pagar' => '0'],
            'aportes_socios' => ['socio1' => $armadas, 'socio2' => $armadas],
            'monto_invertir' => array_fill_keys(self::MONTO_COMPONENTES, $armadas),
            'avance_obra_pct' => ['costo_directo' => '0', 'materiales' => '0', 'mano_obra' => '0', 'equipos' => '0'],
        ];
    }

    public static function normalizeParametros(?array $parametros): array
    {
        $defaults = self::defaultParametros();
        if ($parametros === null) {
            return $defaults;
        }

        $merge = function (array $default, array $override) use (&$merge) {
            foreach ($default as $key => $value) {
                if (is_array($value) && isset($override[$key]) && is_array($override[$key])) {
                    $default[$key] = $merge($value, $override[$key]);
                } elseif (isset($override[$key]) && ! is_array($override[$key])) {
                    $default[$key] = (string) $override[$key];
                }
            }

            return $default;
        };

        return $merge($defaults, $parametros);
    }

    /**
     * @param  array  $mo  payload de MaintenanceMoService::payload()
     * @param  array  $mat  payload de MaintenanceMatService::payload()
     * @param  array  $gg  payload de MaintenanceGgService::payload()
     */
    public function payload(array $mo, array $mat, array $gg, ?array $parametros): array
    {
        $p = self::normalizeParametros($parametros);

        $materialesEt = $mat['totales']['general']['pt_et'];
        $manoObraEt = $mo['totales']['general']['et_parcial'];
        $gastosGeneralesEt = $gg['totales']['general']['gasto_et'];

        $general = $this->resumenGeneral($materialesEt, $manoObraEt, $gastosGeneralesEt, $p);
        $desagregado = $this->resumenDesagregado($mo, $mat, $gg, $p, $general);
        $montoInvertir = $this->montoInvertir($p);
        $gastoReal = $this->gastoReal($mo, $mat, $gg, $p, $general);

        return [
            'parametros' => $p,
            'general' => $general,
            'desagregado' => $desagregado,
            'monto_invertir' => $montoInvertir,
            'gasto_real' => $gastoReal,
        ];
    }

    private function resumenGeneral(string $materialesEt, string $manoObraEt, string $gastosGeneralesEt, array $p): array
    {
        $exp = fn (string $key) => $p['expediente'][$key] ?? '0';
        $ideal = fn (string $key) => $p['aprobado_ideal'][$key] ?? '0';

        $costoDirectoExp = $this->sum($materialesEt, $manoObraEt, $exp('equipos'));
        $costoDirectoIdeal = $this->sum($ideal('materiales'), $ideal('mano_obra'), $ideal('equipos'));

        $totalExp = $this->sum($costoDirectoExp, $gastosGeneralesEt, $exp('utilidad'));
        $totalIdeal = $this->sum($costoDirectoIdeal, $ideal('gastos_generales'), $ideal('utilidad'));

        $adjExp = $this->r2($this->math->subtract($this->math->add($totalExp, $exp('igv')), $exp('descuento')));
        $adjIdeal = $this->r2($this->math->subtract($this->math->add($totalIdeal, $ideal('igv')), $ideal('descuento')));

        $row = fn (string $componente, string $label, string $expVal, string $idealVal, bool $expEditable, bool $idealEditable) => [
            'componente' => $componente, 'label' => $label,
            'expediente' => $this->r2($expVal), 'aprobado_ideal' => $this->r2($idealVal),
            'editable' => ['expediente' => $expEditable, 'aprobado_ideal' => $idealEditable],
        ];

        return [
            'rows' => [
                $row('materiales', 'Materiales', $materialesEt, $ideal('materiales'), false, true),
                $row('mano_obra', 'Mano de Obra', $manoObraEt, $ideal('mano_obra'), false, true),
                $row('equipos', 'Equipos y Herramientas', $exp('equipos'), $ideal('equipos'), true, true),
                $row('costo_directo', 'Costo Directo', $costoDirectoExp, $costoDirectoIdeal, false, false),
                $row('gastos_generales', 'Gastos Generales', $gastosGeneralesEt, $ideal('gastos_generales'), false, true),
                $row('utilidad', 'Utilidad', $exp('utilidad'), $ideal('utilidad'), true, true),
                $row('total', 'Total', $totalExp, $totalIdeal, false, false),
                $row('igv', 'IGV', $exp('igv'), $ideal('igv'), true, true),
                $row('descuento', 'Descuento por Adj. Pro', $exp('descuento'), $ideal('descuento'), true, true),
                $row('total_adjudicado', 'Total Adjudicado', $adjExp, $adjIdeal, false, false),
            ],
            'totals' => ['expediente' => $this->r2($adjExp), 'aprobado_ideal' => $this->r2($adjIdeal)],
        ];
    }

    private function desagRow(string $tipo, string $label, string $ideal, string $proy, string $actual, ?string $avancePct = null, ?string $avanceKey = null): array
    {
        $deuda = $this->r2($this->math->subtract($proy, $actual));
        $deficit = $this->r2($this->math->subtract($ideal, $proy));
        $pctGasto = $this->math->compare($ideal, '0') === 0 ? null : $this->pct($actual, $ideal);

        return [
            'tipo' => $tipo, 'label' => $label,
            'aprobado_ideal' => $this->r2($ideal), 'proyectado_real' => $this->r2($proy), 'actual' => $this->r2($actual),
            'deuda' => $deuda, 'deficit' => $deficit, 'pct_gasto_actual' => $pctGasto,
            'pct_avance' => $avancePct, 'avance_key' => $avanceKey,
        ];
    }

    private function resumenDesagregado(array $mo, array $mat, array $gg, array $p, array $general): array
    {
        $avance = fn (string $key) => $p['avance_obra_pct'][$key] ?? '0';
        $ideal = fn (string $key) => $p['aprobado_ideal'][$key] ?? '0';

        $materialesEt = $mat['totales']['general']['pt_et'];
        $materialesComprado = $mat['totales']['general']['total_comprado'];
        $manoObraEt = $mo['totales']['general']['et_parcial'];
        $manoObraFinal = $mo['totales']['general']['final'];

        $rows = [];
        $rows[] = ['tipo' => 'sub', 'label' => 'Materiales'];
        $rows[] = $this->desagRow('linea', 'Materiales', $ideal('materiales'), $materialesEt, $materialesComprado);
        $rows[] = $this->desagRow('linea', 'Transporte', '0', '0', '0');
        $rows[] = $this->desagRow('linea', 'Movilidad', '0', '0', '0');
        $rows[] = ['tipo' => 'sub', 'label' => 'Mano de Obra'];
        $rows[] = $this->desagRow('linea', 'Subcontrato', $ideal('mano_obra'), $manoObraEt, $manoObraFinal, $avance('mano_obra'), 'mano_obra');

        $costoDirectoRow = $this->desagRow(
            'rollup', 'Costo Directo',
            $general['rows'][3]['aprobado_ideal'], // costo_directo ideal
            $this->sum($materialesEt, $manoObraEt, $p['expediente']['equipos'] ?? '0'),
            $this->sum($materialesComprado, $manoObraFinal),
            $avance('costo_directo'), 'costo_directo',
        );

        $rows[] = ['tipo' => 'sub', 'label' => 'Equipos y Herramientas'];
        $rows[] = $this->desagRow('linea', 'Equipos y Herramientas', $ideal('equipos'), $p['expediente']['equipos'] ?? '0', '0', $avance('equipos'), 'equipos');

        $ggRows = [];
        foreach ($gg['rows'] as $row) {
            if ($row['tipo'] !== 'rubro') {
                continue;
            }
            $ggRows[] = $this->desagRow('linea', $row['rubro'], $row['gasto_et'], $row['gasto_proyectado'], $row['total_pagado']);
        }
        $ggRollup = $this->desagRow(
            'rollup', 'Gastos Generales',
            $ideal('gastos_generales'), $gg['totales']['general']['gasto_et'], $gg['totales']['general']['total_pagado'],
        );

        return [
            'rows' => array_merge(
                [$costoDirectoRow],
                $rows,
                [['tipo' => 'blank']],
                [$ggRollup],
                $ggRows,
            ),
        ];
    }

    private function montoInvertir(array $p): array
    {
        $mi = $p['monto_invertir'];
        $rowFor = fn (string $key, string $label) => [
            'componente' => $key, 'label' => $label,
            'armadas' => array_map(fn ($v) => $this->r2($v), $mi[$key]),
            'sub_total' => $this->r2($this->sum(...array_values($mi[$key]))),
        ];

        $materiales = $rowFor('materiales', 'Materiales');
        $manoObra = $rowFor('mano_obra', 'Mano de Obra');
        $equipos = $rowFor('equipos', 'Equipos y Herramientas');
        $gastosGenerales = $rowFor('gastos_generales', 'Gastos Generales');
        $descuento = $rowFor('descuento', 'Descuento por Adj. Pro');

        $costoDirectoArmadas = [];
        foreach (self::ARMADAS as $armada) {
            $costoDirectoArmadas[$armada] = $this->r2($this->sum($mi['materiales'][$armada], $mi['mano_obra'][$armada], $mi['equipos'][$armada]));
        }
        $costoDirecto = [
            'componente' => 'costo_directo', 'label' => 'Costo Directo',
            'armadas' => $costoDirectoArmadas, 'sub_total' => $this->r2($this->sum(...array_values($costoDirectoArmadas))),
        ];

        $totalArmadas = [];
        foreach (self::ARMADAS as $armada) {
            $totalArmadas[$armada] = $this->r2($this->sum($costoDirectoArmadas[$armada], $mi['gastos_generales'][$armada], $mi['descuento'][$armada]));
        }
        $total = [
            'componente' => 'total', 'label' => 'Total',
            'armadas' => $totalArmadas, 'sub_total' => $this->r2($this->sum(...array_values($totalArmadas))),
        ];

        $socios = $p['aportes_socios'];
        $socio1Armadas = array_map(fn ($v) => $this->r2($v), $socios['socio1']);
        $socio2Armadas = array_map(fn ($v) => $this->r2($v), $socios['socio2']);
        $socio1 = ['componente' => 'socio1', 'label' => 'Socio 1', 'armadas' => $socio1Armadas, 'sub_total' => $this->r2($this->sum(...array_values($socios['socio1'])))];
        $socio2 = ['componente' => 'socio2', 'label' => 'Socio 2', 'armadas' => $socio2Armadas, 'sub_total' => $this->r2($this->sum(...array_values($socios['socio2'])))];

        $totalSociosArmadas = [];
        foreach (self::ARMADAS as $armada) {
            $totalSociosArmadas[$armada] = $this->r2($this->sum($socios['socio1'][$armada], $socios['socio2'][$armada]));
        }
        $totalSocios = [
            'componente' => 'total_socios', 'label' => 'Total',
            'armadas' => $totalSociosArmadas, 'sub_total' => $this->r2($this->sum(...array_values($totalSociosArmadas))),
        ];

        return [
            'armadas' => self::ARMADAS,
            'componentes' => [$materiales, $manoObra, $equipos, $costoDirecto, $gastosGenerales, $descuento, $total],
            'socios' => [$socio1, $socio2, $totalSocios],
        ];
    }

    private function gastoReal(array $mo, array $mat, array $gg, array $p, array $general): array
    {
        $moEjecutado = $mo['totales']['general']['final'];
        $moPorPagar = $mo['totales']['general']['saldo'];
        $matEjecutado = $mat['totales']['general']['total_comprado'];
        $matPorPagar = $mat['totales']['general']['saldo'];
        $ggEjecutado = $gg['totales']['general']['total_pagado'];
        $ggPorPagar = $gg['totales']['general']['saldo'];
        $apoyoEjecutado = $p['apoyo_tecnico']['ejecutado'] ?? '0';
        $apoyoPorPagar = $p['apoyo_tecnico']['por_pagar'] ?? '0';

        $sub1Ejecutado = $this->sum($moEjecutado, $matEjecutado);
        $sub1PorPagar = $this->sum($moPorPagar, $matPorPagar);
        $sub2Ejecutado = $this->sum($sub1Ejecutado, $ggEjecutado);
        $sub2PorPagar = $this->sum($sub1PorPagar, $ggPorPagar);
        $totalEjecutado = $this->sum($sub2Ejecutado, $apoyoEjecutado);
        $totalPorPagar = $this->sum($sub2PorPagar, $apoyoPorPagar);

        $gastoTotal = $this->sum($totalEjecutado, $totalPorPagar);
        $totalAdjudicado = $general['totals']['aprobado_ideal'];
        $utilidadFinal = $this->r2($this->math->subtract($totalAdjudicado, $gastoTotal));
        $pctEjecucion = $this->math->compare($totalAdjudicado, '0') === 0 ? null : $this->pct($gastoTotal, $totalAdjudicado);

        $line = fn (string $label, string $ejecutado, string $porPagar) => [
            'label' => $label, 'ejecutado' => $this->r2($ejecutado), 'por_pagar' => $this->r2($porPagar),
            'total' => $this->r2($this->sum($ejecutado, $porPagar)),
        ];

        return [
            'lineas' => [
                $line('M.O', $moEjecutado, $moPorPagar),
                $line('MAT.', $matEjecutado, $matPorPagar),
                $line('SUB TOTAL 1', $sub1Ejecutado, $sub1PorPagar),
                $line('G.G', $ggEjecutado, $ggPorPagar),
                $line('SUB TOTAL 2', $sub2Ejecutado, $sub2PorPagar),
                $line('APOYO TÉC.', $apoyoEjecutado, $apoyoPorPagar),
                $line('TOTAL', $totalEjecutado, $totalPorPagar),
            ],
            'gasto_total' => $this->r2($gastoTotal),
            'total_adjudicado' => $this->r2($totalAdjudicado),
            'utilidad' => $utilidadFinal,
            'pct_ejecucion' => $pctEjecucion,
        ];
    }

    private function sum(string ...$values): string
    {
        $total = '0';
        foreach ($values as $value) {
            $total = $this->math->add($total, $value === '' ? '0' : $value);
        }

        return $total;
    }

    private function pct(string $numerator, string $denominator): string
    {
        return $this->r2($this->math->multiply($this->math->divide($numerator, $denominator), '100'));
    }

    // DecimalMath::round() normaliza y recorta ceros de cola ("2000.00" -> "2000"); aquí siempre
    // queremos 2 decimales fijos, igual que fromCents() en MoCalculator/MatCalculator/GgCalculator.
    private function r2(string $value): string
    {
        return $this->fromCents($this->toCents($value));
    }

    private function toCents(string $decimal): int
    {
        $rounded = $this->math->round($decimal, 2);
        $negative = str_starts_with($rounded, '-');
        [$units, $frac] = array_pad(explode('.', ltrim($rounded, '-'), 2), 2, '0');
        $cents = (int) $units * 100 + (int) str_pad(substr($frac.'00', 0, 2), 2, '0');

        return $negative ? -$cents : $cents;
    }

    private function fromCents(int $cents): string
    {
        $negative = $cents < 0;
        $cents = abs($cents);

        return ($negative ? '-' : '').intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
