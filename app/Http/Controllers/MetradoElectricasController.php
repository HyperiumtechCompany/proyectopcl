<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CostoProject;  
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MetradoElectricasController extends Controller
{
    private const TABLE_METRADO = 'metrados_electricos';
    private const TABLE_RESUMEN = 'metrados_electricos'; 

    public function index(CostoProject $costoProject): Response  
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $metrado = $this->queryRows($costoProject->id, 'metrado');
        $resumen = $this->queryRows($costoProject->id, 'resumen');

        return Inertia::render('costos/metrados/ElectricasIndex', [
            'project' => [
                'id'     => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'metrado' => $metrado,
            'resumen' => $resumen,
        ]);
    }

    public function updateMetrado(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->updateSheet($costoProject, 'metrado', $request);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->updateSheet($costoProject, 'resumen', $request);
    }

    private function queryRows(int $projectId, string $hoja): array
    {
        return DB::connection('costos_tenant')
            ->table(self::TABLE_METRADO)
            ->where('project_id', $projectId)
            ->where('hoja', $hoja)
            ->orderBy('orden')
            ->get()
            ->map(fn($row) => (array) $row)
            ->toArray();
    }

    private function updateSheet(CostoProject $costoProject, string $hoja, Request $request): JsonResponse
    {
        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        
        $connection->beginTransaction();
        try {
            $connection->table(self::TABLE_METRADO)
                ->where('project_id', $costoProject->id)
                ->where('hoja', $hoja)
                ->delete();

            foreach ($rows as $index => $row) {
                $connection->table(self::TABLE_METRADO)->insert([
                    'project_id'  => $costoProject->id,
                    'hoja'        => $hoja,
                    'orden'       => $index,
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
                    '_level'      => $row['_level'] ?? 1,
                    '_kind'       => $row['_kind'] ?? 'leaf',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
            ]);
        } catch (\Exception $e) {
            $connection->rollBack();
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    private function toDecimal(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== auth()->id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }

    private function validateModuleEnabled(CostoProject $project): void
    {
        $enabled = $project->enabledModules()
            ->where('module_type', 'metrado_electricas')
            ->exists();

        if (!$enabled) {
            abort(403, 'El módulo de eléctricas no está habilitado.');
        }
    }
}