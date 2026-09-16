<?php

namespace App\Http\Controllers;

use App\Http\Requests\GuardarRhEmRequest;
use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RhEmController extends Controller
{
    public function __construct(private readonly CostoDatabaseService $dbService) {}

    public function index(Request $request): Response
    {
        $projectId = (int) $request->query('project');
        abort_unless($projectId > 0, 404, 'ID de proyecto no recibido');

        $project = CostoProject::findOrFail($projectId);
        $this->dbService->setTenantConnection($project->database_name);
        $mesSolicitado = $request->query('mes');
        $mes = is_string($mesSolicitado) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $mesSolicitado)
            ? $mesSolicitado
            : ($project->fecha_inicio?->format('Y-m') ?? now()->format('Y-m'));
        $hoja = DB::connection('costos_tenant')->table('rh_em_calendario')->where('mes', $mes)->first();

        return Inertia::render('costos/cronogramas/rhem/RhEm', [
            'project' => (string) $projectId,
            'projectName' => $project->nombre,
            'mes' => $mes,
            'diasDelMes' => Carbon::createFromFormat('!Y-m', $mes)->daysInMonth,
            'personal' => $hoja ? (json_decode($hoja->personal, true) ?: []) : [],
        ]);
    }

    public function store(GuardarRhEmRequest $request): JsonResponse
    {
        $data = $request->validated();
        $project = CostoProject::findOrFail($data['project_id']);
        $this->dbService->setTenantConnection($project->database_name);

        DB::connection('costos_tenant')->table('rh_em_calendario')->updateOrInsert(
            ['mes' => $data['mes']],
            [
                'personal' => json_encode($data['personal'], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json(['status' => 'success', 'message' => 'Cronograma RH-EM guardado.']);
    }
}
