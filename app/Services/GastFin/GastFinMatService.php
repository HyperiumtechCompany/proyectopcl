<?php

namespace App\Services\GastFin;

use App\Domain\GastFin\Cents;
use App\Domain\GastFin\MatCalculator;
use App\Models\GastFin\GastFinMatCompra;
use App\Models\GastFin\GastFinMatCompraValor;
use App\Models\GastFin\GastFinMatInsumo;
use App\Models\Mantenimiento\MaintenanceDocument;
use Illuminate\Support\Str;

/**
 * MAT de Gast. Fin., una pestaña por grupo de nivel 1. Las filas del E.T. no se guardan: la fila
 * registrada (gastfin_mat_insumos) se crea recién cuando el usuario escribe un cotizado o una
 * compra, identificada por insumo_key. Editar una celda devuelve solo la fila + totales (delta);
 * las operaciones estructurales devuelven la pestaña completa.
 */
class GastFinMatService
{
    public function __construct(
        private readonly GastFinDocumentService $documents,
        private readonly MatCalculator $calculator,
    ) {}

    public function payload(MaintenanceDocument $document, string $grupoRef): array
    {
        $this->documents->assertGrupo($document, $grupoRef);

        return [
            'grupo_ref' => $grupoRef,
            'sin_metrado' => $this->documents->expediente($document)['sin_metrado'][$grupoRef] ?? 0,
            ...$this->calculate($document, $grupoRef),
        ];
    }

    public function response(MaintenanceDocument $document, string $grupoRef, int $revision): array
    {
        return ['revision' => $revision, 'mat' => $this->payload($document, $grupoRef)];
    }

    /** Respuesta liviana tras editar una celda: la fila tocada + totales de la pestaña. */
    public function delta(MaintenanceDocument $document, string $grupoRef, string $insumoKey, int $revision): array
    {
        $mat = $this->calculate($document, $grupoRef);
        $row = collect($mat['rows'])->firstWhere('key', $insumoKey);

        return ['revision' => $revision, 'row' => $row, 'totales' => $mat['totales']];
    }

    /** @param array{cantidad?:?string, precio?:?string} $data */
    public function setCotizacion(MaintenanceDocument $document, string $grupoRef, string $insumoKey, array $data): array
    {
        $revision = $this->documents->write($document, function () use ($document, $grupoRef, $insumoKey, $data) {
            $insumo = $this->ensureInsumo($document, $grupoRef, $insumoKey);
            if (array_key_exists('cantidad', $data)) {
                $insumo->cot_cantidad = Cents::fixed($data['cantidad'], 4);
            }
            if (array_key_exists('precio', $data)) {
                $insumo->cot_precio = Cents::fixed($data['precio'], 4);
            }
            $insumo->save();
        });

        return $this->delta($document, $grupoRef, $insumoKey, $revision);
    }

    /** @param array{cantidad?:?string, precio?:?string, proveedor?:?string} $data */
    public function setCompraValor(MaintenanceDocument $document, GastFinMatCompra $compra, string $insumoKey, array $data): array
    {
        $revision = $this->documents->write($document, function () use ($document, $compra, $insumoKey, $data) {
            $insumo = $this->ensureInsumo($document, $compra->grupo_ref, $insumoKey);
            $valor = GastFinMatCompraValor::query()->firstOrNew(['compra_id' => $compra->id, 'insumo_id' => $insumo->id]);
            foreach (['cantidad', 'precio'] as $field) {
                if (array_key_exists($field, $data)) {
                    $valor->{$field} = Cents::fixed($data[$field], 4);
                }
            }
            if (array_key_exists('proveedor', $data)) {
                $proveedor = trim((string) $data['proveedor']);
                $valor->proveedor = $proveedor === '' ? null : $proveedor;
            }

            if ($valor->cantidad === null && $valor->precio === null && $valor->proveedor === null) {
                if ($valor->exists) {
                    $valor->delete();
                }

                return;
            }
            $valor->save();
        });

        return $this->delta($document, $compra->grupo_ref, $insumoKey, $revision);
    }

