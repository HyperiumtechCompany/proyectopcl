<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\SetMatCompraValorRequest;
use App\Http\Requests\Mantenimiento\SetMatCotizacionRequest;
use App\Http\Requests\Mantenimiento\StoreMatCompraRequest;
use App\Http\Requests\Mantenimiento\StoreMatMaterialRequest;
use App\Http\Requests\Mantenimiento\UpdateMatCompraRequest;
use App\Http\Requests\Mantenimiento\UpdateMatMaterialRequest;
use App\Models\CostoProject;
use App\Services\Mantenimiento\MaintenanceMatService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceMatController extends MaintenanceController
{
    public function __construct(
        private readonly MaintenanceMatService $mat,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    // Refresco liviano tras un cambio estructural en el árbol compartido (partidas), que se
    // hace vía los endpoints de MO: evita el router.reload() de página completa en MatSheet.
    public function show(Request $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mat');

        return response()->json(['revision' => (int) $document->revision, 'mat' => $this->mat->payload($document, $scenario)]);
    }

    public function updateMaterial(UpdateMatMaterialRequest $request, CostoProject $costoProject, string $documentId, string $materialId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mat->updateMaterial($document, $this->material($document, $materialId), $request->validated()));
    }

    public function storeMaterial(StoreMatMaterialRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $this->scenarios->activeFor($document, 'mat');
        $partida = $this->partida($document, $request->string('partida_id')->toString());

        return response()->json($this->mat->addMaterial($document, $partida, $request->validated()), 201);
    }

    public function destroyMaterial(Request $request, CostoProject $costoProject, string $documentId, string $materialId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mat->deleteMaterial($document, $this->material($document, $materialId)));
    }

    public function setCotizacion(SetMatCotizacionRequest $request, CostoProject $costoProject, string $documentId, string $materialId, int $slot): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        abort_unless($slot >= 1 && $slot <= 3, 422);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mat');

        return response()->json($this->mat->setCotizacion($document, $scenario, $this->material($document, $materialId), $slot, $request->validated()));
    }

    public function storeCompra(StoreMatCompraRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mat');

        return response()->json($this->mat->addCompra($document, $scenario, $request->input('fecha'), $request->input('etiqueta')), 201);
    }

    public function updateCompra(UpdateMatCompraRequest $request, CostoProject $costoProject, string $documentId, string $compraId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mat->updateCompra($document, $this->compra($document, $compraId), $request->validated()));
    }

    public function destroyCompra(Request $request, CostoProject $costoProject, string $documentId, string $compraId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mat->deleteCompra($document, $this->compra($document, $compraId)));
    }

    public function setCompraValor(SetMatCompraValorRequest $request, CostoProject $costoProject, string $documentId, string $compraId, string $materialId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mat->setCompraValor(
            $document,
            $this->compra($document, $compraId),
            $this->material($document, $materialId),
            $request->validated(),
        ));
    }
}
