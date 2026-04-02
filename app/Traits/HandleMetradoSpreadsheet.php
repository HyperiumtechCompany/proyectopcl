<?php

namespace App\Traits;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

trait HandleMetradoSpreadsheet
{
    /**
     * Generic method to update a sheet (metrado or resumen).
     * It dynamically detects columns and maps data correctly.
     */
    protected function updateSheet(CostoProject $costoProject, string $table, Request $request): JsonResponse
    {
        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        $presupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($costoProject->database_name);
        
        // Get available columns to avoid "column not found" errors
        $columns = $connection->getSchemaBuilder()->getColumnListing($table);
        $hasColumn = fn($col) => in_array($col, $columns);

        $connection->beginTransaction();
        try {
            $scope = ['presupuesto_id' => $presupuestoId];
            $existingIds = $connection->table($table)
                ->where($scope)
                ->pluck('id')
                ->map(fn($id) => (int) $id)
                ->all();
            $touchedIds = [];

            foreach ($rows as $index => $row) {
                $rowId = $this->extractIncomingRowId($row);
                $data = $this->buildSheetRowPayload($row, $index, $presupuestoId, $table, $hasColumn);

                if ($rowId && in_array($rowId, $existingIds, true)) {
                    $connection->table($table)
                        ->where($scope)
                        ->where('id', $rowId)
                        ->update($data + ['updated_at' => now()]);

                    $touchedIds[] = $rowId;
                    continue;
                }

                $existingByIndex = $connection->table($table)
                    ->where($scope)
                    ->where('item_order', $index)
                    ->first();

                if ($existingByIndex) {
                    $connection->table($table)
                        ->where('id', $existingByIndex->id)
                        ->update($data + ['updated_at' => now()]);
                    $touchedIds[] = $existingByIndex->id;
                    continue;
                }

                $touchedIds[] = (int) $connection->table($table)->insertGetId($data + [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $deleteQuery = $connection->table($table)->where($scope);
            if (!empty($touchedIds)) {
                $deleteQuery->whereNotIn('id', $touchedIds);
            }
            $deleteQuery->delete();

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryRows($costoProject, $table),
            ]);
        } catch (\Exception $e) {
            $connection->rollBack();
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    protected function toDecimalValue(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    protected function extractIncomingRowId(array $row): ?int
    {
        $id = $row['_dbid'] ?? $row['id'] ?? null;

        return is_numeric($id) && (int) $id > 0 ? (int) $id : null;
    }

    protected function buildSheetRowPayload(
        array $row,
        int $index,
        int $presupuestoId,
        string $table,
        callable $hasColumn
    ): array {
        $data = [
            'presupuesto_id' => $presupuestoId,
            'item_order' => $index,
        ];

        if ($hasColumn('node_type'))   $data['node_type']   = $row['node_type'] ?? 'partida';
        if ($hasColumn('titulo'))      $data['titulo']      = $row['titulo'] ?? null;
        if ($hasColumn('partida'))     $data['partida']     = $row['partida'] ?? ($row['item'] ?? null);
        if ($hasColumn('item'))        $data['item']        = $row['partida'] ?? ($row['item'] ?? null);
        if ($hasColumn('descripcion')) $data['descripcion'] = $row['descripcion'] ?? null;

        if ($hasColumn('unidad'))      $data['unidad']      = $row['unidad'] ?? ($row['und'] ?? null);
        if ($hasColumn('und')) {
            if (str_contains($table, 'resumen')) {
                $data['und'] = $row['unidad'] ?? ($row['und'] ?? null);
            } else {
                $data['und'] = $this->toDecimalValue($row['und'] ?? 0);
            }
        }

        $decimalFields = ['elsim', 'largo', 'ancho', 'alto', 'nveces', 'kgm', 'lon', 'area', 'vol', 'kg', 'total', 'parcial'];
        foreach ($decimalFields as $field) {
            if (!$hasColumn($field)) {
                continue;
            }

            $val = $row[$field] ?? 0;
            if ($field === 'elsim' && !isset($row['elsim'])) $val = $row['elem_simil'] ?? 0;
            if ($field === 'lon'   && !isset($row['lon']))   $val = $row['long'] ?? 0;
            if ($field === 'total' && !isset($row['total'])) $val = $row['parcial'] ?? 0;

            $data[$field] = $this->toDecimalValue($val);
        }

        if ($hasColumn('observacion')) $data['observacion'] = $row['observacion'] ?? ($row['obs'] ?? null);
        if ($hasColumn('nivel'))       $data['nivel']       = $row['nivel'] ?? ($row['_level'] ?? 0);
        if ($hasColumn('parent_id'))   $data['parent_id']   = $row['parent_id'] ?? null;
        if ($hasColumn('_formula_key'))    $data['_formula_key'] = $row['_formula_key'] ?? null;
        if ($hasColumn('_formula_output')) $data['_formula_output'] = $row['_formula_output'] ?? null;
        if ($hasColumn('_formula_expr'))   $data['_formula_expr'] = $row['_formula_expr'] ?? null;
        if ($hasColumn('_formula_label'))  $data['_formula_label'] = $row['_formula_label'] ?? null;

        return $data;
    }

    protected function queryRows(CostoProject $project, string $table): array
    {
        $presupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($project->database_name);
        return DB::connection('costos_tenant')
            ->table($table)
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')
            ->get()
            ->map(fn($r) => (array)$r)
            ->toArray();
    }

    protected function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }

    protected function validateModuleEnabled(CostoProject $project, string $moduleType): void
    {
        $enabled = $project->enabledModules()
            ->where('module_type', $moduleType)
            ->exists();

        if (!$enabled) {
            abort(403, "El módulo {$moduleType} no está habilitado.");
        }
    }
}
