<?php

namespace App\Domain\Mantenimiento\Gg;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Models\Mantenimiento\MaintenanceGgLinea;
use App\Models\Mantenimiento\MaintenanceGgPago;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Collection;

class GgCalculator
{
    private const GRUPOS = [
        'fijo' => ['orden' => 1, 'label' => 'GASTOS GENERALES FIJOS'],
        'variable' => ['orden' => 2, 'label' => 'GASTOS GENERALES VARIABLES'],
    ];

    public function __construct(private readonly DecimalMath $math) {}

    /**
     * @param  Collection<int, MaintenanceGgLinea>  $lineas
     * @param  Collection<int, MaintenanceGgPago>  $pagos
     * @param  array<string, array<string, int>>  $valores  [pago_public_id][linea_public_id] => monto_minor
     */
    public function payload(
        MaintenanceScenario $scenario,
        Collection $scenarios,
        Collection $lineas,
        Collection $pagos,
        array $valores,
    ): array {
        $pagoIds = $pagos->pluck('public_id')->all();

        $byGrupo = ['fijo' => [], 'variable' => []];
        foreach ($lineas as $linea) {
            $byGrupo[$linea->grupo][$linea->rubro][] = $linea;
        }

        $rows = [];
        $generalEt = 0;
        $generalProy = 0;
        $generalPagado = 0;
        $porPagoGeneral = array_fill_keys($pagoIds, 0);
        $descuadres = 0;

        foreach (self::GRUPOS as $grupoKey => $meta) {
            $rubros = $byGrupo[$grupoKey];
            $grupoEt = 0;
            $grupoProy = 0;
            $grupoPagado = 0;
            $porPagoGrupo = array_fill_keys($pagoIds, 0);
            $rubroBuffer = [];
            $rubroIndex = 0;

            foreach ($rubros as $rubroNombre => $lineasDeRubro) {
                $rubroIndex++;
                $rubroEt = 0;
                $rubroProy = 0;
                $rubroPagado = 0;
                $porPagoRubro = array_fill_keys($pagoIds, 0);
                $lineaRows = [];

                foreach ($lineasDeRubro as $linea) {
                    $lineaRow = $this->computeLinea($linea, $pagoIds, $valores);
                    $lineaRows[] = $lineaRow;
                    $rubroEt += $lineaRow['_gasto_et_minor'];
                    $rubroProy += $lineaRow['_gasto_proyectado_minor'];
                    $rubroPagado += $lineaRow['_total_pagado_minor'];
                    foreach ($pagoIds as $pagoId) {
                        $porPagoRubro[$pagoId] += $lineaRow['_por_pago_minor'][$pagoId] ?? 0;
                    }
                    if ($lineaRow['descuadra']) {
                        $descuadres++;
                    }
                }

                $rubroBuffer[] = [
                    'row' => [
                        'tipo' => 'rubro',
                        'item' => sprintf('%02d.%02d.00', $meta['orden'], $rubroIndex),
                        'grupo' => $grupoKey,
                        'rubro' => $rubroNombre,
                        'gasto_et' => $this->fromCents($rubroEt),
                        'gasto_proyectado' => $this->fromCents($rubroProy),
                        'total_pagado' => $this->fromCents($rubroPagado),
                        'saldo' => $this->fromCents($rubroProy - $rubroPagado),
                        'por_pago' => array_map(fn (int $c) => $this->fromCents($c), $porPagoRubro),
                    ],
                    'lineas' => $lineaRows,
                ];

                $grupoEt += $rubroEt;
                $grupoProy += $rubroProy;
                $grupoPagado += $rubroPagado;
                foreach ($pagoIds as $pagoId) {
                    $porPagoGrupo[$pagoId] += $porPagoRubro[$pagoId];
                }
            }

            $rows[] = [
                'tipo' => 'grupo',
                'item' => sprintf('%02d)', $meta['orden']),
                'grupo' => $grupoKey,
                'descripcion' => $meta['label'],
                'gasto_et' => $this->fromCents($grupoEt),
                'gasto_proyectado' => $this->fromCents($grupoProy),
                'total_pagado' => $this->fromCents($grupoPagado),
                'saldo' => $this->fromCents($grupoProy - $grupoPagado),
                'por_pago' => array_map(fn (int $c) => $this->fromCents($c), $porPagoGrupo),
            ];
            foreach ($rubroBuffer as $entry) {
                $rows[] = $entry['row'];
                foreach ($entry['lineas'] as $lineaRow) {
                    $rows[] = $lineaRow;
                }
            }

            $generalEt += $grupoEt;
            $generalProy += $grupoProy;
            $generalPagado += $grupoPagado;
            foreach ($pagoIds as $pagoId) {
                $porPagoGeneral[$pagoId] += $porPagoGrupo[$pagoId];
            }
        }

        return [
            'scenario' => ['id' => $scenario->public_id, 'nombre' => $scenario->nombre],
            'scenarios' => $scenarios->map(static fn (MaintenanceScenario $s) => [
                'id' => $s->public_id, 'nombre' => $s->nombre, 'es_activo' => $s->es_activo,
            ])->values()->all(),
            'pagos' => $pagos->map(static fn (MaintenanceGgPago $p) => [
                'id' => $p->public_id, 'indice' => (int) $p->indice, 'fecha' => $p->fecha?->toDateString(), 'etiqueta' => $p->etiqueta,
            ])->values()->all(),
            'rows' => $rows,
            'totales' => [
                'general' => [
                    'gasto_et' => $this->fromCents($generalEt),
                    'gasto_proyectado' => $this->fromCents($generalProy),
                    'total_pagado' => $this->fromCents($generalPagado),
                    'saldo' => $this->fromCents($generalProy - $generalPagado),
                ],
                'por_pago' => array_map(fn (int $c) => $this->fromCents($c), $porPagoGeneral),
                'sobregiros' => $descuadres,
            ],
        ];
    }

