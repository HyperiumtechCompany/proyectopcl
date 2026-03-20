<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Traits\HandleMetradoSpreadsheet;
use App\Services\CostoDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class MetradoSanitariasController extends Controller
{
    use HandleMetradoSpreadsheet;

    private const TABLE_CONFIG   = 'metrado_sanitarias_config';
    private const TABLE_MODULOS  = 'metrado_sanitarias_modulos';
    private const TABLE_EXTERIOR = 'metrado_sanitarias_exterior';
    private const TABLE_CISTERNA = 'metrado_sanitarias_cisterna';
    private const TABLE_RESUMEN  = 'metrado_sanitarias_resumen';

    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');

        $config = $this->getOrCreateConfig();

        $modulosData = [];
        for ($i = 1; $i <= $config->cantidad_modulos; $i++) {
            $modulosData[$i] = $this->queryModuloRows($costoProject, $i);
        }

        return Inertia::render('costos/metrados/SanitariasIndex', [
            'project' => [
                'id'     => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'config'   => (array) $config,
            'modulos'  => $modulosData,
            'exterior' => $this->queryTableRows($costoProject, self::TABLE_EXTERIOR),
            'cisterna' => $this->queryTableRows($costoProject, self::TABLE_CISTERNA),
            'resumen'  => $this->queryTableRows($costoProject, self::TABLE_RESUMEN),
        ]);
    }

    public function getConfig(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');

        $config = $this->getOrCreateConfig();

        return response()->json([
            'success' => true,
            'config'  => (array) $config,
        ]);
    }

    public function updateConfig(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');

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

    public function getModulo(CostoProject $costoProject, int $moduloNumero): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');
        $this->validateModuloNumero($moduloNumero);

        return response()->json([
            'success'       => true,
            'modulo_numero' => $moduloNumero,
            'rows'          => $this->queryModuloRows($costoProject, $moduloNumero),
        ]);
    }

    public function updateModulo(CostoProject $costoProject, int $moduloNumero, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');
        $this->validateModuloNumero($moduloNumero);

        $rows = $request->input('rows', []);
        $moduloNombre = $request->input('modulo_nombre', "Módulo {$moduloNumero}");

        $connection = DB::connection('costos_tenant');
        $presupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($costoProject->database_name);
        $columns = $connection->getSchemaBuilder()->getColumnListing(self::TABLE_MODULOS);
        $hasColumn = fn($col) => in_array($col, $columns);
        
        $connection->beginTransaction();
        try {
            $connection->table(self::TABLE_MODULOS)
                ->where('presupuesto_id', $presupuestoId)
                ->where('modulo_numero', $moduloNumero)
                ->delete();

            foreach ($rows as $index => $row) {
                $data = [
                    'presupuesto_id' => $presupuestoId,
                    'modulo_numero'  => $moduloNumero,
                    'modulo_nombre'  => $moduloNombre,
                    'item_order'     => $index,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ];

                if ($hasColumn('node_type'))   $data['node_type']   = $this->normalizeNodeType($row['node_type'] ?? $row['_kind'] ?? 'partida');
                if ($hasColumn('titulo'))      $data['titulo']      = $row['titulo'] ?? null;
                if ($hasColumn('partida'))     $data['partida']     = $row['partida'] ?? null;
                if ($hasColumn('descripcion')) $data['descripcion'] = $row['descripcion'] ?? null;
                if ($hasColumn('unidad'))      $data['unidad']      = $row['unidad'] ?? null;
                
                $decimalFields = ['elsim', 'largo', 'ancho', 'alto', 'nveces', 'lon', 'area', 'vol', 'kg', 'und', 'total'];
                foreach ($decimalFields as $f) {
                    if ($hasColumn($f)) $data[$f] = $this->toDecimalValue($row[$f] ?? 0);
                }

                if ($hasColumn('observacion')) $data['observacion'] = $row['observacion'] ?? null;
                if ($hasColumn('parent_id'))   $data['parent_id']   = $row['parent_id'] ?? null;
                if ($hasColumn('nivel'))       $data['nivel']       = $row['nivel'] ?? $row['_level'] ?? 0;

                $connection->table(self::TABLE_MODULOS)->insert($data);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryModuloRows($costoProject, $moduloNumero),
            ]);
        } catch (\Exception $e) {
            $connection->rollBack();
            Log::error('Error saving sanitarias modulo', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function updateExterior(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');
        return $this->updateSheet($costoProject, self::TABLE_EXTERIOR, $request);
    }

    public function updateCisterna(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');
        return $this->updateSheet($costoProject, self::TABLE_CISTERNA, $request);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_sanitarias');
        return $this->updateSheet($costoProject, self::TABLE_RESUMEN, $request);
    }

    private function getOrCreateConfig(): object
    {
        $config = DB::connection('costos_tenant')->table(self::TABLE_CONFIG)->first();
        if (!$config) {
            DB::connection('costos_tenant')->table(self::TABLE_CONFIG)->insert([
                'cantidad_modulos' => 1,
                'nombre_proyecto'  => null,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
            $config = DB::connection('costos_tenant')->table(self::TABLE_CONFIG)->first();
        }
        return $config;
    }

    private function queryTableRows(CostoProject $costoProject, string $table): array
    {
        return $this->queryRows($costoProject, $table);
    }

    private function queryModuloRows(CostoProject $costoProject, int $moduloNumero): array
    {
        $presupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($costoProject->database_name);
        return DB::connection('costos_tenant')
            ->table(self::TABLE_MODULOS)
            ->where('modulo_numero', $moduloNumero)
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')
            ->get()
            ->map(fn($row) => (array) $row)
            ->toArray();
    }

    private function normalizeNodeType(mixed $value): string
    {
        $raw = strtolower(trim((string) $value));
        return in_array($raw, ['titulo', 'subtitulo', 'group']) ? 'titulo' : 'partida';
    }

    private function validateModuloNumero(int $moduloNumero): void
    {
        if ($moduloNumero < 1 || $moduloNumero > 50) {
            abort(422, "Número de módulo inválido: {$moduloNumero}");
        }
    }
}
