<?php

namespace App\Domain\GastFin;

use App\Domain\Mantenimiento\Formula\DecimalMath;

/**
 * Hoja MAT de Gast. Fin. para UN grupo de nivel 1 (una pestaña por grupo).
 * Fila = material del E.T. consolidado (en vivo) ∪ filas registradas (manuales, o huérfanas: su
 * insumo ya no está en el ACU — se conservan con E.T. en blanco para no perder compras).
 * - Cotizado: cantidad (arranca = E.T.) × P.U. manual.
 * - Compras N: cantidad × P.U. = subtotal, más proveedor.
 * - Saldo = parcial E.T. − total comprado (mismo criterio que MAT de Mantenimiento).
 */
class MatCalculator
{
    public function __construct(private readonly DecimalMath $math) {}

    /**
     * @param  array<string, array{key:string, descripcion:string, unidad:string, cantidad:string, precio:string, parcial:string}>  $expediente  materiales del grupo por insumo_key
     * @param  list<array{id:int, public_id:string, insumo_key:string, descripcion:string, unidad:?string, manual:bool, cot_cantidad:?string, cot_precio:?string}>  $registrados
     * @param  list<array{id:string, fecha:?string}>  $compras  en orden
     * @param  array<int, array<string, array{cantidad:?string, precio:?string, proveedor:?string}>>  $valores  [insumoDbId][compraId]
     */
    public function payload(array $expediente, array $registrados, array $compras, array $valores): array
    {
        $registradoByKey = [];
        foreach ($registrados as $registrado) {
            $registradoByKey[$registrado['insumo_key']] = $registrado;
        }

        $keys = array_unique([...array_keys($expediente), ...array_keys($registradoByKey)]);

        $rows = [];
        foreach ($keys as $key) {
            $rows[] = $this->row($expediente[$key] ?? null, $registradoByKey[$key] ?? null, $compras, $valores);
        }

        usort($rows, fn (array $a, array $b) => strnatcmp(InsumoConsolidator::normalizeKey($a['descripcion']), InsumoConsolidator::normalizeKey($b['descripcion'])) ?: strcmp($a['key'], $b['key']));

        return [
            'compras' => array_values(array_map(fn (array $compra, int $i) => [...$compra, 'numero' => $i + 1], $compras, array_keys($compras))),
            'rows' => $rows,
            'totales' => $this->totales($rows, $compras),
        ];
    }

    public function row(?array $et, ?array $registrado, array $compras, array $valores): array
    {
        $etParcial = $et === null ? null : $et['parcial_minor'];

        $cotCantidad = $registrado['cot_cantidad'] ?? null;
        $cotCantidadSource = $cotCantidad === null ? 'et' : 'manual';
        $cotCantidad ??= $et['cantidad'] ?? null;
        $cotPrecio = $registrado['cot_precio'] ?? null;
        $cotParcial = $cotCantidad !== null && $cotPrecio !== null
            ? Cents::of($this->math->multiply($cotCantidad, $cotPrecio))
            : null;

        $celdas = [];
        $totalComprado = 0;
        foreach ($compras as $compra) {
            $valor = $registrado === null ? null : ($valores[$registrado['id']][$compra['id']] ?? null);
            if ($valor === null) {
                $celdas[$compra['id']] = null;

                continue;
            }
            $subtotal = $valor['cantidad'] !== null && $valor['precio'] !== null
                ? Cents::of($this->math->multiply($valor['cantidad'], $valor['precio']))
                : null;
            $totalComprado += $subtotal ?? 0;
            $celdas[$compra['id']] = [
                'cantidad' => Cents::fixed($valor['cantidad'], 4),
                'precio' => Cents::fixed($valor['precio'], 4),
                'subtotal' => $subtotal === null ? null : Cents::format($subtotal),
                'proveedor' => $valor['proveedor'],
            ];
        }

        return [
            'key' => $et['key'] ?? $registrado['insumo_key'],
            'id' => $registrado['public_id'] ?? null,
            'origen' => $et !== null ? 'expediente' : (($registrado['manual'] ?? false) ? 'manual' : 'huerfano'),
            'descripcion' => $et['descripcion'] ?? $registrado['descripcion'],
            'unidad' => $et['unidad'] ?? $registrado['unidad'],
            'et' => $et === null ? null : [
                'cantidad' => Cents::fixed($et['cantidad'], 4),
                'precio' => Cents::fixed($et['precio'], 4),
                'parcial' => Cents::format($etParcial),
            ],
            'cot' => [
                'cantidad' => Cents::fixed($cotCantidad, 4),
                'cantidad_source' => $cotCantidadSource,
                'precio' => Cents::fixed($cotPrecio, 4),
                'parcial' => $cotParcial === null ? null : Cents::format($cotParcial),
            ],
            'compras' => $celdas,
            'total_comprado' => Cents::format($totalComprado),
            'saldo' => Cents::format(($etParcial ?? 0) - $totalComprado),
        ];
    }

    public function totales(array $rows, array $compras): array
    {
        $et = 0;
        $cotizado = 0;
        $comprado = 0;
        $porCompra = array_fill_keys(array_column($compras, 'id'), 0);

        foreach ($rows as $row) {
            $et += $row['et'] === null ? 0 : Cents::of($row['et']['parcial']);
            $cotizado += Cents::of($row['cot']['parcial']);
            $comprado += Cents::of($row['total_comprado']);
            foreach ($row['compras'] as $compraId => $celda) {
                $porCompra[$compraId] += Cents::of($celda['subtotal'] ?? null);
            }
        }

        return [
            'et' => Cents::format($et),
            'cotizado' => Cents::format($cotizado),
            'compras' => array_map(fn (int $cents) => Cents::format($cents), $porCompra),
            'total_comprado' => Cents::format($comprado),
            'saldo' => Cents::format($et - $comprado),
            'estado' => $comprado > $et ? 'deficit' : ($comprado < $et ? 'superavit' : 'cuadra'),
        ];
    }
}
