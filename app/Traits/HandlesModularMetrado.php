<?php

namespace App\Traits;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

trait HandlesModularMetrado
{
    protected function getConfigResponse(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, static::MODULE_TYPE);

        return response()->json([
            'success' => true,
            'config' => (array) $this->getOrCreateModularConfig($costoProject),
        ]);
    }

    protected function updateConfigResponse(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, static::MODULE_TYPE);

        $validated = $request->validate([
            'cantidad_modulos' => 'required|integer|min:1|max:50',
            'nombre_proyecto' => 'nullable|string|max:255',
        ]);

        $config = $this->getOrCreateModularConfig($costoProject);

        DB::connection('costos_tenant')
            ->table(static::TABLE_CONFIG)
            ->where('id', $config->id)
            ->update([
                'cantidad_modulos' => $validated['cantidad_modulos'],
                'nombre_proyecto' => $validated['nombre_proyecto'] ?? $config->nombre_proyecto,
                'updated_at' => now(),
            ]);

        $costoProject->modules()
            ->where('module_type', static::MODULE_TYPE)
            ->update([
                'config' => ['cantidad_modulos' => $validated['cantidad_modulos']],
            ]);

        return response()->json([
            'success' => true,
            'config' => (array) DB::connection('costos_tenant')->table(static::TABLE_CONFIG)->first(),
        ]);
    }

    protected function getModuloResponse(CostoProject $costoProject, int $moduloNumero): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, static::MODULE_TYPE);
        $this->validateModuloNumero($moduloNumero);

        return response()->json([
            'success' => true,
            'modulo_numero' => $moduloNumero,
            'rows' => $this->queryModuloRows($costoProject, $moduloNumero),
        ]);
    }

    protected function updateModuloResponse(CostoProject $costoProject, int $moduloNumero, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, static::MODULE_TYPE);
        $this->validateModuloNumero($moduloNumero);

        $rows = $request->input('rows', []);
        $moduloNombre = $request->input('modulo_nombre', "Modulo {$moduloNumero}");

        $connection = DB::connection('costos_tenant');
        $presupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($costoProject->database_name);
        $columns = $connection->getSchemaBuilder()->getColumnListing(static::TABLE_MODULOS);
        $hasColumn = fn(string $column) => in_array($column, $columns, true);

        $connection->beginTransaction();

        try {
            $connection->table(static::TABLE_MODULOS)
                ->where('presupuesto_id', $presupuestoId)
                ->where('modulo_numero', $moduloNumero)
                ->delete();

            foreach ($rows as $index => $row) {
                $data = [
                    'presupuesto_id' => $presupuestoId,
                    'modulo_numero' => $moduloNumero,
                    'modulo_nombre' => $moduloNombre,
                    'item_order' => $index,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if ($hasColumn('node_type')) {
                    $data['node_type'] = $this->normalizeModuloNodeType($row['node_type'] ?? $row['_kind'] ?? 'partida');
                }

                if ($hasColumn('titulo')) {
                    $data['titulo'] = $row['titulo'] ?? null;
                }

                if ($hasColumn('partida')) {
                    $data['partida'] = $row['partida'] ?? null;
                }

                if ($hasColumn('descripcion')) {
                    $data['descripcion'] = $row['descripcion'] ?? null;
                }

                if ($hasColumn('unidad')) {
                    $data['unidad'] = $row['unidad'] ?? null;
                }

                foreach (['elsim', 'largo', 'ancho', 'alto', 'nveces', 'lon', 'area', 'vol', 'kg', 'und', 'total'] as $field) {
                    if ($hasColumn($field)) {
                        $data[$field] = $this->toDecimalValue($row[$field] ?? 0);
                    }
                }

                if ($hasColumn('observacion')) {
                    $data['observacion'] = $row['observacion'] ?? null;
                }

                if ($hasColumn('parent_id')) {
                    $data['parent_id'] = $row['parent_id'] ?? null;
                }

                if ($hasColumn('nivel')) {
                    $data['nivel'] = $row['nivel'] ?? $row['_level'] ?? 0;
                }

                $connection->table(static::TABLE_MODULOS)->insert($data);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count' => count($rows),
                'rows' => $this->queryModuloRows($costoProject, $moduloNumero),
            ]);
        } catch (\Throwable $e) {
            $connection->rollBack();

            Log::error('Error saving modular metrado', [
                'module_type' => static::MODULE_TYPE,
                'modulo_numero' => $moduloNumero,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    protected function getOrCreateModularConfig(CostoProject $costoProject): object
    {
        $config = DB::connection('costos_tenant')->table(static::TABLE_CONFIG)->first();

        if ($config) {
            return $config;
        }

        DB::connection('costos_tenant')->table(static::TABLE_CONFIG)->insert([
            'cantidad_modulos' => $this->getInitialModuleCount($costoProject),
            'nombre_proyecto' => $costoProject->nombre,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::connection('costos_tenant')->table(static::TABLE_CONFIG)->first();
    }

    protected function queryModuloRows(CostoProject $costoProject, int $moduloNumero): array
    {
        $presupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($costoProject->database_name);

        return DB::connection('costos_tenant')
            ->table(static::TABLE_MODULOS)
            ->where('modulo_numero', $moduloNumero)
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')
            ->get()
            ->map(fn($row) => (array) $row)
            ->toArray();
    }

    protected function normalizeModuloNodeType(mixed $value): string
    {
        $raw = strtolower(trim((string) $value));

        return in_array($raw, ['titulo', 'subtitulo', 'group'], true) ? 'titulo' : 'partida';
    }

    protected function validateModuloNumero(int $moduloNumero): void
    {
        if ($moduloNumero < 1 || $moduloNumero > 50) {
            abort(422, "Numero de modulo invalido: {$moduloNumero}");
        }
    }

    private function getInitialModuleCount(CostoProject $costoProject): int
    {
        $config = optional(
            $costoProject->modules()->where('module_type', static::MODULE_TYPE)->first()
        )->config;

        $count = data_get($config, 'cantidad_modulos', 1);

        return is_numeric($count) && (int) $count > 0 ? (int) $count : 1;
    }
}