    /**
     * @param  array<string, array<string, int>>  $valores
     */
    private function computeLinea(MaintenanceGgLinea $linea, array $pagoIds, array $valores): array
    {
        $cantidad = $this->math->normalize((string) ($linea->cantidad ?? '0'));
        $costoUnitario = $this->math->normalize((string) ($linea->costo_unitario ?? '0'));
        $gastoEt = $this->math->multiply($cantidad, $costoUnitario);
        $gastoEtMinor = $this->toCents($gastoEt);

        $proyectadoManual = $linea->gasto_proyectado !== null;
        $gastoProyectado = $proyectadoManual ? $this->math->normalize((string) $linea->gasto_proyectado) : $gastoEt;
        $gastoProyectadoMinor = $this->toCents($gastoProyectado);

        $porPago = [];
        $porPagoMinor = [];
        $totalPagado = 0;
        foreach ($pagoIds as $pagoId) {
            $present = isset($valores[$pagoId][$linea->public_id]);
            $monto = $present ? (int) $valores[$pagoId][$linea->public_id] : 0;
            $porPago[$pagoId] = $present ? $this->fromCents($monto) : null;
            $porPagoMinor[$pagoId] = $monto;
            $totalPagado += $monto;
        }

        $saldoMinor = $gastoProyectadoMinor - $totalPagado;

        return [
            'tipo' => 'linea',
            'linea_id' => $linea->public_id,
            'grupo' => $linea->grupo,
            'rubro' => $linea->rubro,
            'descripcion' => $linea->descripcion,
            'unidad' => $linea->unidad,
            'cantidad' => $cantidad,
            'costo_unitario' => $costoUnitario,
            'gasto_et' => $gastoEt,
            'gasto_proyectado' => $gastoProyectado,
            'gasto_proyectado_manual' => $proyectadoManual,
            'total_pagado' => $this->fromCents($totalPagado),
            'saldo' => $this->fromCents($saldoMinor),
            'descuadra' => $saldoMinor < 0,
            'por_pago' => $porPago,
            '_gasto_et_minor' => $gastoEtMinor,
            '_gasto_proyectado_minor' => $gastoProyectadoMinor,
            '_total_pagado_minor' => $totalPagado,
            '_por_pago_minor' => $porPagoMinor,
        ];
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
