<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\DuplicateInstitucionRequest;
use App\Http\Requests\Mantenimiento\SavePlantillaRequest;
use App\Http\Requests\Mantenimiento\SetMoParcialRequest;
use App\Http\Requests\Mantenimiento\StoreMoPartidaRequest;
use App\Http\Requests\Mantenimiento\StoreMoSeriesRequest;
use App\Http\Requests\Mantenimiento\UpdateMoPartidaRequest;
use App\Http\Requests\Mantenimiento\UpdateMoSeriesRequest;
use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenancePlantilla;
use App\Services\Mantenimiento\MaintenanceMoService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceMoController extends MaintenanceController
{
    public function __construct(
        private readonly MaintenanceMoService $mo,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    // Refresco liviano al entrar a la pestaña MO: el árbol de partidas se comparte con MAT, así
    // que un cambio estructural hecho desde MAT (o Duplicar institución) no se refleja en MO
    // hasta que se vuelve a pedir el payload — evita depender de un reload de página completa.
    public function show(Request $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mo');

        return response()->json(['revision' => (int) $document->revision, 'mo' => $this->mo->payload($document, $scenario)]);
    }

    public function updatePartida(UpdateMoPartidaRequest $request, CostoProject $costoProject, string $documentId, string $partidaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $partida = $this->partida($document, $partidaId);
        $scenario = $this->scenarios->activeFor($document, 'mo');

        return response()->json($this->mo->updatePartida($document, $scenario, $partida, $request->validated()));
    }

    public function storePartida(StoreMoPartidaRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $this->scenarios->activeFor($document, 'mo');
        $parent = $request->filled('parent_id') ? $this->partida($document, $request->string('parent_id')->toString()) : null;

        return response()->json($this->mo->addPartida($document, $parent, $request->validated()), 201);
    }

    public function destroyPartida(Request $request, CostoProject $costoProject, string $documentId, string $partidaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mo->deletePartida($document, $this->partida($document, $partidaId)));
    }

    public function duplicateInstitucion(DuplicateInstitucionRequest $request, CostoProject $costoProject, string $documentId, string $partidaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mo');
        $sourceIe = $this->partida($document, $partidaId);

        return response()->json($this->mo->duplicateInstitucion($document, $scenario, $sourceIe, $request->string('nombre')->toString()), 201);
    }

    public function savePlantilla(SavePlantillaRequest $request, CostoProject $costoProject, string $documentId, string $partidaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mo');
        $sourceIe = $this->partida($document, $partidaId);

        $plantilla = $this->mo->savePlantilla($scenario, $sourceIe, $request->user()->id, $request->string('nombre')->toString(), $request->input('descripcion'));

        return response()->json(['plantilla' => ['id' => $plantilla->id, 'nombre' => $plantilla->nombre]], 201);
    }

    public function applyPlantilla(DuplicateInstitucionRequest $request, CostoProject $costoProject, string $documentId, int $plantillaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mo');
        $plantilla = MaintenancePlantilla::query()->findOrFail($plantillaId);
        abort_unless($plantilla->user_id === $request->user()->id, 403);

        return response()->json($this->mo->applyPlantilla($document, $scenario, $plantilla, $request->string('nombre')->toString()), 201);
    }

    public function storeSeries(StoreMoSeriesRequest $request, CostoProject $costoProject, string $documentId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);
        $scenario = $this->scenarios->activeFor($document, 'mo');

        return response()->json($this->mo->addSeries($document, $scenario, $request->input('fecha'), $request->input('etiqueta')), 201);
    }

    public function updateSeries(UpdateMoSeriesRequest $request, CostoProject $costoProject, string $documentId, string $serieId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mo->updateSeries($document, $this->series($document, $serieId), $request->validated()));
    }

    public function destroySeries(Request $request, CostoProject $costoProject, string $documentId, string $serieId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mo->deleteSeries($document, $this->series($document, $serieId)));
    }

    public function setParcial(SetMoParcialRequest $request, CostoProject $costoProject, string $documentId, string $serieId, string $partidaId): JsonResponse
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return response()->json($this->mo->setParcial(
            $document,
            $this->series($document, $serieId),
            $this->partida($document, $partidaId),
            $request->input('monto'),
        ));
    }
}
