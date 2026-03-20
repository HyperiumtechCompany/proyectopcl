<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MetradoArquitecturaController extends Controller
{
    private const TABLE = 'metrados_arquitectura';

    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);

        $metrado = $this->getRows($costoProject->id, 'metrado');
        $resumen = $this->getRows($costoProject->id, 'resumen');

        return Inertia::render('costos/metrados/ArquitecturaIndex', [
            'project' => [
                'id' => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'metrado' => $metrado,
            'resumen' => $resumen,
        ]);
    }

    public function updateMetrado(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->save($costoProject, 'metrado', $request);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->save($costoProject, 'resumen', $request);
    }

    private function getRows(int $projectId, string $hoja): array
    {
        return DB::connection('costos_tenant')
            ->table(self::TABLE)
            ->where('project_id', $projectId)
            ->where('hoja', $hoja)
            ->orderBy('orden')
            ->get()
            ->map(fn($r) => (array)$r)
            ->toArray();
    }

    private function save(CostoProject $costoProject, string $hoja, Request $request): JsonResponse
    {
        $rows = $request->input('rows', []);
        $db = DB::connection('costos_tenant');

        $db->beginTransaction();

        try {
            $db->table(self::TABLE)
                ->where('project_id', $costoProject->id)
                ->where('hoja', $hoja)
                ->delete();

            foreach ($rows as $i => $row) {
                $db->table(self::TABLE)->insert([
                    'project_id'  => $costoProject->id,
                    'hoja'        => $hoja,
                    'orden'       => $i,
                    'partida'     => $row['partida'] ?? null,
                    'descripcion' => $row['descripcion'] ?? null,
                    'unidad'      => $row['unidad'] ?? null,
                    'elsim'       => $this->num($row['elsim'] ?? 0),
                    'largo'       => $this->num($row['largo'] ?? 0),
                    'ancho'       => $this->num($row['ancho'] ?? 0),
                    'alto'        => $this->num($row['alto'] ?? 0),
                    'nveces'      => $this->num($row['nveces'] ?? 0),
                    'lon'         => $this->num($row['lon'] ?? 0),
                    'area'        => $this->num($row['area'] ?? 0),
                    'vol'         => $this->num($row['vol'] ?? 0),
                    'kg'          => $this->num($row['kg'] ?? 0),
                    'und'         => $this->num($row['und'] ?? 0),
                    'total'       => $this->num($row['total'] ?? 0),
                    'observacion' => $row['observacion'] ?? null,
                    '_level'      => $row['_level'] ?? 1,
                    '_kind'       => $row['_kind'] ?? 'leaf',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $db->commit();

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            $db->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function num($v): float
    {
        return is_numeric($v) ? (float)$v : 0;
    }

    private function authorizeProject(CostoProject $p): void
    {
        if ($p->user_id !== auth()->id()) abort(403);
    }
}
