<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class MetradoSanitariasController extends Controller
{
    /**
     * Sub-table names within the tenant DB.
     */
    private const TABLE_CONFIG   = 'metrado_sanitarias_config';
    private const TABLE_MODULOS  = 'metrado_sanitarias_modulos';
    private const TABLE_EXTERIOR = 'metrado_sanitarias_exterior';
    private const TABLE_CISTERNA = 'metrado_sanitarias_cisterna';
    private const TABLE_RESUMEN  = 'metrado_sanitarias_resumen';

    /**
     * Columns shared by módulos, exterior and cisterna (the "base" metrado columns).
     */
    private const BASE_COLUMNS = [
        'item_order', 'node_type', 'titulo', 'partida', 'descripcion', 'unidad',
        'elsim', 'largo', 'ancho', 'alto', 'nveces',
        'lon', 'area', 'vol', 'kg', 'und', 'total',
        'observacion', 'parent_id', 'nivel',
    ];

    // ─── Index (Inertia page) ────────────────────────────────────────────────────

    /**
     * Main view: returns config + all sub-table data for the Inertia page.
     */
    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $config = $this->getOrCreateConfig();

        $modulosData = [];
        for ($i = 1; $i <= $config->cantidad_modulos; $i++) {
            $modulosData[$i] = $this->queryModuloRows($i);
        }

        return Inertia::render('costos/metrados/SanitariasIndex', [
            'project' => [
                'id'     => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'config'   => (array) $config,
            'modulos'  => $modulosData,
            'exterior' => $this->queryTableRows(self::TABLE_EXTERIOR),
            'cisterna' => $this->queryTableRows(self::TABLE_CISTERNA),
            'resumen'  => $this->queryTableRows(self::TABLE_RESUMEN),
        ]);
    }

    // ─── Config CRUD ─────────────────────────────────────────────────────────────

    public function getConfig(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $config = $this->getOrCreateConfig();

        return response()->json([
            'success' => true,
            'config'  => (array) $config,
        ]);
    }

    public function updateConfig(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $validated = $request->validate([
            'cantidad_modulos' => 'required|integer|min:1|max:50',
            'nombre_proyecto'  => 'nullable|string|max:255',
        ]);

        $config = $this->getOrCreateConfig();

        DB::connection('costos_tenant')
            ->table(self::TABLE_CONFIG)
            ->where('id', $config->id)
            ->update([
                'cantidad_modulos' => $validated['cantidad_modulos'],
                'nombre_proyecto'  => $validated['nombre_proyecto'] ?? $config->nombre_proyecto,
                'updated_at'       => now(),
            ]);

        // Also update the module config in the main DB
        $costoProject->modules()
            ->where('module_type', 'metrado_sanitarias')
            ->update([
                'config' => json_encode(['cantidad_modulos' => $validated['cantidad_modulos']]),
            ]);

        $updatedConfig = DB::connection('costos_tenant')
            ->table(self::TABLE_CONFIG)
            ->first();

        return response()->json([
            'success' => true,
            'config'  => (array) $updatedConfig,
        ]);
    }

    // ─── Módulos CRUD ────────────────────────────────────────────────────────────

    public function getModulo(CostoProject $costoProject, int $moduloNumero): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);
        $this->validateModuloNumero($moduloNumero);

        return response()->json([
            'success'       => true,
            'modulo_numero' => $moduloNumero,
            'rows'          => $this->queryModuloRows($moduloNumero),
        ]);
    }

    public function updateModulo(CostoProject $costoProject, int $moduloNumero, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);
        $this->validateModuloNumero($moduloNumero);

        $rows = $request->input('rows', []);
        $moduloNombre = $request->input('modulo_nombre', "Módulo {$moduloNumero}");

        $connection = DB::connection('costos_tenant');
        $connection->beginTransaction();

        try {
            // Delete existing rows for this module
            $connection->table(self::TABLE_MODULOS)
                ->where('modulo_numero', $moduloNumero)
                ->delete();

            // Insert new rows
            foreach ($rows as $index => $row) {
                $cleanRow = $this->cleanBaseRow($row, $index);
                $cleanRow['modulo_numero'] = $moduloNumero;
                $cleanRow['modulo_nombre'] = $moduloNombre;
                $cleanRow['created_at']    = now();
                $cleanRow['updated_at']    = now();

                $connection->table(self::TABLE_MODULOS)->insert($cleanRow);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryModuloRows($moduloNumero),
            ]);
        } catch (\Exception $e) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            Log::error('Error saving metrado sanitarias módulo', [
                'project'       => $costoProject->id,
                'modulo_numero' => $moduloNumero,
                'error'         => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    // ─── Exterior CRUD ───────────────────────────────────────────────────────────

    public function getExterior(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        return response()->json([
            'success' => true,
            'rows'    => $this->queryTableRows(self::TABLE_EXTERIOR),
        ]);
    }

    public function updateExterior(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->updateSimpleTable($costoProject, self::TABLE_EXTERIOR, $request);
    }

    // ─── Cisterna CRUD ───────────────────────────────────────────────────────────

    public function getCisterna(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        return response()->json([
            'success' => true,
            'rows'    => $this->queryTableRows(self::TABLE_CISTERNA),
        ]);
    }

    public function updateCisterna(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->updateSimpleTable($costoProject, self::TABLE_CISTERNA, $request);
    }

    // ─── Resumen CRUD ────────────────────────────────────────────────────────────

    public function getResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        return response()->json([
            'success' => true,
            'rows'    => $this->queryTableRows(self::TABLE_RESUMEN),
        ]);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        $connection->beginTransaction();

        try {
            $connection->table(self::TABLE_RESUMEN)->delete();

            foreach ($rows as $index => $row) {
                $connection->table(self::TABLE_RESUMEN)->insert([
                    'item_order'  => $index,
                    // 'node_type'   => $row['node_type'] ?? 'partida',
                    // 'titulo'      => $row['titulo'] ?? null,
                    'partida'     => $row['partida'] ?? null,
                    'descripcion' => $row['descripcion'] ?? null,
                    'unidad'      => $row['unidad'] ?? null,
                    'total_modulos'   => $this->toDecimal($row['total_modulos'] ?? 0),
                    'total_exterior'  => $this->toDecimal($row['total_exterior'] ?? 0),
                    'total_cisterna'  => $this->toDecimal($row['total_cisterna'] ?? 0),
                    'total_general'   => $this->toDecimal($row['total_general'] ?? 0),
                    'observacion' => $row['observacion'] ?? null,
                    'parent_id'   => $row['parent_id'] ?? null,
                    'nivel'       => $row['nivel'] ?? 0,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryTableRows(self::TABLE_RESUMEN),
            ]);
        } catch (\Exception $e) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            Log::error('Error saving metrado sanitarias resumen', [
                'project' => $costoProject->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    // ─── Shared helpers ──────────────────────────────────────────────────────────

    /**
     * Get or create the config row (always exactly one row).
     */
    private function getOrCreateConfig(): object
    {
        $config = DB::connection('costos_tenant')
            ->table(self::TABLE_CONFIG)
            ->first();

        if (!$config) {
            DB::connection('costos_tenant')
                ->table(self::TABLE_CONFIG)
                ->insert([
                    'cantidad_modulos' => 1,
                    'nombre_proyecto'  => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ]);

            $config = DB::connection('costos_tenant')
                ->table(self::TABLE_CONFIG)
                ->first();
        }

        return $config;
    }

    /**
     * Query rows from a table ordered by item_order + id.
     */
    private function queryTableRows(string $table): array
    {
        return DB::connection('costos_tenant')
            ->table($table)
            ->orderBy('item_order')
            ->orderBy('id')
            ->get()
            ->map(fn($row) => (array) $row)
            ->toArray();
    }

    /**
     * Query module rows for a specific modulo_numero.
     */
    private function queryModuloRows(int $moduloNumero): array
    {
        return DB::connection('costos_tenant')
            ->table(self::TABLE_MODULOS)
            ->where('modulo_numero', $moduloNumero)
            ->orderBy('item_order')
            ->orderBy('id')
            ->get()
            ->map(fn($row) => (array) $row)
            ->toArray();
    }

    /**
     * Generic update for simple tables (exterior, cisterna).
     */
    private function updateSimpleTable(CostoProject $costoProject, string $table, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        $connection->beginTransaction();

        try {
            $connection->table($table)->delete();

            foreach ($rows as $index => $row) {
                $cleanRow = $this->cleanBaseRow($row, $index);
                $cleanRow['created_at'] = now();
                $cleanRow['updated_at'] = now();

                $connection->table($table)->insert($cleanRow);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryTableRows($table),
            ]);
        } catch (\Exception $e) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            Log::error("Error saving metrado sanitarias {$table}", [
                'project' => $costoProject->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Clean a row to only include base metrado columns.
     */
    private function cleanBaseRow(array $row, int $index): array
    {
        return [
            'item_order'  => $index,
            // 'node_type'   => $row['node_type'] ?? 'partida',
            // 'titulo'      => $row['titulo'] ?? null,
            'partida'     => $row['partida'] ?? null,
            'descripcion' => $row['descripcion'] ?? null,
            'unidad'      => $row['unidad'] ?? null,
            'elsim'       => $this->toDecimal($row['elsim'] ?? 0),
            'largo'       => $this->toDecimal($row['largo'] ?? 0),
            'ancho'       => $this->toDecimal($row['ancho'] ?? 0),
            'alto'        => $this->toDecimal($row['alto'] ?? 0),
            'nveces'      => $this->toDecimal($row['nveces'] ?? 0),
            'lon'         => $this->toDecimal($row['lon'] ?? 0),
            'area'        => $this->toDecimal($row['area'] ?? 0),
            'vol'         => $this->toDecimal($row['vol'] ?? 0),
            'kg'          => $this->toDecimal($row['kg'] ?? 0),
            'und'         => $this->toDecimal($row['und'] ?? 0),
            'total'       => $this->toDecimal($row['total'] ?? 0),
            'observacion' => $row['observacion'] ?? null,
            'parent_id'   => $row['parent_id'] ?? null,
            'nivel'       => $row['nivel'] ?? 0,
        ];
    }

    /**
     * Safely cast a value to decimal.
     */
    private function toDecimal(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }

    private function validateModuleEnabled(CostoProject $project): void
    {
        $enabled = $project->enabledModules()
            ->where('module_type', 'metrado_sanitarias')
            ->exists();

        if (!$enabled) {
            abort(403, 'El módulo de sanitarias no está habilitado para este proyecto.');
        }
    }

    private function validateModuloNumero(int $moduloNumero): void
    {
        if ($moduloNumero < 1 || $moduloNumero > 50) {
            abort(422, "Número de módulo inválido: {$moduloNumero}");
        }
    }
}
