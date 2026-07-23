<?php

namespace App\Http\Controllers\Dialux;

use App\Concerns\AuthorizesDialuxProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreDialuxPlanFileRequest;
use App\Models\Dialux\DialuxPlanFile;
use App\Models\Dialux\DialuxProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlanFileController extends Controller
{
    use AuthorizesDialuxProject;

    public function store(
        StoreDialuxPlanFileRequest $request,
        DialuxProject $dialuxProject,
        string $sceneId,
    ): JsonResponse {
        $this->authorizeProyecto($dialuxProject);

        $file = $request->file('plan');
        $disk = 'local';
        $extension = strtolower($file->getClientOriginalExtension());
        $directory = sprintf('dialux/plans/%s/%s', $dialuxProject->id, sha1($sceneId));
        $path = $file->storeAs($directory, Str::uuid().'.'.$extension, $disk);
        if (! $path) {
            throw new RuntimeException('No se pudo almacenar el plano.');
        }

        $existing = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->where('scene_id', $sceneId)
            ->first();

        $planFile = DialuxPlanFile::query()->updateOrCreate(
            ['dialux_project_id' => $dialuxProject->id, 'scene_id' => $sceneId],
            [
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'size_bytes' => $file->getSize(),
                'disk' => $disk,
                'path' => $path,
            ],
        );

        if ($existing && $existing->path !== $path) {
            Storage::disk($existing->disk)->delete($existing->path);
        }

        return response()->json([
            'message' => 'Plano guardado correctamente.',
            'file_name' => $planFile->original_name,
            'size_bytes' => $planFile->size_bytes,
        ]);
    }

    public function show(DialuxProject $dialuxProject, string $sceneId): StreamedResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $planFile = DialuxPlanFile::query()
            ->where('dialux_project_id', $dialuxProject->id)
            ->where('scene_id', $sceneId)
            ->firstOrFail();

        abort_unless(Storage::disk($planFile->disk)->exists($planFile->path), 404);

        return Storage::disk($planFile->disk)->download(
            $planFile->path,
            $planFile->original_name,
            [
                'Content-Type' => $planFile->mime_type,
                'X-Dialux-File-Name' => rawurlencode($planFile->original_name),
            ],
        );
    }
}
