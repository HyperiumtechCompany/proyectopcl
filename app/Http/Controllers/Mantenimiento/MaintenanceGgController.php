<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\DeleteGgRubroRequest;
use App\Http\Requests\Mantenimiento\RenameGgRubroRequest;
use App\Http\Requests\Mantenimiento\SetGgPagoValorRequest;
use App\Http\Requests\Mantenimiento\StoreGgLineaRequest;
use App\Http\Requests\Mantenimiento\StoreGgPagoRequest;
use App\Http\Requests\Mantenimiento\UpdateGgLineaRequest;
use App\Http\Requests\Mantenimiento\UpdateGgPagoRequest;
use App\Models\CostoProject;
use App\Services\Mantenimiento\MaintenanceGgService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceGgController extends MaintenanceController
{
    public function __construct(
        private readonly MaintenanceGgService $gg,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function seedPlantilla(Request $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $this->scenarios->activeFor($document, 'gg');

        return response()->json($this->gg->seedPlantilla($document));
    }

    public function storeLinea(StoreGgLineaRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $this->scenarios->activeFor($document, 'gg');

        return response()->json($this->gg->addLinea($document, $request->validated()), 201);
    }

    public function updateLinea(UpdateGgLineaRequest $request, CostoProject $costoProject, string $documentId, string $lineaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->gg->updateLinea($document, $this->ggLinea($document, $lineaId), $request->validated()));
    }

    public function destroyLinea(Request $request, CostoProject $costoProject, string $documentId, string $lineaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->gg->deleteLinea($document, $this->ggLinea($document, $lineaId)));
    }

    public function renameRubro(RenameGgRubroRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $data = $request->validated();

        return response()->json($this->gg->renameRubro($document, $data['grupo'], $data['rubro'], $data['nuevo_rubro']));
    }

    public function destroyRubro(DeleteGgRubroRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $data = $request->validated();

        return response()->json($this->gg->deleteRubro($document, $data['grupo'], $data['rubro']));
    }

    public function storePago(StoreGgPagoRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'gg');

        return response()->json($this->gg->addPago($document, $scenario, $request->input('fecha'), $request->input('etiqueta')), 201);
    }

    public function updatePago(UpdateGgPagoRequest $request, CostoProject $costoProject, string $documentId, string $pagoId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->gg->updatePago($document, $this->ggPago($document, $pagoId), $request->validated()));
    }

    public function destroyPago(Request $request, CostoProject $costoProject, string $documentId, string $pagoId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->gg->deletePago($document, $this->ggPago($document, $pagoId)));
    }

    public function setPagoValor(SetGgPagoValorRequest $request, CostoProject $costoProject, string $documentId, string $pagoId, string $lineaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->gg->setPagoValor(
            $document,
            $this->ggPago($document, $pagoId),
            $this->ggLinea($document, $lineaId),
            $request->input('monto'),
        ));
    }
}
