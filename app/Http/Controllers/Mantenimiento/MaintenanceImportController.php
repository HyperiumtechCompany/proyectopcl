<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\MaintenanceWbsImportRequest;
use App\Models\CostoProject;
use App\Services\Mantenimiento\MaintenanceWbsImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class MaintenanceImportController extends MaintenanceController
{
    public function __construct(private readonly MaintenanceWbsImportService $imports) {}

    public function preview(Request $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);

        if (! $costoProject->hasUnifiedPresupuesto()) {
            return response()->json(['available' => false, 'reason' => 'Este proyecto no tiene el módulo Presupuesto habilitado.']);
        }

        try {
            return response()->json(['available' => true] + $this->imports->preview($costoProject, $this->document($documentId)));
        } catch (ValidationException $exception) {
            return response()->json(['available' => false, 'reason' => $exception->validator->errors()->first()]);
        }
    }

    public function store(MaintenanceWbsImportRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        abort_unless($costoProject->hasUnifiedPresupuesto(), 422, 'El proyecto no tiene habilitado Presupuesto.');

        $result = $this->imports->import(
            $costoProject,
            $this->document($documentId),
            $request->string('source_hash')->toString(),
            $request->string('idempotency_key')->toString(),
            $request->user()->id,
        );

        return response()->json($result, $result['idempotent'] ? 200 : 201);
    }
}
