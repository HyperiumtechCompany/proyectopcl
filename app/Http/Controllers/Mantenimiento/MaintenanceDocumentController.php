<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Requests\Mantenimiento\StoreMaintenanceDocumentRequest;
use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Services\Mantenimiento\MaintenanceGgService;
use App\Services\Mantenimiento\MaintenanceMatService;
use App\Services\Mantenimiento\MaintenanceMoService;
use App\Services\Mantenimiento\MaintenanceResumenService;
use App\Services\Mantenimiento\MaintenanceScenarioService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceDocumentController extends MaintenanceController
{
    public function __construct(
        private readonly MaintenanceMoService $mo,
        private readonly MaintenanceMatService $mat,
        private readonly MaintenanceGgService $gg,
        private readonly MaintenanceResumenService $resumen,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function index(Request $request, CostoProject $costoProject): Response
    {
        $this->authorizeProject($request, $costoProject);

        return Inertia::render('costos/mantenimiento/Index', [
            'project' => ['id' => $costoProject->id, 'nombre' => $costoProject->nombre],
            'documents' => MaintenanceDocument::query()
                ->latest('updated_at')
                ->get(['public_id', 'nombre', 'moneda', 'estado', 'revision', 'updated_at']),
        ]);
    }

    public function store(StoreMaintenanceDocumentRequest $request, CostoProject $costoProject): RedirectResponse
    {
        $this->authorizeProject($request, $costoProject);

        $document = MaintenanceDocument::create([
            'public_id' => (string) Str::ulid(),
            'nombre' => $request->string('nombre')->toString(),
            'moneda' => $request->string('moneda', 'PEN')->toString() ?: 'PEN',
        ]);

        return redirect()->route('costos.mantenimiento.show', [$costoProject, $document->public_id]);
    }

    public function show(Request $request, CostoProject $costoProject, string $documentId): Response
    {
        $this->authorizeProject($request, $costoProject);
        $document = $this->document($documentId);

        return Inertia::render('costos/mantenimiento/Editor', [
            'project' => ['id' => $costoProject->id, 'nombre' => $costoProject->nombre],
            'document' => [
                'id' => $document->public_id,
                'nombre' => $document->nombre,
                'moneda' => $document->moneda,
                'revision' => (int) $document->revision,
            ],
            'imported' => $document->partidas()->exists(),
            'presupuesto_disponible' => $costoProject->hasUnifiedPresupuesto(),
            'mo' => $this->mo->payload($document, $this->scenarios->activeFor($document, 'mo')),
            'mat' => $this->mat->payload($document, $this->scenarios->activeFor($document, 'mat')),
            'gg' => $this->gg->payload($document, $this->scenarios->activeFor($document, 'gg')),
            'resumen' => $this->resumen->payload($document),
        ]);
    }

    public function destroy(Request $request, CostoProject $costoProject, string $documentId): RedirectResponse
    {
        $this->authorizeProject($request, $costoProject);
        $this->document($documentId)->delete();

        return redirect()->route('costos.mantenimiento.index', $costoProject);
    }
}
