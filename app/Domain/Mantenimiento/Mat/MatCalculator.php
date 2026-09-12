<?php

namespace App\Domain\Mantenimiento\Mat;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Models\Mantenimiento\MaintenanceMatCompra;
use App\Models\Mantenimiento\MaintenanceMatMaterial;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Collection;

class MatCalculator
{
    public function __construct(private readonly DecimalMath $math) {}

    /**
     * @param  Collection<int, MaintenancePartida>  $partidas
     * @param  Collection<int, MaintenanceMatMaterial>  $materiales
     * @param  array<string, array<int, array{proveedor: ?string, cantidad: ?string, precio: ?string}>>  $cotizaciones  [material_public_id][slot]
     * @param  Collection<int, MaintenanceMatCompra>  $compras
     * @param  array<string, array<string, array{cantidad: ?string, precio: ?string}>>  $valores  [compra_public_id][material_public_id]
     */
    public function payload(
        MaintenanceScenario $scenario,
        Collection $scenarios,
        Collection $partidas,
        Collection $materiales,
        array $cotizaciones,
        Collection $compras,
        array $valores,
    ): array {
        $compraIds = $compras->pluck('public_id')->all();
        $materialsByPartida = $materiales->groupBy('partida_public_id');
        $childrenByParent = $partidas->groupBy('parent_public_id');
        $known = $partidas->keyBy('public_id');

        $computed = [];
        $roots = [];
        foreach ($partidas as $partida) {
            if ($partida->parent_public_id === null || ! $known->has($partida->parent_public_id)) {
                $this->computePartida($partida, $childrenByParent, $materialsByPartida, $cotizaciones, $compraIds, $valores, $computed);
                $roots[] = $partida;
            }
        }

        // Mismo fix que MoCalculator: sort_order solo es único entre hermanos, recorrer en
        // profundidad en vez de reusar el orden plano de la query (que empata entre ramas).
        $rows = [];
        $emit = function (MaintenancePartida $partida) use (&$emit, &$rows, $childrenByParent, $materialsByPartida, $computed): void {
            $rows[] = $computed[$partida->public_id]['row'];
            foreach ($materialsByPartida->get($partida->public_id, collect()) as $material) {
                $rows[] = $computed['mat:'.$material->public_id];
            }
            foreach ($childrenByParent->get($partida->public_id, collect()) as $child) {
                $emit($child);
            }
        };
        foreach ($roots as $root) {
            $emit($root);
        }

        return [
            'scenario' => ['id' => $scenario->public_id, 'nombre' => $scenario->nombre],
            'scenarios' => $scenarios->map(static fn (MaintenanceScenario $s) => [
                'id' => $s->public_id, 'nombre' => $s->nombre, 'es_activo' => $s->es_activo,
            ])->values()->all(),
            'compras' => $compras->map(static fn ($c) => [
                'id' => $c->public_id, 'indice' => (int) $c->indice, 'fecha' => $c->fecha?->toDateString(), 'etiqueta' => $c->etiqueta,
            ])->values()->all(),
            'rows' => $rows,
            'totales' => $this->totales($partidas, $computed, $compraIds),
        ];
    }

    private function computePartida(
        MaintenancePartida $partida,
        Collection $childrenByParent,
        Collection $materialsByPartida,
        array $cotizaciones,
        array $compraIds,
        array $valores,
        array &$computed,
    ): array {
        $ptEt = 0;
        $comprado = 0;
        $porCompra = array_fill_keys($compraIds, 0);

        foreach ($materialsByPartida->get($partida->public_id, collect()) as $material) {
            $matRow = $this->computeMaterial($material, $partida, $cotizaciones, $compraIds, $valores);
            $computed['mat:'.$material->public_id] = $matRow;
            $ptEt += $matRow['_pt_et_minor'];
            $comprado += $matRow['_comprado_minor'];
            foreach ($compraIds as $compraId) {
                $porCompra[$compraId] += $matRow['_por_compra_minor'][$compraId] ?? 0;
            }
        }

        foreach ($childrenByParent->get($partida->public_id, collect()) as $child) {
            $childData = $this->computePartida($child, $childrenByParent, $materialsByPartida, $cotizaciones, $compraIds, $valores, $computed);
            $ptEt += $childData['_pt_et_minor'];
            $comprado += $childData['_comprado_minor'];
            foreach ($compraIds as $compraId) {
                $porCompra[$compraId] += $childData['_por_compra_minor'][$compraId] ?? 0;
            }
        }

        $saldo = $ptEt - $comprado;
        $data = [
            '_pt_et_minor' => $ptEt,
            '_comprado_minor' => $comprado,
            '_por_compra_minor' => $porCompra,
            'row' => [
                'partida_id' => $partida->public_id,
                'parent_id' => $partida->parent_public_id,
                'tipo' => $partida->tipo,
                'es_material' => false,
                'item' => $partida->item,
                'item_entero' => (bool) $partida->item_entero,
                'nivel' => (int) $partida->nivel,
                'descripcion' => $partida->descripcion,
                'unidad' => $partida->unidad,
                'metrado' => $this->math->normalize((string) ($partida->metrado ?? '0')),
                'origen' => $partida->origen,
                'pt_et' => $this->fromCents($ptEt),
                'total_comprado' => $this->fromCents($comprado),
                'saldo' => $this->fromCents($saldo),
                'descuadra' => $partida->tipo === 'partida' && $saldo !== 0,
                'por_compra' => array_map(fn (int $c) => $this->fromCents($c), $porCompra),
            ],
        ];
        $computed[$partida->public_id] = $data;

        return $data;
    }

