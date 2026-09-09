<?php

namespace App\Services;

use App\Support\GastosGeneralesDecimal as DecimalAmount;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GGFijoDesagregadoService
{
    /**
     * Calcula y guarda un desagregado de G.G. Fijos (Fianzas o Pólizas)
     */
    public function calculateAndSave(string $databaseName, ?int $ggFijoId, string $tipoCalculo, array $rows): array
    {
        $connection = DB::connection('costos_tenant');

        // If it's a single associative array, wrap it in array
        if (! empty($rows) && is_array($rows) && ! isset($rows[0])) {
            $rows = [$rows];
        }

        try {
            DB::beginTransaction();

            if (str_starts_with($tipoCalculo, 'fianza_')) {
                $result = $this->handleFianza($connection, $ggFijoId, $tipoCalculo, $rows);
            } elseif (str_starts_with($tipoCalculo, 'poliza_') || in_array($tipoCalculo, ['sencico', 'itf'])) {
                $result = $this->handlePoliza($connection, $ggFijoId, $tipoCalculo, $rows);
            } else {
                $result = ['success' => false, 'message' => 'Tipo de cálculo no soportado.'];
            }

            if ($result['success']) {
                DB::commit();
            } else {
                DB::rollBack();
            }

            return $result;
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error en GGFijoDesagregadoService', [
                'gg_fijo_id' => $ggFijoId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function handleFianza($connection, ?int $ggFijoId, string $tipoCalculo, array $rows): array
    {
        $typeMap = [
            'fianza_fiel_cumplimiento' => 'fiel_cumplimiento',
            'fianza_adelanto_efectivo' => 'adelanto_efectivo',
            'fianza_adelanto_materiales' => 'adelanto_materiales',
        ];

        $tipoFianza = $typeMap[$tipoCalculo] ?? 'fiel_cumplimiento';

        // Borrar filas existentes
        $queryDelete = $connection->table('gg_fijos_fianzas')
            ->where('tipo_fianza', $tipoFianza);

        if ($ggFijoId !== null) {
            $queryDelete->where('gg_fijos_id', $ggFijoId);
        } else {
            // Global check: we need a presupuesto_id to delete safely global ones,
            // but we can trust the rows have presupuesto_id
            if (! empty($rows) && isset($rows[0]['presupuesto_id'])) {
                $queryDelete->where('presupuesto_id', $rows[0]['presupuesto_id']);
            }
        }
        $queryDelete->delete();

        $totalSuma = DecimalAmount::of(0);
        $insertData = [];

        foreach ($rows as $index => $data) {
            $baseCalculo = DecimalAmount::of($data['base_calculo'] ?? 0);
            $garantiaPorc = DecimalAmount::of($data['garantia_porcentaje'] ?? 10);
            $teaPorc = DecimalAmount::of($data['tea_porcentaje'] ?? 0);
            $duracionObra = (int) ($data['duracion_obra_dias'] ?? 0);
            $duracionLiq = (int) ($data['duracion_liquidacion_dias'] ?? 0);
            $factorPorc = DecimalAmount::of($data['factor_porcentaje'] ?? 100);
            $avancePorc = DecimalAmount::of($data['avance_porcentaje'] ?? 100);
            $renovacionDias = (int) ($data['renovacion_dias'] ?? 0);

            // Lógica de cálculo real de fianza según excel
            $montoGarantia = DecimalAmount::percent($baseCalculo, $garantiaPorc);
            $teaDiaria = DecimalAmount::percent($teaPorc, 1)->dividedBy(360, 16, RoundingMode::HALF_UP);

            if ($tipoCalculo === 'fianza_fiel_cumplimiento') {
                $diasTotales = $duracionObra + $duracionLiq;
                $rowTotal = $montoGarantia->multipliedBy($teaDiaria)->multipliedBy($diasTotales);
            } else {
                // Adelantos dependen de factor y renovacion
                $rowTotal = DecimalAmount::percent(
                    $montoGarantia->multipliedBy($teaDiaria)->multipliedBy($renovacionDias > 0 ? $renovacionDias : 0),
                    $factorPorc
                );
            }

            $totalSuma = $totalSuma->plus($rowTotal);

            $insertData[] = [
                'presupuesto_id' => $data['presupuesto_id'] ?? null,
                'gg_fijos_id' => $ggFijoId,
                'tipo_fianza' => $tipoFianza,
                'descripcion' => $data['descripcion'] ?? 'Fianza',
                'base_calculo' => DecimalAmount::storage($baseCalculo),
                'garantia_porcentaje' => DecimalAmount::storage($garantiaPorc),
                'tea_porcentaje' => DecimalAmount::storage($teaPorc),
                'duracion_obra_dias' => $duracionObra,
                'duracion_liquidacion_dias' => $duracionLiq,
                'factor_porcentaje' => DecimalAmount::storage($factorPorc),
                'avance_porcentaje' => DecimalAmount::storage($avancePorc),
                'renovacion_dias' => $renovacionDias,
                'garantia_fc_sin_igv' => DecimalAmount::storage($rowTotal),
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (count($insertData) > 0) {
            $connection->table('gg_fijos_fianzas')->insert($insertData);
        }

        // Sincronizar con la tabla principal gg_fijos
        $queryUpdate = $connection->table('gg_fijos');

        if ($ggFijoId !== null) {
            $queryUpdate->where('id', $ggFijoId);
        } elseif (! empty($rows) && isset($rows[0]['presupuesto_id'])) {
            $queryUpdate->where('presupuesto_id', $rows[0]['presupuesto_id'])
                ->where('tipo_calculo', $tipoCalculo);
        }

        $queryUpdate->update(['costo_unitario' => DecimalAmount::storage($totalSuma), 'cantidad' => 1]);

        return ['success' => true, 'id' => $ggFijoId, 'total' => (float) DecimalAmount::storage($totalSuma)];
    }

    private function handlePoliza($connection, ?int $ggFijoId, string $tipoCalculo, array $rows): array
    {
        $typeMap = [
            'poliza_car' => 'car',
            'poliza_sctr' => 'sctr_salud',
            'poliza_essalud_vida' => 'essalud_vida',
            'sencico' => 'sencico',
            'itf' => 'itf',
        ];

        // Mapeo especial para SCTR o similares
        $basePoliza = $typeMap[$tipoCalculo] ?? $tipoCalculo;
        $itfCargoAdicional = $tipoCalculo === 'itf'
            ? DecimalAmount::of($connection->table('project_params')->value('itf_cargo_adicional') ?? 0)
            : DecimalAmount::of(0);

        $queryDelete = $connection->table('gg_fijos_polizas')
            ->whereIn('tipo_poliza', ['car', 'sctr_salud', 'sctr_pension', 'essalud_vida', 'sencico', 'itf'])
            ->where(function ($q) use ($basePoliza) {
                if ($basePoliza === 'sctr_salud') {
                    $q->whereIn('tipo_poliza', ['sctr_salud', 'sctr_pension']);
                } else {
                    $q->where('tipo_poliza', $basePoliza);
                }
            });

        if ($ggFijoId !== null) {
            $queryDelete->where('gg_fijos_id', $ggFijoId);
        } elseif (! empty($rows) && isset($rows[0]['presupuesto_id'])) {
            $queryDelete->where('presupuesto_id', $rows[0]['presupuesto_id']);
        }

        $queryDelete->delete();

        $totalSuma = DecimalAmount::of(0);
        $insertData = [];

        foreach ($rows as $index => $data) {
            $tipoPolizaRow = $data['tipo_poliza'] ?? $basePoliza;

            $baseCalculo = DecimalAmount::of($data['base_calculo'] ?? 0);
            $tasaPorc = DecimalAmount::of($data['tea_porcentaje'] ?? 0);
            $duracionDias = (int) ($data['duracion_dias'] ?? 0);

            if ($duracionDias > 0) {
                $tasaDiaria = DecimalAmount::percent($tasaPorc, 1)->dividedBy(360, 16, RoundingMode::HALF_UP);
                $rowTotal = $baseCalculo->multipliedBy($tasaDiaria)->multipliedBy($duracionDias);
            } else {
                // Cálculo simple de porcentaje directo
                $rowTotal = DecimalAmount::percent($baseCalculo, $tasaPorc);
            }

            if ($tipoCalculo === 'itf' && $index === 0) {
                $rowTotal = $rowTotal->plus($itfCargoAdicional);
            }

            $totalSuma = $totalSuma->plus($rowTotal);

            $insertData[] = [
                'presupuesto_id' => $data['presupuesto_id'] ?? null,
                'gg_fijos_id' => $ggFijoId,
                'tipo_poliza' => $tipoPolizaRow,
                'descripcion' => $data['descripcion'] ?? 'Póliza/Tributo',
                'base_calculo' => DecimalAmount::storage($baseCalculo),
                'tea_porcentaje' => DecimalAmount::storage($tasaPorc),
                'duracion_dias' => $duracionDias,
                'poliza_sin_igv' => DecimalAmount::storage($rowTotal),
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (count($insertData) > 0) {
            $connection->table('gg_fijos_polizas')->insert($insertData);
        }

        // Sincronizar con la tabla principal gg_fijos
        $queryUpdate = $connection->table('gg_fijos');

        if ($ggFijoId !== null) {
            $queryUpdate->where('id', $ggFijoId);
        } elseif (! empty($rows) && isset($rows[0]['presupuesto_id'])) {
            $queryUpdate->where('presupuesto_id', $rows[0]['presupuesto_id'])
                ->where('tipo_calculo', $tipoCalculo);
        }

        $queryUpdate->update(['costo_unitario' => DecimalAmount::storage($totalSuma), 'cantidad' => 1]);

        return ['success' => true, 'id' => $ggFijoId, 'total' => (float) DecimalAmount::storage($totalSuma)];
    }
}
