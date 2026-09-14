<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\UpdateResumenParametrosRequest;
use App\Models\CostoProject;
use App\Services\Mantenimiento\MaintenanceResumenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceResumenController extends MaintenanceController
{
    public function __construct(private readonly MaintenanceResumenService $resumen) {}

    // Refresco liviano al entrar a la pestaña RESUMEN (mismo motivo que MaintenanceMoController::show)
    // — RESUMEN es el que más rápido queda desactualizado porque agrega MO+MAT+GG.
    public function show(Request $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json(['revision' => (int) $document->revision, 'resumen' => $this->resumen->payload($document)]);
    }

    public function updateParametros(UpdateResumenParametrosRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->resumen->updateParametros($document, $request->validated()));
    }
}
