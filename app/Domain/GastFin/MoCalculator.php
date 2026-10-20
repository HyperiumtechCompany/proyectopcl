<?php

namespace App\Domain\GastFin;

/**
 * Hoja MO de Gast. Fin.: un bloque por grupo de nivel 1.
 * - Izquierda (E.T., en vivo): mano de obra del ACU consolidada del grupo.
 * - Derecha (registrado): columnas de pago compartidas (ADELANTO 1, VAL 01 - S1…) con dos franjas
 *   por grupo, VALORIZACIONES y ADELANTOS; cada celda = etiqueta opcional + monto.
 * Pagado = valorizado + adelantos. Saldo = aprobado − pagado, donde aprobado es manual por grupo
 * o, si está vacío, el parcial E.T. del grupo (sugerido).
 */
class MoCalculator
{
    public const FRANJAS = ['valorizacion', 'adelanto'];

    /**
     * @param  array  $expediente  salida de InsumoConsolidator::consolidate()
     * @param  array<int, array{tipo:?string, mo_aprobado_minor:?int}>  $grupoConfig  por grupo_ref
     * @param  list<array{id:string, nombre:string, fecha:?string}>  $pagos
     * @param  array<string, array<int, array<string, array{etiqueta:?string, monto_minor:?int}>>>  $valores  [pagoId][grupoRef][franja]
     */
    public function payload(array $expediente, array $grupoConfig, array $pagos, array $valores): array
    {
        $grupos = [];
        $general = ['et' => 0, 'valorizado' => 0, 'adelantos' => 0, 'aprobado' => 0];

        foreach ($expediente['grupos'] as $grupo) {
            $ref = $grupo['ref'];
            $insumos = $expediente['insumos'][$ref]['mano_de_obra'] ?? [];
            $hasValores = false;
            foreach ($pagos as $pago) {
                $hasValores = $hasValores || isset($valores[$pago['id']][$ref]);
            }
            // Todos los niveles del presupuesto se muestran, aunque aún no tengan mano de obra con
            // metrado; solo el grupo técnico "SIN NIVEL" se omite cuando está vacío.
            if ($ref === InsumoConsolidator::SIN_GRUPO && $insumos === [] && ! $hasValores) {
                continue;
            }

            $rows = [];
            foreach ($insumos as $insumo) {
                $rows[] = [
                    'key' => $insumo['key'],
                    'descripcion' => $insumo['descripcion'],
                    'unidad' => $insumo['unidad'],
                    'cantidad' => Cents::fixed($insumo['cantidad'], 4),
                    'precio' => Cents::fixed($insumo['precio'], 4),
                    'parcial' => Cents::format($insumo['parcial_minor']),
                ];
            }

            $celdas = [];
            $valorizado = 0;
            $adelantos = 0;
            foreach ($pagos as $pago) {
                foreach (self::FRANJAS as $franja) {
                    $valor = $valores[$pago['id']][$ref][$franja] ?? null;
                    $monto = $valor['monto_minor'] ?? null;
                    $celdas[$pago['id']][$franja] = $valor === null ? null : [
                        'etiqueta' => $valor['etiqueta'] ?? null,
                        'monto' => $monto === null ? null : Cents::format($monto),
                    ];
                    if ($franja === 'valorizacion') {
                        $valorizado += $monto ?? 0;
                    } else {
                        $adelantos += $monto ?? 0;
                    }
                }
            }

            $et = Cents::of($expediente['totales'][$ref]['mano_de_obra'] ?? '0');
            $manual = $grupoConfig[$ref]['mo_aprobado_minor'] ?? null;
            $aprobado = $manual ?? $et;
            $pagado = $valorizado + $adelantos;

            $general['et'] += $et;
            $general['valorizado'] += $valorizado;
            $general['adelantos'] += $adelantos;
            $general['aprobado'] += $aprobado;

            $grupos[] = [
                'ref' => $ref,
                'partida' => $grupo['partida'],
                'descripcion' => $grupo['descripcion'],
                'tipo' => $grupoConfig[$ref]['tipo'] ?? null,
                'sin_metrado' => $expediente['sin_metrado'][$ref] ?? 0,
                'rows' => $rows,
                'valores' => $celdas,
                'totales' => [
                    'et_parcial' => Cents::format($et),
                    'valorizado' => Cents::format($valorizado),
                    'adelantos' => Cents::format($adelantos),
                    'pagado' => Cents::format($pagado),
                    'aprobado' => Cents::format($aprobado),
                    'aprobado_manual' => $manual !== null,
                    'saldo' => Cents::format($aprobado - $pagado),
                    'sobregiro' => $pagado > $aprobado,
                ],
            ];
        }

        $pagadoGeneral = $general['valorizado'] + $general['adelantos'];

        return [
            'pagos' => $pagos,
            'grupos' => $grupos,
            'totales' => [
                'general' => [
                    'et_parcial' => Cents::format($general['et']),
                    'valorizado' => Cents::format($general['valorizado']),
                    'adelantos' => Cents::format($general['adelantos']),
                    // "final" y "saldo" con los mismos nombres que MO de Mantenimiento: ResumenCalculator los lee.
                    'final' => Cents::format($pagadoGeneral),
                    'aprobado' => Cents::format($general['aprobado']),
                    'saldo' => Cents::format($general['aprobado'] - $pagadoGeneral),
                ],
            ],
        ];
    }
}
