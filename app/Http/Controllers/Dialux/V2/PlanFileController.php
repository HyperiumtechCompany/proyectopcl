<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxModule;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\LinkDialuxPlanFileRequest;
use App\Http\Requests\Dialux\StoreDialuxPlanFileRequest;
use App\Models\Dialux\DialuxModule;
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
    use AuthorizesDialuxModule;

    public function store(
        StoreDialuxPlanFileRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
        string $sceneId,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);

        $file = $request->file('plan');
        $extension = strtolower($file->getClientOriginalExtension());
        $directory = "dialux/v2/modules/{$dialuxModule->id}/plans";
        $path = $file->storeAs($directory, Str::uuid().'.'.$extension, 'local');

        if (! $path) {
            throw new RuntimeException('No se pudo almacenar el plano.');
        }

        $plan = $dialuxModule->plans()->create([
            'dialux_project_id' => null,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'size_bytes' => $file->getSize(),
            'disk' => 'local',
            'path' => $path,
        ]);

        $this->rebindScene($dialuxModule, $sceneId, $plan->id);

        return response()->json([
            'message' => 'Plano del módulo guardado correctamente.',
            'file_name' => $plan->original_name,
            'size_bytes' => $plan->size_bytes,
        ]);
    }

    public function link(
        LinkDialuxPlanFileRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
        string $sceneId,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $sourceSceneId = $request->validated('source_scene_id');

        if ($sourceSceneId === $sceneId) {
            return response()->json([
                'message' => 'El piso de origen debe ser distinto del piso actual.',
            ], HttpResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        $source = $dialuxModule->planFiles()->where('scene_id', $sourceSceneId)->first();
        abort_unless($source, 404, 'El piso de origen no tiene un plano para reutilizar.');

        $plan = $this->rebindScene($dialuxModule, $sceneId, $source->dialux_plan_id);

        return response()->json([
            'message' => 'Plano reutilizado correctamente.',
            'file_name' => $plan->original_name,
            'size_bytes' => $plan->size_bytes,
        ]);
    }

    public function show(
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
        string $sceneId,
    ): StreamedResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);

        $binding = $dialuxModule->planFiles()->where('scene_id', $sceneId)->with('plan')->firstOrFail();
        $plan = $binding->plan;
        abort_unless($plan && Storage::disk($plan->disk)->exists($plan->path), 404);

        return Storage::disk($plan->disk)->download($plan->path, $plan->original_name, [
            'Content-Type' => $plan->mime_type,
            'X-Dialux-File-Name' => rawurlencode($plan->original_name),
        ]);
    }

    public function destroy(
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
        string $sceneId,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $binding = $dialuxModule->planFiles()->where('scene_id', $sceneId)->first();

        if ($binding) {
            $planId = $binding->dialux_plan_id;
            $binding->delete();
            $this->deletePlanIfOrphaned($planId);
        }

        return response()->json(['message' => 'Plano desvinculado correctamente.']);
    }

    private function rebindScene(DialuxModule $module, string $sceneId, int $planId): DialuxPlan
    {
        $existing = $module->planFiles()->where('scene_id', $sceneId)->first();
        $previousPlanId = $existing?->dialux_plan_id;

        DialuxPlanFile::query()->updateOrCreate(
            ['dialux_module_id' => $module->id, 'scene_id' => $sceneId],
            ['dialux_project_id' => null, 'dialux_plan_id' => $planId],
        );

        if ($previousPlanId && $previousPlanId !== $planId) {
            $this->deletePlanIfOrphaned($previousPlanId);
        }

        return $module->plans()->findOrFail($planId);
    }

    private function deletePlanIfOrphaned(int $planId): void
    {
        if (DialuxPlanFile::query()->where('dialux_plan_id', $planId)->exists()) {
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
