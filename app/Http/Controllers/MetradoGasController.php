<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Traits\HandleMetradoSpreadsheet;

class MetradoGasController extends Controller
{
    use HandleMetradoSpreadsheet;

    private const TABLE_METRADO = 'metrado_gas';
    private const TABLE_RESUMEN = 'metrado_gas_resumen';

    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');

        return Inertia::render('costos/metrados/GasIndex', [
            'project' => [
                'id'     => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'metrado' => $this->queryRows($costoProject, self::TABLE_METRADO),
            'resumen' => $this->queryRows($costoProject, self::TABLE_RESUMEN),
        ]);
    }

    public function updateMetrado(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');
        return $this->updateSheet($costoProject, self::TABLE_METRADO, $request);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');
        return $this->updateSheet($costoProject, self::TABLE_RESUMEN, $request);
    }

    public function syncResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_gas');
        
        return response()->json([
            'success' => true,
            'message' => 'Sincronización completada (backend stub)',
        ]);
    }
}