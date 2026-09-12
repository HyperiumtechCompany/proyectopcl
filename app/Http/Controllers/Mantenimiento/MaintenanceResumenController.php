<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\UpdateResumenParametrosRequest;
use App\Models\CostoProject;
use App\Services\Mantenimiento\MaintenanceResumenService;
use Illuminate\Http\JsonResponse;

class MaintenanceResumenController extends MaintenanceController
{
    public function __construct(private readonly MaintenanceResumenService $resumen) {}

    public function updateParametros(UpdateResumenParametrosRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->resumen->updateParametros($document, $request->validated()));
    }
}
