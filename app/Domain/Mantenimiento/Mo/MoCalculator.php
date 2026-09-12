<?php

namespace App\Domain\Mantenimiento\Mo;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Models\Mantenimiento\MaintenanceMoPartida;
use App\Models\Mantenimiento\MaintenanceMoSeries;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Collection;

class MoCalculator
{
    public function __construct(private readonly DecimalMath $math) {}

    /**
     * @param  Collection<int, MaintenancePartida>  $partidas  ordenadas por sort_order
     * @param  Collection<string, MaintenanceMoPartida>  $moPartidas  keyed por partida_public_id
     * @param  Collection<int, MaintenanceMoSeries>  $series  ordenadas por indice
     * @param  array<string, array<string, int>>  $parciales  [serie_public_id][partida_public_id] => monto_minor
     */
    public function payload(
        MaintenanceScenario $scenario,
        Collection $scenarios,
        Collection $partidas,
        Collection $moPartidas,
        Collection $series,
        array $parciales,
    ): array {
        $serieIds = $series->pluck('public_id')->all();
        $childrenByParent = $partidas->groupBy('parent_public_id');
        $known = $partidas->keyBy('public_id');

        $computed = [];
        $roots = [];
        foreach ($partidas as $partida) {
            if ($partida->parent_public_id === null || ! $known->has($partida->parent_public_id)) {
                $this->compute($partida, $childrenByParent, $moPartidas, $serieIds, $parciales, $computed);
                $roots[] = $partida;
            }
        }

        // sort_order solo es único entre hermanos (se reinicia en cada nivel), así que ordenar
        // por esa columna a nivel global no reconstruye el árbol correctamente cuando hay ramas
        // distintas con valores empatados. Se recorre en profundidad (padre, luego sus hijos en
        // su propio orden local) en vez de reusar el orden plano de la query.
        $rows = [];
        $emit = function (MaintenancePartida $partida) use (&$emit, &$rows, $childrenByParent, $computed): void {
            $rows[] = $computed[$partida->public_id];
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
                'id' => $s->public_id,
                'nombre' => $s->nombre,
                'es_activo' => $s->es_activo,
            ])->values()->all(),
            'series' => $series->map(static fn ($s) => [
                'id' => $s->public_id,
                'indice' => (int) $s->indice,
                'fecha' => $s->fecha?->toDateString(),
                'etiqueta' => $s->etiqueta,
            ])->values()->all(),
            'rows' => $rows,
            'totales' => $this->totales($partidas, $computed, $serieIds),
        ];
    }

    /**
     * @param  array<string, array<string, int>>  $parciales
     * @param  array<string, array>  $computed
     */
    private function compute(
        MaintenancePartida $partida,
        Collection $childrenByParent,
        Collection $moPartidas,
        array $serieIds,
        array $parciales,
        array &$computed,
    ): array {
        $children = $childrenByParent->get($partida->public_id, collect());
        $childRows = [];
        foreach ($children as $child) {
            $childRows[] = $this->compute($child, $childrenByParent, $moPartidas, $serieIds, $parciales, $computed);
        }

        $mo = $moPartidas->get($partida->public_id);

        $costoMoUnit = $this->math->normalize((string) (($partida->costos_acu['mano_obra'] ?? null) ?? '0'));
        $metrado = $this->math->normalize((string) ($partida->metrado ?? '0'));

        $et = $partida->tipo === 'partida' ? [
            'cantidad' => $metrado,
            'precio' => $costoMoUnit,
            'parcial' => $this->math->multiply($metrado, $costoMoUnit),
        ] : $this->sumChildField($childRows, 'et');

        $cotCantidad = $mo && $mo->cot_cantidad !== null ? (string) $mo->cot_cantidad : $metrado;
        $cotPrecio = $mo && $mo->cot_precio !== null ? (string) $mo->cot_precio : null;
        $cot = $partida->tipo === 'partida' ? [
            'cantidad' => $this->math->normalize($cotCantidad),
            'precio' => $cotPrecio === null ? null : $this->math->normalize($cotPrecio),
            'parcial' => $cotPrecio === null ? '0' : $this->math->multiply($cotCantidad, $cotPrecio),
        ] : $this->sumChildField($childRows, 'cot');

        $sugeridoCents = $this->toCents($cot['parcial'] !== '0' ? $cot['parcial'] : $et['parcial']);

        $ownParciales = [];
        $ownParcialSum = 0;
        foreach ($serieIds as $serieId) {
            $value = $parciales[$serieId][$partida->public_id] ?? 0;
            $ownParciales[$serieId] = $value;
            $ownParcialSum += $value;
        }

        $rolledParciales = $ownParciales;
        foreach ($childRows as $childRow) {
            foreach ($serieIds as $serieId) {
                $rolledParciales[$serieId] += $childRow['_parciales_minor'][$serieId] ?? 0;
            }
        }

        $childFinalSum = 0;
        foreach ($childRows as $childRow) {
            $childFinalSum += $childRow['_final_minor'];
        }

        $finalMinor = $ownParcialSum + $childFinalSum;

        // El Presupuesto (y su Saldo) solo se define a nivel institución: es la bolsa de dinero
        // asignada a toda la I.E., contra la cual se van descontando los pagos parciales P.M.O
        // de todas sus partidas. Ya no se edita ni se acumula por partida individual.
        $esInstitucion = $partida->tipo === 'ie';
        $presupuestoManual = $esInstitucion && $mo && $mo->presupuesto_source === 'manual';
        $presupuestoMinor = $presupuestoManual ? (int) ($mo->presupuesto_minor ?? 0) : ($esInstitucion ? $sugeridoCents : 0);
        $saldoMinor = $presupuestoMinor - $finalMinor;

        $row = [
            'partida_id' => $partida->public_id,
            'parent_id' => $partida->parent_public_id,
            'institucion_id' => $partida->institucion_id,
            'tipo' => $partida->tipo,
            'item' => $partida->item,
            'item_entero' => (bool) $partida->item_entero,
            'nivel' => (int) $partida->nivel,
            'descripcion' => $partida->descripcion,
            'unidad' => $partida->unidad,
            'origen' => $partida->origen,
            'et' => $et,
            'cot' => $cot,
            'presupuesto' => $esInstitucion ? $this->fromCents($presupuestoMinor) : null,
            'presupuesto_source' => $esInstitucion ? ($presupuestoManual ? 'manual' : 'sugerido') : null,
            'presupuesto_sugerido' => $esInstitucion ? $this->fromCents($sugeridoCents) : null,
            'parciales' => array_map(fn (int $cents) => $this->fromCents($cents), $rolledParciales),
            'final' => $this->fromCents($finalMinor),
            'saldo' => $esInstitucion ? $this->fromCents($saldoMinor) : null,
            'descuadra' => $esInstitucion && $saldoMinor !== 0,
            'editable' => [
                'cot' => $partida->tipo === 'partida',
                'identidad' => true,
                'ejecucion' => true,
            ],
            '_parciales_minor' => $rolledParciales,
            '_final_minor' => $finalMinor,
            '_presupuesto_minor' => $presupuestoMinor,
        ];

        $computed[$partida->public_id] = $row;

        return $row;
    }

    private function sumChildField(array $childRows, string $field): array
    {
        $parcial = '0';
        foreach ($childRows as $childRow) {
            $parcial = $this->math->add($parcial, $childRow[$field]['parcial'] ?? '0');
        }

        return ['cantidad' => null, 'precio' => null, 'parcial' => $this->math->normalize($parcial)];
    }

    private function totales(Collection $partidas, array $computed, array $serieIds): array
    {
        $general = ['et_parcial' => 0, 'cot_parcial' => 0, 'presupuesto' => 0, 'final' => 0, 'saldo' => 0];
        $bySerie = array_fill_keys($serieIds, 0);
        $known = $partidas->keyBy('public_id');
        $roots = $partidas->filter(static fn (MaintenancePartida $p) => $p->parent_public_id === null || ! $known->has($p->parent_public_id));

        foreach ($roots as $root) {
            $row = $computed[$root->public_id];
            $general['et_parcial'] = $this->addCents($general['et_parcial'], $row['et']['parcial'] ?? '0');
            $general['cot_parcial'] = $this->addCents($general['cot_parcial'], $row['cot']['parcial'] ?? '0');
            $general['presupuesto'] += $row['_presupuesto_minor'];
            $general['final'] += $row['_final_minor'];
            foreach ($serieIds as $serieId) {
                $bySerie[$serieId] += $row['_parciales_minor'][$serieId] ?? 0;
            }
        }
        $general['saldo'] = $general['presupuesto'] - $general['final'];

        $descuadres = 0;
        foreach ($computed as $row) {
            if ($row['descuadra']) {
                $descuadres++;
            }
        }

        return [
            'general' => array_map(fn (int $cents) => $this->fromCents($cents), $general),
            'por_serie' => array_map(fn (int $cents) => $this->fromCents($cents), $bySerie),
            'descuadres' => $descuadres,
            'cuadra' => $general['saldo'] === 0,
        ];
    }

    private function addCents(int $cents, string $decimal): int
    {
        return $cents + $this->toCents($decimal);
    }

    private function toCents(string $decimal): int
    {
        $rounded = $this->math->round($decimal, 2);
        $negative = str_starts_with($rounded, '-');
        [$units, $frac] = array_pad(explode('.', ltrim($rounded, '-'), 2), 2, '0');
        $cents = (int) $units * 100 + (int) str_pad(substr($frac, 0, 2), 2, '0');

        return $negative ? -$cents : $cents;
    }

    private function fromCents(int $cents): string
    {
        $negative = $cents < 0;
        $cents = abs($cents);

        return ($negative ? '-' : '').intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
