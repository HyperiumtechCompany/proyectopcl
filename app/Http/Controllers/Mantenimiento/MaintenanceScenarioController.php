<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\StoreMaintenanceScenarioRequest;
use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceScenario;
use App\Services\Mantenimiento\MaintenanceGgService;
use App\Services\Mantenimiento\MaintenanceMatService;
use App\Services\Mantenimiento\MaintenanceMoService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MaintenanceScenarioController extends MaintenanceController
{
    public function __construct(
        private readonly MaintenanceScenarioService $scenarios,
        private readonly MaintenanceMoService $mo,
        private readonly MaintenanceMatService $mat,
        private readonly MaintenanceGgService $gg,
    ) {}

    public function store(StoreMaintenanceScenarioRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        if ($request->filled('duplicar_de')) {
            $source = $this->scenario($document, $request->string('duplicar_de')->toString());
            $scenario = $this->scenarios->duplicate($source, $request->string('nombre')->toString());
        } else {
            $scenario = MaintenanceScenario::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $document->id,
                'tipo_hoja' => $request->string('tipo_hoja')->toString(),
                'nombre' => $request->string('nombre')->toString(),
                'es_activo' => false,
                'sort_order' => (int) $document->escenarios()->where('tipo_hoja', $request->string('tipo_hoja'))->max('sort_order') + 1024,
            ]);
        }

        return response()->json(['scenario' => ['id' => $scenario->public_id, 'nombre' => $scenario->nombre]], 201);
    }

    public function activate(Request $request, CostoProject $costoProject, string $documentId, string $scenarioId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenario($document, $scenarioId);

        $this->scenarios->activate($scenario);
        $document->increment('revision');

        return response()->json([
            'revision' => (int) $document->refresh()->revision,
            'mo' => $scenario->tipo_hoja === 'mo' ? $this->mo->payload($document, $scenario->refresh()) : null,
            'mat' => $scenario->tipo_hoja === 'mat' ? $this->mat->payload($document, $scenario->refresh()) : null,
            'gg' => $scenario->tipo_hoja === 'gg' ? $this->gg->payload($document, $scenario->refresh()) : null,
        ]);
    }
}
