<?php

namespace App\Services\Mantenimiento;

use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceGgPago;
use App\Models\Mantenimiento\MaintenanceGgPagoValor;
use App\Models\Mantenimiento\MaintenanceMatCompra;
use App\Models\Mantenimiento\MaintenanceMatCompraValor;
use App\Models\Mantenimiento\MaintenanceMatCotizacion;
use App\Models\Mantenimiento\MaintenanceMoParcial;
use App\Models\Mantenimiento\MaintenanceMoPartida;
use App\Models\Mantenimiento\MaintenanceMoSeries;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaintenanceScenarioService
{
    public function ensureDefault(MaintenanceDocument $document, string $tipoHoja, string $nombre): MaintenanceScenario
    {
        $existing = MaintenanceScenario::query()
            ->where('documento_id', $document->id)
            ->where('tipo_hoja', $tipoHoja)
            ->orderBy('sort_order')
            ->first();
        if ($existing) {
            return $existing;
        }

        return MaintenanceScenario::create([
            'public_id' => (string) Str::ulid(),
            'documento_id' => $document->id,
            'tipo_hoja' => $tipoHoja,
            'nombre' => $nombre,
            'es_activo' => true,
            'sort_order' => 1024,
        ]);
    }

    public function activeFor(MaintenanceDocument $document, string $tipoHoja): MaintenanceScenario
    {
        $scenarios = MaintenanceScenario::query()
            ->where('documento_id', $document->id)
            ->where('tipo_hoja', $tipoHoja)
            ->orderBy('sort_order')
            ->get();

        return $scenarios->firstWhere('es_activo', true)
            ?? $scenarios->first()
            ?? $this->ensureDefault($document, $tipoHoja, strtoupper($tipoHoja));
    }

    public function duplicate(MaintenanceScenario $source, string $nombre): MaintenanceScenario
    {
        return DB::connection('costos_tenant')->transaction(function () use ($source, $nombre) {
            $clone = MaintenanceScenario::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $source->documento_id,
                'tipo_hoja' => $source->tipo_hoja,
                'nombre' => $nombre,
                'es_activo' => false,
                'base_public_id' => $source->public_id,
                'sort_order' => (int) MaintenanceScenario::query()
                    ->where('documento_id', $source->documento_id)
                    ->where('tipo_hoja', $source->tipo_hoja)
                    ->max('sort_order') + 1024,
            ]);

            foreach ($source->matCotizaciones()->get() as $cot) {
                MaintenanceMatCotizacion::create(array_merge(
                    $cot->only(['material_public_id', 'slot', 'proveedor', 'cantidad', 'precio']),
                    ['escenario_id' => $clone->id],
                ));
            }
            foreach ($source->matCompras()->get() as $compra) {
                $newCompra = MaintenanceMatCompra::create([
                    'public_id' => (string) Str::ulid(),
                    'escenario_id' => $clone->id,
                    'indice' => $compra->indice,
                    'fecha' => $compra->fecha,
                    'etiqueta' => $compra->etiqueta,
                    'sort_order' => $compra->sort_order,
                ]);
                foreach ($compra->valores()->get() as $valor) {
                    MaintenanceMatCompraValor::create([
                        'compra_id' => $newCompra->id,
                        'material_public_id' => $valor->material_public_id,
                        'cantidad' => $valor->cantidad,
                        'precio' => $valor->precio,
                    ]);
                }
            }

            foreach ($source->moPartidas()->get() as $moPartida) {
                MaintenanceMoPartida::create(array_merge(
                    $moPartida->only(['partida_public_id', 'cot_cantidad', 'cot_precio', 'presupuesto_minor', 'presupuesto_source', 'observacion']),
                    ['escenario_id' => $clone->id],
                ));
            }

            $serieMap = [];
            foreach ($source->moSeries()->get() as $serie) {
                $newSerie = MaintenanceMoSeries::create([
                    'public_id' => (string) Str::ulid(),
                    'escenario_id' => $clone->id,
                    'indice' => $serie->indice,
                    'fecha' => $serie->fecha,
                    'etiqueta' => $serie->etiqueta,
                    'sort_order' => $serie->sort_order,
                ]);
                $serieMap[$serie->id] = $newSerie->id;
            }

            if ($serieMap !== []) {
                $parciales = MaintenanceMoParcial::query()->whereIn('serie_id', array_keys($serieMap))->get();
                foreach ($parciales as $parcial) {
                    MaintenanceMoParcial::create([
                        'serie_id' => $serieMap[$parcial->serie_id],
                        'partida_public_id' => $parcial->partida_public_id,
                        'monto_minor' => $parcial->monto_minor,
                    ]);
                }
            }

            $pagoMap = [];
            foreach ($source->ggPagos()->get() as $pago) {
                $newPago = MaintenanceGgPago::create([
                    'public_id' => (string) Str::ulid(),
                    'escenario_id' => $clone->id,
                    'indice' => $pago->indice,
                    'fecha' => $pago->fecha,
                    'etiqueta' => $pago->etiqueta,
                    'sort_order' => $pago->sort_order,
                ]);
                $pagoMap[$pago->id] = $newPago->id;
            }

            if ($pagoMap !== []) {
                $valores = MaintenanceGgPagoValor::query()->whereIn('pago_id', array_keys($pagoMap))->get();
                foreach ($valores as $valor) {
                    MaintenanceGgPagoValor::create([
                        'pago_id' => $pagoMap[$valor->pago_id],
                        'linea_public_id' => $valor->linea_public_id,
                        'monto_minor' => $valor->monto_minor,
                    ]);
                }
            }

            return $clone;
        });
    }

    public function activate(MaintenanceScenario $scenario): void
    {
        MaintenanceScenario::query()
            ->where('documento_id', $scenario->documento_id)
            ->where('tipo_hoja', $scenario->tipo_hoja)
            ->update(['es_activo' => false]);
        $scenario->update(['es_activo' => true]);
    }
}
