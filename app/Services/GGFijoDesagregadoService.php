<?php

namespace App\Services;

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
        if (!empty($rows) && is_array($rows) && !isset($rows[0])) {
            $rows = [$rows];
        }

        try {
            DB::beginTransaction();

            if (str_starts_with($tipoCalculo, 'fianza_')) {
                $result = $this->handleFianza($connection, $ggFijoId, $tipoCalculo, $rows);
            } else if (str_starts_with($tipoCalculo, 'poliza_') || in_array($tipoCalculo, ['sencico', 'itf'])) {
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
            Log::error("Error en GGFijoDesagregadoService", [
                'gg_fijo_id' => $ggFijoId,
                'error' => $e->getMessage()
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
            if (!empty($rows) && isset($rows[0]['presupuesto_id'])) {
                $queryDelete->where('presupuesto_id', $rows[0]['presupuesto_id']);
            }
        }
        $queryDelete->delete();

        $totalSuma = 0;
        $insertData = [];

        foreach ($rows as $index => $data) {
            $baseCalculo = (float)($data['base_calculo'] ?? 0);
            $garantiaPorc = (float)($data['garantia_porcentaje'] ?? 10);
            $teaPorc = (float)($data['tea_porcentaje'] ?? 0);
            $duracionObra = (int)($data['duracion_obra_dias'] ?? 0);
            $duracionLiq = (int)($data['duracion_liquidacion_dias'] ?? 0);
            $factorPorc = (float)($data['factor_porcentaje'] ?? 100);
            $avancePorc = (float)($data['avance_porcentaje'] ?? 100);
            $renovacionDias = (int)($data['renovacion_dias'] ?? 0);
            
            // Lógica de cálculo real de fianza según excel
            $montoGarantia = $baseCalculo * ($garantiaPorc / 100);
            $teaDiaria = ($teaPorc / 100) / 360;
            
            if ($tipoCalculo === 'fianza_fiel_cumplimiento') {
                $diasTotales = $duracionObra + $duracionLiq;
                $rowTotal = $montoGarantia * $teaDiaria * $diasTotales;
            } else {
                // Adelantos dependen de factor y renovacion
                $rowTotal = $montoGarantia * $teaDiaria * ($renovacionDias > 0 ? $renovacionDias : 0) * ($factorPorc / 100);
            }

            $totalSuma += $rowTotal;

            $insertData[] = [
                'presupuesto_id' => $data['presupuesto_id'] ?? null,
                'gg_fijos_id' => $ggFijoId,
                'tipo_fianza' => $tipoFianza,
                'descripcion' => $data['descripcion'] ?? 'Fianza',
                'base_calculo' => $baseCalculo,
                'garantia_porcentaje' => $garantiaPorc,
                'tea_porcentaje' => $teaPorc,
                'duracion_obra_dias' => $duracionObra,
                'duracion_liquidacion_dias' => $duracionLiq,
                'factor_porcentaje' => $factorPorc,
                'avance_porcentaje' => $avancePorc,
                'renovacion_dias' => $renovacionDias,
                'garantia_fc_sin_igv' => round($rowTotal, 4),
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
        } else if (!empty($rows) && isset($rows[0]['presupuesto_id'])) {
            $queryUpdate->where('presupuesto_id', $rows[0]['presupuesto_id'])
                        ->where('tipo_calculo', $tipoCalculo);
        }

        $queryUpdate->update(['costo_unitario' => round($totalSuma, 4), 'cantidad' => 1]);

        return ['success' => true, 'id' => $ggFijoId, 'total' => round($totalSuma, 4)];
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

        $queryDelete = $connection->table('gg_fijos_polizas')
            ->whereIn('tipo_poliza', ['car', 'sctr_salud', 'sctr_pension', 'essalud_vida', 'sencico', 'itf'])
            ->where(function($q) use ($basePoliza) {
                if ($basePoliza === 'sctr_salud') {
                    $q->whereIn('tipo_poliza', ['sctr_salud', 'sctr_pension']);
                } else {
                    $q->where('tipo_poliza', $basePoliza);
                }
            });

        if ($ggFijoId !== null) {
            $queryDelete->where('gg_fijos_id', $ggFijoId);
        } else if (!empty($rows) && isset($rows[0]['presupuesto_id'])) {
            $queryDelete->where('presupuesto_id', $rows[0]['presupuesto_id']);
        }
            
        $queryDelete->delete();

        $totalSuma = 0;
        $insertData = [];

        foreach ($rows as $index => $data) {
            $tipoPolizaRow = $data['tipo_poliza'] ?? $basePoliza;
            
            $baseCalculo = (float)($data['base_calculo'] ?? 0);
            $tasaPorc = (float)($data['tea_porcentaje'] ?? 0);
            $duracionDias = (int)($data['duracion_dias'] ?? 0);
            
            if ($duracionDias > 0) {
                $tasaDiaria = ($tasaPorc / 100) / 360;
                $rowTotal = $baseCalculo * $tasaDiaria * $duracionDias;
            } else {
                // Cálculo simple de porcentaje directo
                $rowTotal = $baseCalculo * ($tasaPorc / 100);
            }

            $totalSuma += $rowTotal;

            $insertData[] = [
                'presupuesto_id' => $data['presupuesto_id'] ?? null,
                'gg_fijos_id' => $ggFijoId,
                'tipo_poliza' => $tipoPolizaRow,
                'descripcion' => $data['descripcion'] ?? 'Póliza/Tributo',
                'base_calculo' => $baseCalculo,
                'tea_porcentaje' => $tasaPorc,
                'duracion_dias' => $duracionDias,
                'poliza_sin_igv' => round($rowTotal, 4),
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
        } else if (!empty($rows) && isset($rows[0]['presupuesto_id'])) {
            $queryUpdate->where('presupuesto_id', $rows[0]['presupuesto_id'])
                        ->where('tipo_calculo', $tipoCalculo);
        }

        $queryUpdate->update(['costo_unitario' => round($totalSuma, 4), 'cantidad' => 1]);

        return ['success' => true, 'id' => $ggFijoId, 'total' => round($totalSuma, 4)];
    }
}
