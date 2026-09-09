<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Inertia\Inertia;
use Inertia\Response;

class GastosGeneralesViewController extends Controller
{
    public function __construct(
        private CostoDatabaseService $dbService
    ) {}

    public function index(CostoProject $project, string $subsection = 'consolidado'): Response
    {
        $projectParams = $this->dbService->getProjectParams($project->database_name);

        return Inertia::render('costos/gastos-generales/Index', [
            'project' => [
                'id' => $project->id,
                'nombre' => $project->nombre,
                'codigo_cui' => $project->codigo_cui,
                'codigo_local' => $project->codigo_local,
                'codigos_modulares' => $project->codigos_modulares,
                'unidad_ejecutora' => $project->unidad_ejecutora,
                'logo_izquierdo_url' => $project->plantilla_logo_izq ? asset('storage/'.$project->plantilla_logo_izq) : null,
                'logo_derecho_url' => $project->plantilla_logo_der ? asset('storage/'.$project->plantilla_logo_der) : null,
                'fecha_inicio' => $project->fecha_inicio?->format('Y-m-d'),
                'fecha_fin' => $project->fecha_fin?->format('Y-m-d'),
            ],
            'projectParams' => $projectParams ? (array) $projectParams : null,
            'subsection' => $subsection,
        ]);
    }
}