    public function addCompra(MaintenanceDocument $document, string $grupoRef, ?string $fecha): array
    {
        $this->documents->assertGrupo($document, $grupoRef);

        $revision = $this->documents->write($document, function () use ($document, $grupoRef, $fecha) {
            GastFinMatCompra::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'grupo_ref' => $grupoRef,
                'fecha' => $fecha,
                'sort_order' => (int) GastFinMatCompra::query()->where('documento_id', $document->id)->where('grupo_ref', $grupoRef)->max('sort_order') + 1024,
            ]);
        });

        return $this->response($document, $grupoRef, $revision);
    }

    public function updateCompra(MaintenanceDocument $document, GastFinMatCompra $compra, ?string $fecha): array
    {
        $revision = $this->documents->write($document, fn () => $compra->update(['fecha' => $fecha]));

        return $this->response($document, $compra->grupo_ref, $revision);
    }

    public function deleteCompra(MaintenanceDocument $document, GastFinMatCompra $compra): array
    {
        $revision = $this->documents->write($document, fn () => $compra->delete());

        return $this->response($document, $compra->grupo_ref, $revision);
    }

    /** Insumo comprado que no está en el E.T. (p. ej. otra variante de acero). */
    public function addManual(MaintenanceDocument $document, string $grupoRef, string $descripcion, ?string $unidad): array
    {
        $this->documents->assertGrupo($document, $grupoRef);

        $revision = $this->documents->write($document, function () use ($document, $grupoRef, $descripcion, $unidad) {
            GastFinMatInsumo::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'grupo_ref' => $grupoRef,
                'insumo_key' => 'manual|'.Str::ulid(),
                'descripcion' => trim($descripcion),
                'unidad' => $unidad,
                'manual' => true,
            ]);
        });

        return $this->response($document, $grupoRef, $revision);
    }

    /** Solo filas manuales: las del E.T. se renombran en el ACU. */
    public function updateManual(MaintenanceDocument $document, GastFinMatInsumo $insumo, array $data): array
    {
        abort_unless($insumo->manual, 422, 'Solo se pueden editar insumos agregados a mano; los del expediente se editan en el ACU.');

        $revision = $this->documents->write($document, fn () => $insumo->update($data));

        return $this->response($document, $insumo->grupo_ref, $revision);
    }

    /** Borra lo registrado de la fila (cotizado y compras). Si la fila es del E.T., el E.T. sigue. */
    public function deleteInsumo(MaintenanceDocument $document, GastFinMatInsumo $insumo): array
    {
        $revision = $this->documents->write($document, fn () => $insumo->delete());

        return $this->response($document, $insumo->grupo_ref, $revision);
    }

    private function calculate(MaintenanceDocument $document, string $grupoRef): array
    {
        return $this->calculateGroups($document, [$grupoRef])[$grupoRef];
    }

    /**
     * MAT de todos los niveles con 3 consultas en total (para RESUMEN).
     *
     * @return array<string, array> por grupo_ref
     */
    public function allGroups(MaintenanceDocument $document): array
    {
        return $this->calculateGroups($document, array_column($this->documents->expediente($document)['grupos'], 'ref'));
    }

    /** @param list<string> $grupoRefs */
    private function calculateGroups(MaintenanceDocument $document, array $grupoRefs): array
    {
        $expediente = $this->documents->expediente($document)['insumos'];

        $insumos = GastFinMatInsumo::query()->where('documento_id', $document->id)->whereIn('grupo_ref', $grupoRefs)->get();
        $compras = GastFinMatCompra::query()->where('documento_id', $document->id)->whereIn('grupo_ref', $grupoRefs)
            ->orderBy('sort_order')->orderBy('id')->get();

        $valores = [];
        if ($compras->isNotEmpty() && $insumos->isNotEmpty()) {
            $publicIds = $compras->pluck('public_id', 'id');
            foreach (GastFinMatCompraValor::query()->whereIn('compra_id', $compras->pluck('id'))->get() as $valor) {
                $valores[$valor->insumo_id][$publicIds[$valor->compra_id]] = [
                    'cantidad' => $valor->cantidad,
                    'precio' => $valor->precio,
                    'proveedor' => $valor->proveedor,
                ];
            }
        }

        $insumosByGrupo = $insumos->groupBy('grupo_ref');
        $comprasByGrupo = $compras->groupBy('grupo_ref');

        $result = [];
        foreach ($grupoRefs as $grupoRef) {
            $result[$grupoRef] = $this->calculator->payload(
                $expediente[$grupoRef]['materiales'] ?? [],
                ($insumosByGrupo[$grupoRef] ?? collect())->map(fn (GastFinMatInsumo $insumo) => [
                    'id' => $insumo->id,
                    'public_id' => $insumo->public_id,
                    'insumo_key' => $insumo->insumo_key,
                    'descripcion' => $insumo->descripcion,
                    'unidad' => $insumo->unidad,
                    'manual' => $insumo->manual,
                    'cot_cantidad' => $insumo->cot_cantidad,
                    'cot_precio' => $insumo->cot_precio,
                ])->values()->all(),
                ($comprasByGrupo[$grupoRef] ?? collect())
                    ->map(fn (GastFinMatCompra $compra) => ['id' => $compra->public_id, 'fecha' => $compra->fecha?->toDateString()])
                    ->values()->all(),
                $valores,
            );
        }

        return $result;
    }

    private function ensureInsumo(MaintenanceDocument $document, string $grupoRef, string $insumoKey): GastFinMatInsumo
    {
        $existing = GastFinMatInsumo::query()
            ->where('documento_id', $document->id)
            ->where('grupo_ref', $grupoRef)
            ->where('insumo_key', $insumoKey)
            ->first();
        if ($existing !== null) {
            return $existing;
        }

        $et = $this->documents->expediente($document)['insumos'][$grupoRef]['materiales'][$insumoKey] ?? null;
        abort_if($et === null, 422, 'El material ya no está en el expediente técnico de este nivel.');

        return GastFinMatInsumo::create([
            'public_id' => (string) Str::ulid(),
            'documento_id' => $document->id,
            'grupo_ref' => $grupoRef,
            'insumo_key' => $insumoKey,
            'descripcion' => $et['descripcion'],
            'unidad' => $et['unidad'],
            'manual' => false,
            'sort_order' => 0,
        ]);
    }
}