    private function computeMaterial(
        MaintenanceMatMaterial $material,
        MaintenancePartida $partida,
        array $cotizaciones,
        array $compraIds,
        array $valores,
    ): array {
        $cantidadEt = $this->math->normalize((string) ($material->cantidad ?? '0'));
        $precioEt = $this->math->normalize((string) ($material->precio_unitario ?? '0'));
        $ptEt = $this->math->multiply($cantidadEt, $precioEt);

        $cots = [];
        $minPu = null;
        for ($slot = 1; $slot <= 3; $slot++) {
            $stored = $cotizaciones[$material->public_id][$slot] ?? [];
            $cantidad = isset($stored['cantidad']) && $stored['cantidad'] !== null ? $this->math->normalize((string) $stored['cantidad']) : $cantidadEt;
            $precio = isset($stored['precio']) && $stored['precio'] !== null ? $this->math->normalize((string) $stored['precio']) : null;
            $cots[] = [
                'slot' => $slot,
                'proveedor' => $stored['proveedor'] ?? null,
                'cantidad' => $cantidad,
                'precio' => $precio,
                'pt' => $precio === null ? '0' : $this->math->multiply($cantidad, $precio),
            ];
            if ($precio !== null && $this->math->compare($precio, '0') > 0 && ($minPu === null || $this->math->compare($precio, $minPu) < 0)) {
                $minPu = $precio;
            }
        }
        $ptReferencia = $minPu === null ? null : $this->math->multiply($cantidadEt, $minPu);

        $compras = [];
        $porCompra = [];
        $comprado = 0;
        foreach ($compraIds as $compraId) {
            $stored = $valores[$compraId][$material->public_id] ?? [];
            $cantidad = isset($stored['cantidad']) && $stored['cantidad'] !== null ? $this->math->normalize((string) $stored['cantidad']) : null;
            $precio = isset($stored['precio']) && $stored['precio'] !== null ? $this->math->normalize((string) $stored['precio']) : null;
            $subtotal = ($cantidad === null || $precio === null) ? '0' : $this->math->multiply($cantidad, $precio);
            $compras[$compraId] = ['cantidad' => $cantidad, 'precio' => $precio, 'subtotal' => $subtotal];
            $subtotalMinor = $this->toCents($subtotal);
            $porCompra[$compraId] = $subtotalMinor;
            $comprado += $subtotalMinor;
        }

        $ptEtMinor = $this->toCents($ptEt);
        $saldo = $ptEtMinor - $comprado;

        return [
            'material_id' => $material->public_id,
            'partida_id' => $partida->public_id,
            'tipo' => 'material',
            'es_material' => true,
            'nivel' => (int) $partida->nivel + 1,
            'descripcion' => $material->descripcion,
            'unidad' => $material->unidad,
            'origen' => $material->origen,
            'et' => ['cantidad' => $cantidadEt, 'precio' => $precioEt, 'pt' => $ptEt],
            'cotizaciones' => $cots,
            'pu_minimo' => $minPu,
            'pt_referencia' => $ptReferencia,
            'compras' => $compras,
            'total_comprado' => $this->fromCents($comprado),
            'saldo' => $this->fromCents($saldo),
            'descuadra' => $saldo !== 0,
            '_pt_et_minor' => $ptEtMinor,
            '_comprado_minor' => $comprado,
            '_por_compra_minor' => $porCompra,
        ];
    }

    private function totales(Collection $partidas, array $computed, array $compraIds): array
    {
        $known = $partidas->keyBy('public_id');
        $roots = $partidas->filter(static fn (MaintenancePartida $p) => $p->parent_public_id === null || ! $known->has($p->parent_public_id));

        $ptEt = 0;
        $comprado = 0;
        $porCompra = array_fill_keys($compraIds, 0);
        foreach ($roots as $root) {
            $data = $computed[$root->public_id];
            $ptEt += $data['_pt_et_minor'];
            $comprado += $data['_comprado_minor'];
            foreach ($compraIds as $compraId) {
                $porCompra[$compraId] += $data['_por_compra_minor'][$compraId] ?? 0;
            }
        }

        $diferencia = $ptEt - $comprado;
        $descuadres = 0;
        foreach ($computed as $key => $entry) {
            $row = is_string($key) && str_starts_with($key, 'mat:') ? $entry : $entry['row'];
            if (($row['descuadra'] ?? false) === true) {
                $descuadres++;
            }
        }

        return [
            'general' => [
                'pt_et' => $this->fromCents($ptEt),
                'total_comprado' => $this->fromCents($comprado),
                'saldo' => $this->fromCents($diferencia),
            ],
            'por_compra' => array_map(fn (int $c) => $this->fromCents($c), $porCompra),
            'conciliacion' => [
                'exp_tec' => $this->fromCents($ptEt),
                'corregido' => $this->fromCents($comprado),
                'diferencia' => $this->fromCents($diferencia),
                'estado' => $diferencia === 0 ? 'cuadra' : ($diferencia > 0 ? 'superavit' : 'deficit'),
            ],
            'descuadres' => $descuadres,
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
