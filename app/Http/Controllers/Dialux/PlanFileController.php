<?php

namespace App\Http\Controllers\Dialux;

use App\Concerns\AuthorizesDialuxProject;
use App\Concerns\DetectsDwgCompatibility;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\LinkDialuxPlanFileRequest;
use App\Http\Requests\Dialux\StoreDialuxPlanFileRequest;
use App\Models\Dialux\DialuxPlan;
use App\Models\Dialux\DialuxPlanFile;
use App\Models\Dialux\DialuxProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlanFileController extends Controller
{
    use AuthorizesDialuxProject;
    use DetectsDwgCompatibility;

    /**
     * Devuelve, para cada piso del proyecto que tiene plano, a qué archivo
     * apunta. Permite al editor mostrar por piso si su plano es propio o
     * compartido con otros pisos (varios `scene_id` con el mismo `plan_id`).
     */
    public function index(DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $bindings = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->with('plan:id,original_name,size_bytes')
            ->get()
            ->map(fn (DialuxPlanFile $binding): array => [
                'scene_id' => $binding->scene_id,
                'plan_id' => $binding->dialux_plan_id,
                'original_name' => $binding->plan?->original_name,
                'size_bytes' => $binding->plan?->size_bytes,
            ])
            ->values();

        return response()->json(['bindings' => $bindings]);
    }

    /**
     * Sube un plano DXF/DWG nuevo y lo vincula al piso indicado. Si el piso
     * ya tenía un plano propio (no compartido con otros pisos), el archivo
     * anterior se reemplaza; si era compartido, los demás pisos conservan
     * su vínculo intacto.
     */
    public function store(
        StoreDialuxPlanFileRequest $request,
        DialuxProject $dialuxProject,
        string $sceneId,
    ): JsonResponse {
        $this->authorizeProyecto($dialuxProject);

        $file = $request->file('plan');
        $disk = 'local';
        $extension = strtolower($file->getClientOriginalExtension());
        $warning = $this->detectDwgCompatibilityWarning($file);
        $directory = sprintf('dialux/plans/%s', $dialuxProject->id);
        $path = $file->storeAs($directory, Str::uuid().'.'.$extension, $disk);
        if (! $path) {
            throw new RuntimeException('No se pudo almacenar el plano.');
        }

        $plan = DialuxPlan::query()->create([
            'dialux_project_id' => $dialuxProject->id,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'size_bytes' => $file->getSize(),
            'disk' => $disk,
            'path' => $path,
        ]);

        $this->rebindScene($dialuxProject, $sceneId, $plan->id);

        return response()->json([
            'message' => 'Plano guardado correctamente.',
            'file_name' => $plan->original_name,
            'size_bytes' => $plan->size_bytes,
            'warning' => $warning,
        ]);
    }

    /**
     * Vincula el piso indicado al mismo plano que otro piso del proyecto,
     * sin duplicar el archivo en disco. Permite reutilizar un plano entre
     * pisos similares (ej. piso 1, 2 y 3 comparten el mismo plano).
     */
    public function link(
        LinkDialuxPlanFileRequest $request,
        DialuxProject $dialuxProject,
        string $sceneId,
    ): JsonResponse {
        $this->authorizeProyecto($dialuxProject);

        $sourceSceneId = $request->validated('source_scene_id');
        if ($sourceSceneId === $sceneId) {
            return response()->json([
                'message' => 'El piso de origen debe ser distinto del piso actual.',
            ], HttpResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        $sourceBinding = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->where('scene_id', $sourceSceneId)
            ->first();

        if (! $sourceBinding) {
            return response()->json([
                'message' => 'El piso de origen no tiene un plano para reutilizar.',
            ], HttpResponse::HTTP_NOT_FOUND);
        }

        $plan = $this->rebindScene($dialuxProject, $sceneId, $sourceBinding->dialux_plan_id);

        return response()->json([
            'message' => 'Plano reutilizado correctamente.',
            'file_name' => $plan->original_name,
            'size_bytes' => $plan->size_bytes,
        ]);
    }

    public function show(DialuxProject $dialuxProject, string $sceneId): StreamedResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $binding = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->where('scene_id', $sceneId)
            ->with('plan')
            ->firstOrFail();

        $plan = $binding->plan;
        abort_unless($plan && Storage::disk($plan->disk)->exists($plan->path), 404);

        return Storage::disk($plan->disk)->download(
            $plan->path,
            $plan->original_name,
            [
                'Content-Type' => $plan->mime_type,
                'X-Dialux-File-Name' => rawurlencode($plan->original_name),
            ],
        );
    }

    /**
     * Desvincula el plano de un piso (ej. al eliminarlo). Si nadie más
     * referencia ese plano, borra también el archivo físico.
     */
    public function destroy(DialuxProject $dialuxProject, string $sceneId): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $binding = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->where('scene_id', $sceneId)
            ->first();

        if ($binding) {
            $planId = $binding->dialux_plan_id;
            $binding->delete();
            $this->deletePlanIfOrphaned($planId);
        }

        return response()->json(['message' => 'Plano desvinculado correctamente.']);
    }

    /**
     * Crea o actualiza el vínculo scene→plan, limpiando el plano anterior
     * del piso si quedó sin ningún otro piso que lo use.
     */
    private function rebindScene(DialuxProject $dialuxProject, string $sceneId, int $planId): DialuxPlan
    {
        $existing = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->where('scene_id', $sceneId)
            ->first();

        $previousPlanId = $existing?->dialux_plan_id;

        DialuxPlanFile::query()->updateOrCreate(
            ['dialux_project_id' => $dialuxProject->id, 'scene_id' => $sceneId],
            ['dialux_plan_id' => $planId],
        );

        if ($previousPlanId && $previousPlanId !== $planId) {
            $this->deletePlanIfOrphaned($previousPlanId);
        }

        return DialuxPlan::query()->findOrFail($planId);
    }

    private function deletePlanIfOrphaned(int $planId): void
    {
        $stillReferenced = DialuxPlanFile::query()->where('dialux_plan_id', $planId)->exists();
        if ($stillReferenced) {
            return;
        }

        $plan = DialuxPlan::query()->find($planId);
        if (! $plan) {
            return;
        }

        Storage::disk($plan->disk)->delete($plan->path);
        $plan->delete();
    }
}
