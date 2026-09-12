<?php

namespace App\Services\Mantenimiento;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Domain\Mantenimiento\Mo\MoCalculator;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceInstitution;
use App\Models\Mantenimiento\MaintenanceMatMaterial;
use App\Models\Mantenimiento\MaintenanceMoParcial;
use App\Models\Mantenimiento\MaintenanceMoPartida;
use App\Models\Mantenimiento\MaintenanceMoSeries;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MaintenanceMoService
{
    public function __construct(
        private readonly MoCalculator $calculator,
        private readonly DecimalMath $math,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function payload(MaintenanceDocument $document, MaintenanceScenario $scenario): array
    {
        $partidas = $document->partidas()->get();
        $moPartidas = $scenario->moPartidas()->get()->keyBy('partida_public_id');
        $series = $scenario->moSeries()->get();
        $seriePublicById = $series->keyBy('id');

        $parciales = [];
        if ($series->isNotEmpty()) {
            foreach (MaintenanceMoParcial::query()->whereIn('serie_id', $series->pluck('id'))->get() as $row) {
                $seriePublic = $seriePublicById[$row->serie_id]->public_id;
                $parciales[$seriePublic][$row->partida_public_id] = (int) $row->monto_minor;
            }
        }

        $scenarioList = $document->escenarios()->where('tipo_hoja', 'mo')->get();

        return $this->calculator->payload($scenario, $scenarioList, $partidas, $moPartidas, $series, $parciales);
    }

    public function updatePartida(MaintenanceDocument $document, MaintenanceScenario $scenario, MaintenancePartida $partida, array $data): array
    {
        return $this->write($document, function () use ($scenario, $partida, $data) {
            $identidad = array_intersect_key($data, array_flip(['descripcion', 'item', 'unidad', 'metrado', 'mo_pu']));
            if ($identidad !== []) {
                if (array_key_exists('descripcion', $identidad) && $identidad['descripcion'] !== null) {
                    $partida->descripcion = $identidad['descripcion'];
                }
                if (array_key_exists('item', $identidad)) {
                    $partida->item = $identidad['item'] ?: null;
                    $partida->item_entero = $partida->tipo === 'ie' || (($identidad['item'] ?? null) !== null && ctype_digit((string) $identidad['item']));
                }
                if (array_key_exists('unidad', $identidad)) {
                    $partida->unidad = $identidad['unidad'] ?: null;
                }
                if (array_key_exists('metrado', $identidad)) {
                    $partida->metrado = $this->decimal($identidad['metrado'] ?? '0');
                }
                if (array_key_exists('mo_pu', $identidad)) {
                    $moPu = $this->decimal($identidad['mo_pu'] ?? '0');
                    $costos = $partida->costos_acu ?? [];
                    $costos['mano_obra'] = $moPu;
                    $partida->costos_acu = $costos;
                }
                $partida->parcial = $this->math->multiply((string) $partida->metrado, (string) $partida->precio_unitario);
                $partida->save();
            }

            $execKeys = ['cot_cantidad', 'cot_precio', 'presupuesto', 'observacion'];
            if (array_intersect_key($data, array_flip($execKeys)) === []) {
                return;
            }

            $mo = MaintenanceMoPartida::query()->firstOrNew([
                'escenario_id' => $scenario->id,
                'partida_public_id' => $partida->public_id,
            ]);

            if (array_key_exists('cot_cantidad', $data)) {
                $mo->cot_cantidad = $data['cot_cantidad'] === null ? null : $this->decimal($data['cot_cantidad']);
            }
            if (array_key_exists('cot_precio', $data)) {
                $mo->cot_precio = $data['cot_precio'] === null ? null : $this->decimal($data['cot_precio']);
            }
            if (array_key_exists('presupuesto', $data)) {
                if ($data['presupuesto'] === null) {
                    $mo->presupuesto_minor = null;
                    $mo->presupuesto_source = 'sugerido';
                } else {
                    $mo->presupuesto_minor = $this->toMinor($data['presupuesto']);
                    $mo->presupuesto_source = 'manual';
                }
            }
            if (array_key_exists('observacion', $data)) {
                $mo->observacion = $data['observacion'];
            }

            $mo->save();
        });
    }

    public function addSeries(MaintenanceDocument $document, MaintenanceScenario $scenario, ?string $fecha, ?string $etiqueta): array
    {
        return $this->write($document, function () use ($scenario, $fecha, $etiqueta) {
            $indice = (int) $scenario->moSeries()->max('indice') + 1;
            MaintenanceMoSeries::create([
                'public_id' => (string) Str::ulid(),
                'escenario_id' => $scenario->id,
                'indice' => $indice,
                'fecha' => $fecha,
                'etiqueta' => $etiqueta,
                'sort_order' => $indice * 1024,
            ]);
        });
    }

    public function updateSeries(MaintenanceDocument $document, MaintenanceMoSeries $serie, array $data): array
    {
        return $this->write($document, function () use ($serie, $data) {
            if (array_key_exists('fecha', $data)) {
                $serie->fecha = $data['fecha'];
            }
            if (array_key_exists('etiqueta', $data)) {
                $serie->etiqueta = $data['etiqueta'];
            }
            $serie->save();
        });
    }

    public function deleteSeries(MaintenanceDocument $document, MaintenanceMoSeries $serie): array
    {
        return $this->write($document, function () use ($serie) {
            $serie->delete();
        });
    }

    public function setParcial(MaintenanceDocument $document, MaintenanceMoSeries $serie, MaintenancePartida $partida, ?string $monto): array
    {
        return $this->write($document, function () use ($serie, $partida, $monto) {
            if ($monto === null || $monto === '') {
                MaintenanceMoParcial::query()
                    ->where('serie_id', $serie->id)
                    ->where('partida_public_id', $partida->public_id)
                    ->delete();

                return;
            }

            $parcial = MaintenanceMoParcial::query()->firstOrNew([
                'serie_id' => $serie->id,
                'partida_public_id' => $partida->public_id,
            ]);
            $parcial->monto_minor = $this->toMinor($monto);
            $parcial->save();
        });
    }

    public function addPartida(MaintenanceDocument $document, ?MaintenancePartida $parent, array $data): array
    {
        return $this->write($document, function () use ($document, $parent, $data) {
            // Una partida (hoja, con ejecución propia) que gana un hijo deja de ser hoja:
            // se asciende a bloque (categoría) para que el rollup de MoCalculator sume sus
            // hijos en vez de usar su propia fórmula de hoja y perderlos en silencio.
            if ($parent && $parent->tipo === 'partida') {
                $parent->tipo = 'bloque';
                $parent->save();
            }

            $tipo = $data['tipo'] ?? 'partida';
            $siblingsQuery = MaintenancePartida::query()
                ->where('documento_id', $document->id)
                ->where('parent_public_id', $parent?->public_id);
            $siblingsOrder = (clone $siblingsQuery)->max('sort_order');
            $siblingIndex = (clone $siblingsQuery)->count() + 1;

            $item = $data['item'] ?? null;
            if (($item === null || $item === '') && $tipo !== 'ie') {
                $item = $this->autoItem($parent, $siblingIndex);
            }

            $institucionId = $parent?->institucion_id;
            if ($tipo === 'ie') {
                $institucion = MaintenanceInstitution::create([
                    'documento_id' => $document->id,
                    'nombre' => $data['descripcion'],
                    'sort_order' => (int) MaintenanceInstitution::query()->where('documento_id', $document->id)->max('sort_order') + 1024,
                ]);
                $institucionId = $institucion->id;
            }

            $metrado = (string) ($data['metrado'] ?? 0);
            $moPu = (string) ($data['mo_pu'] ?? 0);

            MaintenancePartida::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'parent_public_id' => $parent?->public_id,
                'institucion_id' => $institucionId,
                'tipo' => $tipo,
                'item' => $item,
                'item_entero' => $tipo === 'ie' || ($item !== null && ctype_digit((string) $item)),
                'nivel' => $tipo === 'ie' ? 0 : ($parent?->nivel ?? 0) + 1,
                'descripcion' => $data['descripcion'],
                'unidad' => $data['unidad'] ?? null,
                'metrado' => $metrado,
                'precio_unitario' => $data['precio_unitario'] ?? 0,
                'parcial' => $this->math->multiply($metrado, (string) ($data['precio_unitario'] ?? 0)),
                'costos_acu' => $tipo === 'partida' && $this->math->compare($moPu, '0') !== 0 ? ['mano_obra' => $this->math->normalize($moPu)] : null,
                'sort_order' => (int) $siblingsOrder + 1024,
                'origen' => 'manual',
            ]);
        });
    }

    public function deletePartida(MaintenanceDocument $document, MaintenancePartida $partida): array
    {
        return $this->write($document, function () use ($partida) {
            if ($partida->children()->exists()) {
                throw ValidationException::withMessages(['partida' => 'Elimina primero las partidas hijas.']);
            }
            // La fila se elimina con todo su contenido: materiales MAT y datos MO del escenario.
            MaintenanceMatMaterial::query()->where('partida_public_id', $partida->public_id)->delete();
            MaintenanceMoParcial::query()->where('partida_public_id', $partida->public_id)->delete();
            MaintenanceMoPartida::query()->where('partida_public_id', $partida->public_id)->delete();
            $partida->delete();
        });
    }

    /**
     * Numeración automática tipo WBS/S10, calculada por posición en el árbol (no se persiste
     * como fórmula, solo se usa como valor inicial: el ítem sigue siendo editable a mano para
     * los casos irregulares que el propio expediente técnico a veces tiene).
     * - Hijo directo de una institución (nivel 1): "{índice}.01" → "1.01", "2.01"...
     * - Nietos en adelante: prefijo del padre con cada segmento a 2 dígitos + ".{índice a 2 dígitos}"
     *   → "1.01" da hijos "01.01.01", "01.01.02"...; "01.01.01" da hijos "01.01.01.01"...
     */
    private function autoItem(?MaintenancePartida $parent, int $siblingIndex): ?string
    {
        if ($parent === null) {
            return null;
        }
        if ($parent->tipo === 'ie') {
            return sprintf('%d.01', $siblingIndex);
        }

        $segments = $parent->item !== null && $parent->item !== '' ? explode('.', $parent->item) : [];
        if ($segments === []) {
            return null;
        }
        $prefix = implode('.', array_map(
            static fn (string $segment) => ctype_digit($segment) ? str_pad($segment, 2, '0', STR_PAD_LEFT) : $segment,
            $segments,
        ));

        return sprintf('%s.%s', $prefix, str_pad((string) $siblingIndex, 2, '0', STR_PAD_LEFT));
    }

    private function write(MaintenanceDocument $document, \Closure $mutation): array
    {
        return DB::connection('costos_tenant')->transaction(function () use ($document, $mutation) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $mutation();
            $locked->increment('revision');
            $scenario = $this->scenarios->activeFor($locked->refresh(), 'mo');

            return ['revision' => (int) $locked->revision, 'mo' => $this->payload($locked, $scenario)];
        }, attempts: 3);
    }

    private function decimal(mixed $value): string
    {
        return $this->math->normalize((string) $value);
    }

    private function toMinor(mixed $value): int
    {
        $rounded = $this->math->round((string) ($value === '' || $value === null ? '0' : $value), 2);
        $negative = str_starts_with($rounded, '-');
        [$units, $frac] = array_pad(explode('.', ltrim($rounded, '-'), 2), 2, '0');
        $cents = (int) $units * 100 + (int) str_pad(substr($frac.'00', 0, 2), 2, '0');

        return $negative ? -$cents : $cents;
    }
}
