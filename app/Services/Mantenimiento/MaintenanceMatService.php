<?php

namespace App\Services\Mantenimiento;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Domain\Mantenimiento\Mat\MatCalculator;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceMatCompra;
use App\Models\Mantenimiento\MaintenanceMatCompraValor;
use App\Models\Mantenimiento\MaintenanceMatCotizacion;
use App\Models\Mantenimiento\MaintenanceMatMaterial;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaintenanceMatService
{
    public function __construct(
        private readonly MatCalculator $calculator,
        private readonly DecimalMath $math,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function payload(MaintenanceDocument $document, MaintenanceScenario $scenario): array
    {
        $partidas = $document->partidas()->get();
        $materiales = $document->matMateriales()->get();

        $cotizaciones = [];
        foreach ($scenario->matCotizaciones()->get() as $row) {
            $cotizaciones[$row->material_public_id][(int) $row->slot] = [
                'proveedor' => $row->proveedor,
                'cantidad' => $row->cantidad,
                'precio' => $row->precio,
            ];
        }

        $compras = $scenario->matCompras()->get();
        $valores = [];
        if ($compras->isNotEmpty()) {
            $compraPublicById = $compras->keyBy('id');
            foreach (MaintenanceMatCompraValor::query()->whereIn('compra_id', $compras->pluck('id'))->get() as $valor) {
                $publicId = $compraPublicById[$valor->compra_id]->public_id;
                $valores[$publicId][$valor->material_public_id] = ['cantidad' => $valor->cantidad, 'precio' => $valor->precio];
            }
        }

        $scenarioList = $document->escenarios()->where('tipo_hoja', 'mat')->get();

        return $this->calculator->payload($scenario, $scenarioList, $partidas, $materiales, $cotizaciones, $compras, $valores);
    }

    public function updateMaterial(MaintenanceDocument $document, MaintenanceMatMaterial $material, array $data): array
    {
        return $this->write($document, function () use ($material, $data) {
            foreach (['descripcion', 'unidad'] as $field) {
                if (array_key_exists($field, $data)) {
                    $material->{$field} = $data[$field] ?: ($field === 'descripcion' ? $material->descripcion : null);
                }
            }
            foreach (['cantidad', 'precio_unitario'] as $field) {
                if (array_key_exists($field, $data)) {
                    $material->{$field} = $this->math->normalize((string) ($data[$field] ?? '0'));
                }
            }
            $material->save();
        });
    }

    public function addMaterial(MaintenanceDocument $document, MaintenancePartida $partida, array $data): array
    {
        return $this->write($document, function () use ($document, $partida, $data) {
            $order = (int) MaintenanceMatMaterial::query()
                ->where('documento_id', $document->id)
                ->where('partida_public_id', $partida->public_id)
                ->max('sort_order');

            MaintenanceMatMaterial::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'partida_public_id' => $partida->public_id,
                'descripcion' => $data['descripcion'],
                'unidad' => $data['unidad'] ?? null,
                'cantidad' => $this->math->normalize((string) ($data['cantidad'] ?? '0')),
                'precio_unitario' => $this->math->normalize((string) ($data['precio_unitario'] ?? '0')),
                'sort_order' => $order + 1024,
                'origen' => 'manual',
            ]);
        });
    }

    public function deleteMaterial(MaintenanceDocument $document, MaintenanceMatMaterial $material): array
    {
        return $this->write($document, fn () => $material->delete());
    }

    public function setCotizacion(MaintenanceDocument $document, MaintenanceScenario $scenario, MaintenanceMatMaterial $material, int $slot, array $data): array
    {
        return $this->write($document, function () use ($scenario, $material, $slot, $data) {
            $cot = MaintenanceMatCotizacion::query()->firstOrNew([
                'escenario_id' => $scenario->id,
                'material_public_id' => $material->public_id,
                'slot' => $slot,
            ]);
            if (array_key_exists('proveedor', $data)) {
                $cot->proveedor = $data['proveedor'] ?: null;
            }
            if (array_key_exists('cantidad', $data)) {
                $cot->cantidad = $data['cantidad'] === null || $data['cantidad'] === '' ? null : $this->math->normalize((string) $data['cantidad']);
            }
            if (array_key_exists('precio', $data)) {
                $cot->precio = $data['precio'] === null || $data['precio'] === '' ? null : $this->math->normalize((string) $data['precio']);
            }
            $cot->save();
        });
    }

    public function addCompra(MaintenanceDocument $document, MaintenanceScenario $scenario, ?string $fecha, ?string $etiqueta): array
    {
        return $this->write($document, function () use ($scenario, $fecha, $etiqueta) {
            $indice = (int) $scenario->matCompras()->max('indice') + 1;
            MaintenanceMatCompra::create([
                'public_id' => (string) Str::ulid(),
                'escenario_id' => $scenario->id,
                'indice' => $indice,
                'fecha' => $fecha,
                'etiqueta' => $etiqueta,
                'sort_order' => $indice * 1024,
            ]);
        });
    }

    public function updateCompra(MaintenanceDocument $document, MaintenanceMatCompra $compra, array $data): array
    {
        return $this->write($document, function () use ($compra, $data) {
            if (array_key_exists('fecha', $data)) {
                $compra->fecha = $data['fecha'] ?: null;
            }
            if (array_key_exists('etiqueta', $data)) {
                $compra->etiqueta = $data['etiqueta'] ?: null;
            }
            $compra->save();
        });
    }

    public function deleteCompra(MaintenanceDocument $document, MaintenanceMatCompra $compra): array
    {
        return $this->write($document, fn () => $compra->delete());
    }

    public function setCompraValor(MaintenanceDocument $document, MaintenanceMatCompra $compra, MaintenanceMatMaterial $material, array $data): array
    {
        return $this->write($document, function () use ($compra, $material, $data) {
            $valor = MaintenanceMatCompraValor::query()->firstOrNew([
                'compra_id' => $compra->id,
                'material_public_id' => $material->public_id,
            ]);
            if (array_key_exists('cantidad', $data)) {
                $valor->cantidad = $data['cantidad'] === null || $data['cantidad'] === '' ? null : $this->math->normalize((string) $data['cantidad']);
            }
            if (array_key_exists('precio', $data)) {
                $valor->precio = $data['precio'] === null || $data['precio'] === '' ? null : $this->math->normalize((string) $data['precio']);
            }

            if ($valor->cantidad === null && $valor->precio === null && $valor->exists) {
                $valor->delete();

                return;
            }
            $valor->save();
        });
    }

    private function write(MaintenanceDocument $document, \Closure $mutation): array
    {
        return DB::connection('costos_tenant')->transaction(function () use ($document, $mutation) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $mutation();
            $locked->increment('revision');
            $scenario = $this->scenarios->activeFor($locked->refresh(), 'mat');

            return ['revision' => (int) $locked->revision, 'mat' => $this->payload($locked, $scenario)];
        }, attempts: 3);
    }
}
