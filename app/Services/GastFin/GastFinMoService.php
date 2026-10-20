<?php

namespace App\Services\GastFin;

use App\Domain\GastFin\Cents;
use App\Domain\GastFin\MoCalculator;
use App\Models\GastFin\GastFinMoPago;
use App\Models\GastFin\GastFinMoPagoValor;
use App\Models\Mantenimiento\MaintenanceDocument;
use Illuminate\Support\Str;

class GastFinMoService
{
    public function __construct(
        private readonly GastFinDocumentService $documents,
        private readonly MoCalculator $calculator,
    ) {}

    public function payload(MaintenanceDocument $document): array
    {
        $pagos = GastFinMoPago::query()->where('documento_id', $document->id)->orderBy('sort_order')->orderBy('id')->get();

        $valores = [];
        if ($pagos->isNotEmpty()) {
            $publicIds = $pagos->pluck('public_id', 'id');
            foreach (GastFinMoPagoValor::query()->whereIn('pago_id', $pagos->pluck('id'))->get() as $valor) {
                $valores[$publicIds[$valor->pago_id]][$valor->grupo_ref][$valor->franja] = [
                    'etiqueta' => $valor->etiqueta,
                    'monto_minor' => $valor->monto_minor,
                ];
            }
        }

        return $this->calculator->payload(
            $this->documents->expediente($document),
            $this->documents->grupoConfig($document),
            $pagos->map(fn (GastFinMoPago $pago) => [
                'id' => $pago->public_id,
                'nombre' => $pago->nombre,
                'fecha' => $pago->fecha?->toDateString(),
            ])->all(),
            $valores,
        );
    }

    public function response(MaintenanceDocument $document, int $revision): array
    {
        return ['revision' => $revision, 'mo' => $this->payload($document)];
    }

    public function addPago(MaintenanceDocument $document, string $nombre, ?string $fecha): array
    {
        $revision = $this->documents->write($document, function () use ($document, $nombre, $fecha) {
            GastFinMoPago::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'nombre' => $nombre,
                'fecha' => $fecha,
                'sort_order' => (int) GastFinMoPago::query()->where('documento_id', $document->id)->max('sort_order') + 1024,
            ]);
        });

        return $this->response($document, $revision);
    }

    /** @param array{nombre?:string, fecha?:?string} $data */
    public function updatePago(MaintenanceDocument $document, GastFinMoPago $pago, array $data): array
    {
        return $this->response($document, $this->documents->write($document, fn () => $pago->update($data)));
    }

    public function deletePago(MaintenanceDocument $document, GastFinMoPago $pago): array
    {
        return $this->response($document, $this->documents->write($document, fn () => $pago->delete()));
    }

    /** Celda etiqueta + monto de una franja (valorizacion | adelanto) de un grupo. Vacía = se borra. */
    public function setValor(MaintenanceDocument $document, GastFinMoPago $pago, string $grupoRef, string $franja, array $data): array
    {
        $this->documents->assertGrupo($document, $grupoRef);

        $revision = $this->documents->write($document, function () use ($pago, $grupoRef, $franja, $data) {
            $valor = GastFinMoPagoValor::query()->firstOrNew(['pago_id' => $pago->id, 'grupo_ref' => $grupoRef, 'franja' => $franja]);
            if (array_key_exists('etiqueta', $data)) {
                $valor->etiqueta = $data['etiqueta'] === null || trim($data['etiqueta']) === '' ? null : trim($data['etiqueta']);
            }
            if (array_key_exists('monto', $data)) {
                $valor->monto_minor = $data['monto'] === null ? null : Cents::of($data['monto']);
            }

            if ($valor->etiqueta === null && $valor->monto_minor === null) {
                if ($valor->exists) {
                    $valor->delete();
                }

                return;
            }
            $valor->save();
        });

        return $this->response($document, $revision);
    }
}
