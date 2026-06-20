<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Traits\HandleMetradoSpreadsheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MetradoElectricasController extends Controller
{
    use HandleMetradoSpreadsheet;

    private const TABLE_METRADO = 'metrado_electricas';

    private const TABLE_RESUMEN = 'metrado_electricas_resumen';

    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_electricas');

      return Inertia::render('costos/metrados/ElectricasIndex', [
    'project' => [
        'id' => $costoProject->id,
        'nombre' => $costoProject->nombre,
        'codigo_cui' => $costoProject->codigo_cui,
        'codigo_local' => $costoProject->codigo_local,
        'unidad_ejecutora' => $costoProject->unidad_ejecutora,
        'propietario' => $costoProject->unidad_ejecutora,
        'codigos_modulares' => $costoProject->codigos_modulares,
        'plantilla_logo_izq_url' => $costoProject->plantilla_logo_izq ? asset('storage/' . $costoProject->plantilla_logo_izq) : null,
        'plantilla_logo_der_url' => $costoProject->plantilla_logo_der ? asset('storage/' . $costoProject->plantilla_logo_der) : null,
    ],
    'metrado' => $this->queryRows($costoProject, self::TABLE_METRADO),
    'resumen' => $this->queryRows($costoProject, self::TABLE_RESUMEN),
]);
    }

    public function updateMetrado(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_electricas');

        return $this->updateSheet($costoProject, self::TABLE_METRADO, $request);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_electricas');

        return $this->updateSheet($costoProject, self::TABLE_RESUMEN, $request);
    }

    public function syncResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject, 'metrado_electricas');

        return response()->json([
            'success' => true,
            'message' => 'Sincronización completada (backend stub)',
        ]);
    }
}
