<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Traits\HandleMetradoSpreadsheet;
use App\Traits\HandlesModularMetrado;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MetradoArquitecturaController extends Controller
{
    use HandleMetradoSpreadsheet;
    use HandlesModularMetrado;

    private const MODULE_TYPE = 'metrado_arquitectura';
    private const TABLE_CONFIG = 'metrado_arquitectura_config';
    private const TABLE_MODULOS = 'metrado_arquitectura_modulos';
    private const TABLE_EXTERIOR = 'metrado_arquitectura_exterior';
    private const TABLE_CISTERNA = 'metrado_arquitectura_cisterna';
    private const TABLE_RESUMEN = 'metrado_arquitectura_resumen';

    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        $config = $this->getOrCreateModularConfig($costoProject);
        $modulosData = [];

        for ($i = 1; $i <= $config->cantidad_modulos; $i++) {
            $modulosData[$i] = $this->queryModuloRows($costoProject, $i);
        }

        return Inertia::render('costos/metrados/ArquitecturaIndex', [
            'project' => [
                'id' => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'titulo' => 'Metrado Arquitectura',
            'baseURL' => "/costos/{$costoProject->id}/metrado-arquitectura",
            'config' => (array) $config,
            'modulos' => $modulosData,
            'exterior' => $this->queryTableRows($costoProject, self::TABLE_EXTERIOR),
            'cisterna' => $this->queryTableRows($costoProject, self::TABLE_CISTERNA),
            'resumen' => $this->queryTableRows($costoProject, self::TABLE_RESUMEN),
        ]);
    }

    public function getConfig(CostoProject $costoProject): JsonResponse
    {
        return $this->getConfigResponse($costoProject);
    }

    public function updateConfig(CostoProject $costoProject, Request $request): JsonResponse
    {
        return $this->updateConfigResponse($costoProject, $request);
    }

    public function getModulo(CostoProject $costoProject, int $moduloNumero): JsonResponse
    {
        return $this->getModuloResponse($costoProject, $moduloNumero);
    }

    public function updateModulo(CostoProject $costoProject, int $moduloNumero, Request $request): JsonResponse
    {
        return $this->updateModuloResponse($costoProject, $moduloNumero, $request);
    }

    public function getExterior(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return response()->json([
            'success' => true,
            'rows' => $this->queryTableRows($costoProject, self::TABLE_EXTERIOR),
        ]);
    }

    public function updateExterior(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return $this->updateSheet($costoProject, self::TABLE_EXTERIOR, $request);
    }

    public function getCisterna(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return response()->json([
            'success' => true,
            'rows' => $this->queryTableRows($costoProject, self::TABLE_CISTERNA),
        ]);
    }

    public function updateCisterna(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return $this->updateSheet($costoProject, self::TABLE_CISTERNA, $request);
    }

    public function getResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return response()->json([
            'success' => true,
            'rows' => $this->queryTableRows($costoProject, self::TABLE_RESUMEN),
        ]);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return $this->updateSheet($costoProject, self::TABLE_RESUMEN, $request);
    }

    public function syncResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, self::MODULE_TYPE);

        return response()->json([
            'success' => true,
            'message' => 'Sincronizacion completada (backend stub)',
        ]);
    }

    private function queryTableRows(CostoProject $costoProject, string $table): array
    {
        return $this->queryRows($costoProject, $table);
    }
}
