<?php

namespace App\Services\Mantenimiento;

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Domain\Mantenimiento\Gg\GgCalculator;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceGgLinea;
use App\Models\Mantenimiento\MaintenanceGgPago;
use App\Models\Mantenimiento\MaintenanceGgPagoValor;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaintenanceGgService
{
    /**
     * Estructura estándar de Gastos Generales (fianzas, seguros, administración de obra…),
     * lista para ajustar cantidad/costo unitario. No se importa de ningún lado: es la
     * plantilla típica de un Programa de mantenimiento de I.E.
     *
     * @var array<string, array<string, array<int, array{0: string, 1: ?string}>>>
     */
    private const PLANTILLA = [
        'fijo' => [
            'Fianzas: Contratación' => [
                ['Fianza por Garantía de Fiel Cumplimiento', null],
                ['Fianza por Garantía de Adelanto en Efectivo', null],
                ['Fianza por Garantía de Adelanto en Materiales', null],
            ],
            'Seguros: Contratación' => [
                ['Póliza de Seguros C.A.R. Contra Todo Riesgo', null],
                ['Póliza SCTR del Personal de Administración y Control de Obra', null],
                ['Póliza de Seguros ESSALUD + VIDA', null],
            ],
            'Impuestos: Sencico, ITF y Sunat' => [
                ['Sencico (0.20% del presupuesto)', null],
                ['Impuestos ITF', null],
                ['Sunat', null],
            ],
        ],
        'variable' => [
            'Gastos de Administración en Obra' => [
                ['Ingeniero Residente de Obra', 'mes'],
                ['Administrador de Obra', 'mes'],
                ['Jefe de Área', 'mes'],
                ['Asistente de Obra', 'mes'],
            ],
            'Beneficios Sociales del Personal' => [
                ['Asignación Familiar', null],
                ['ESSALUD', null],
                ['CTS', null],
                ['Vacaciones', null],
                ['Gratificación', null],
            ],
            'Equipamiento y Mobiliario de Oficina' => [
                ['Útiles de escritorio y fotocopias', 'mes'],
                ['Computadoras e impresora', 'und'],
                ['Mobiliario de oficina', 'und'],
            ],
            'Ensayos y Pruebas de Calidad' => [
                ['Diseño de mezclas', 'und'],
                ['Roturas de probeta', 'und'],
            ],
            'Alquileres y Servicios de Obra' => [
                ['Alimentación', 'mes'],
                ['Alquiler de alojamiento', 'mes'],
            ],
            'Movilidad y Transporte Interno' => [
                ['Furgón y transporte interno', 'und'],
            ],
            'Gastos Financieros Complementarios' => [
                ['Comisiones y renovación de fianzas', null],
            ],
            'Etapa de Recepción y Liquidación de Obra' => [
                ['Personal profesional clave (liquidación)', 'mes'],
                ['Gastos administrativos de cierre', 'glb'],
            ],
        ],
    ];

    public function __construct(
        private readonly GgCalculator $calculator,
        private readonly DecimalMath $math,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function seedPlantilla(MaintenanceDocument $document): array
    {
        return $this->write($document, function () use ($document) {
            if ($document->ggLineas()->exists()) {
                return;
            }

            $order = 0;
            foreach (self::PLANTILLA as $grupo => $rubros) {
                foreach ($rubros as $rubro => $lineas) {
                    foreach ($lineas as [$descripcion, $unidad]) {
                        $order += 1024;
                        MaintenanceGgLinea::create([
                            'public_id' => (string) Str::ulid(),
                            'documento_id' => $document->id,
                            'grupo' => $grupo,
                            'rubro' => $rubro,
                            'descripcion' => $descripcion,
                            'unidad' => $unidad,
                            'cantidad' => '0',
                            'costo_unitario' => '0',
                            'sort_order' => $order,
                            'origen' => 'manual',
                        ]);
                    }
                }
            }
        });
    }

    public function payload(MaintenanceDocument $document, MaintenanceScenario $scenario): array
    {
        $lineas = $document->ggLineas()->get();
        $pagos = $scenario->ggPagos()->get();

        $valores = [];
        if ($pagos->isNotEmpty()) {
            $pagoPublicById = $pagos->keyBy('id');
            foreach (MaintenanceGgPagoValor::query()->whereIn('pago_id', $pagos->pluck('id'))->get() as $valor) {
                $publicId = $pagoPublicById[$valor->pago_id]->public_id;
                $valores[$publicId][$valor->linea_public_id] = (int) $valor->monto_minor;
            }
        }

        $scenarioList = $document->escenarios()->where('tipo_hoja', 'gg')->get();

        return $this->calculator->payload($scenario, $scenarioList, $lineas, $pagos, $valores);
    }

    public function addLinea(MaintenanceDocument $document, array $data): array
    {
        return $this->write($document, function () use ($document, $data) {
            $order = (int) MaintenanceGgLinea::query()
                ->where('documento_id', $document->id)
                ->where('grupo', $data['grupo'])
                ->max('sort_order');

            MaintenanceGgLinea::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'grupo' => $data['grupo'],
                'rubro' => $data['rubro'],
                'descripcion' => $data['descripcion'],
                'unidad' => $data['unidad'] ?? null,
                'cantidad' => $this->math->normalize((string) ($data['cantidad'] ?? '0')),
                'costo_unitario' => $this->math->normalize((string) ($data['costo_unitario'] ?? '0')),
                'gasto_proyectado' => isset($data['gasto_proyectado']) && $data['gasto_proyectado'] !== null && $data['gasto_proyectado'] !== ''
                    ? $this->math->normalize((string) $data['gasto_proyectado'])
                    : null,
                'sort_order' => $order + 1024,
                'origen' => 'manual',
            ]);
        });
    }

    public function updateLinea(MaintenanceDocument $document, MaintenanceGgLinea $linea, array $data): array
    {
        return $this->write($document, function () use ($linea, $data) {
            foreach (['rubro', 'descripcion', 'unidad'] as $field) {
                if (array_key_exists($field, $data)) {
                    $linea->{$field} = $data[$field] ?: ($field === 'unidad' ? null : $linea->{$field});
                }
            }
            foreach (['cantidad', 'costo_unitario'] as $field) {
                if (array_key_exists($field, $data)) {
                    $linea->{$field} = $this->math->normalize((string) ($data[$field] ?? '0'));
                }
            }
            if (array_key_exists('gasto_proyectado', $data)) {
                $linea->gasto_proyectado = $data['gasto_proyectado'] === null || $data['gasto_proyectado'] === ''
                    ? null
                    : $this->math->normalize((string) $data['gasto_proyectado']);
            }
            $linea->save();
        });
    }

    public function deleteLinea(MaintenanceDocument $document, MaintenanceGgLinea $linea): array
    {
        return $this->write($document, function () use ($linea) {
            MaintenanceGgPagoValor::query()->where('linea_public_id', $linea->public_id)->delete();
            $linea->delete();
        });
    }

    public function renameRubro(MaintenanceDocument $document, string $grupo, string $rubro, string $nuevoRubro): array
    {
        return $this->write($document, function () use ($document, $grupo, $rubro, $nuevoRubro) {
            MaintenanceGgLinea::query()
                ->where('documento_id', $document->id)
                ->where('grupo', $grupo)
                ->where('rubro', $rubro)
                ->update(['rubro' => $nuevoRubro]);
        });
    }

    public function deleteRubro(MaintenanceDocument $document, string $grupo, string $rubro): array
    {
        return $this->write($document, function () use ($document, $grupo, $rubro) {
            $lineas = MaintenanceGgLinea::query()
                ->where('documento_id', $document->id)
                ->where('grupo', $grupo)
                ->where('rubro', $rubro)
                ->get();
            MaintenanceGgPagoValor::query()->whereIn('linea_public_id', $lineas->pluck('public_id'))->delete();
            foreach ($lineas as $linea) {
                $linea->delete();
            }
        });
    }

    public function addPago(MaintenanceDocument $document, MaintenanceScenario $scenario, ?string $fecha, ?string $etiqueta): array
    {
        return $this->write($document, function () use ($scenario, $fecha, $etiqueta) {
            $indice = (int) $scenario->ggPagos()->max('indice') + 1;
            MaintenanceGgPago::create([
                'public_id' => (string) Str::ulid(),
                'escenario_id' => $scenario->id,
                'indice' => $indice,
                'fecha' => $fecha,
                'etiqueta' => $etiqueta,
                'sort_order' => $indice * 1024,
            ]);
        });
    }

    public function updatePago(MaintenanceDocument $document, MaintenanceGgPago $pago, array $data): array
    {
        return $this->write($document, function () use ($pago, $data) {
            if (array_key_exists('fecha', $data)) {
                $pago->fecha = $data['fecha'] ?: null;
            }
            if (array_key_exists('etiqueta', $data)) {
                $pago->etiqueta = $data['etiqueta'] ?: null;
            }
            $pago->save();
        });
    }

    public function deletePago(MaintenanceDocument $document, MaintenanceGgPago $pago): array
    {
        return $this->write($document, fn () => $pago->delete());
    }

    public function setPagoValor(MaintenanceDocument $document, MaintenanceGgPago $pago, MaintenanceGgLinea $linea, ?string $monto): array
    {
        return $this->write($document, function () use ($pago, $linea, $monto) {
            if ($monto === null || $monto === '') {
                MaintenanceGgPagoValor::query()
                    ->where('pago_id', $pago->id)
                    ->where('linea_public_id', $linea->public_id)
                    ->delete();

                return;
            }

            $valor = MaintenanceGgPagoValor::query()->firstOrNew([
                'pago_id' => $pago->id,
                'linea_public_id' => $linea->public_id,
            ]);
            $valor->monto_minor = $this->toMinor($monto);
            $valor->save();
        });
    }

    private function write(MaintenanceDocument $document, \Closure $mutation): array
    {
        return DB::connection('costos_tenant')->transaction(function () use ($document, $mutation) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $mutation();
            $locked->increment('revision');
            $scenario = $this->scenarios->activeFor($locked->refresh(), 'gg');

            return ['revision' => (int) $locked->revision, 'gg' => $this->payload($locked, $scenario)];
        }, attempts: 3);
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
