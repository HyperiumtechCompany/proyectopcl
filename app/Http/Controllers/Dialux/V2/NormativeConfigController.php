<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxModule;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\V2\StoreNormativeConfigRequest;
use App\Http\Requests\Dialux\V2\UpdateNormativeComplianceRequest;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxNormativeConfig;
use App\Models\Dialux\DialuxProject;
use App\Services\Dialux\V2\ProjectSummaryService;
use Illuminate\Http\JsonResponse;

class NormativeConfigController extends Controller
{
    use AuthorizesDialuxModule;

    public function __construct(private readonly ProjectSummaryService $summaries) {}

    public function show(DialuxProject $dialuxProject, DialuxModule $dialuxModule): JsonResponse
    {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $config = $dialuxModule->normativeConfig()->first();

        return response()->json([
            'data' => $config,
            'exists' => $config !== null,
        ]);
    }

    public function store(
        StoreNormativeConfigRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $validated = $request->validated();

        $config = DialuxNormativeConfig::query()->updateOrCreate(
            [
                'dialux_module_id' => $dialuxModule->id,
                'user_id' => $request->user()->id,
            ],
            [
                ...$validated,
                'dialux_project_id' => null,
                'user_id' => $request->user()->id,
                'norms_consulted_at' => $validated['norms_consulted_at'] ?? now()->toDateString(),
                'disclaimer' => $validated['disclaimer'] ?? $this->defaultDisclaimer($validated['primary_standard']),
            ],
        );

        return response()->json([
            'data' => $config,
            'message' => 'Configuración normativa del módulo guardada correctamente.',
        ], $config->wasRecentlyCreated ? 201 : 200);
    }

    public function updateCompliance(
        UpdateNormativeComplianceRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);

        $updated = $dialuxModule->normativeConfig()->update($request->validated());

        if ($updated) {
            $this->summaries->invalidate($dialuxProject);
        }
        abort_unless($updated, 404, 'Configuración normativa no encontrada.');

        return response()->json(['message' => 'Resumen de cumplimiento actualizado.']);
    }

    private function defaultDisclaimer(string $standard): string
    {
        return "Los resultados se basan en la norma {$standard}. Consulte la publicación oficial vigente.";
    }
}
