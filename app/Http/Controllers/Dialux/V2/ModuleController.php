<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxModule;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\V2\DuplicateDialuxModuleRequest;
use App\Http\Requests\Dialux\V2\ReorderDialuxModulesRequest;
use App\Http\Requests\Dialux\V2\StoreDialuxModuleRequest;
use App\Http\Requests\Dialux\V2\UpdateDialuxModuleRequest;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Services\Dialux\V2\DialuxModuleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ModuleController extends Controller
{
    use AuthorizesDialuxModule;

    public function __construct(private readonly DialuxModuleService $modules) {}

    public function index(DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        return response()->json(['modules' => $dialuxProject->modules()->get()]);
    }

    public function store(StoreDialuxModuleRequest $request, DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);
        $module = $this->modules->create($dialuxProject, $request->validated());

        return response()->json(['module' => $module], 201);
    }

    public function show(DialuxProject $dialuxProject, DialuxModule $dialuxModule): JsonResponse|Response
    {
        $this->authorizeModule($dialuxProject, $dialuxModule);

        if (! request()->wantsJson()) {
            return Inertia::render('dialux/v2/Module', [
                'project' => [
                    'id' => $dialuxProject->id,
                    'name' => $dialuxProject->name,
                ],
                'module' => [
                    'id' => $dialuxModule->id,
                    'name' => $dialuxModule->name,
                    'status' => $dialuxModule->status,
                    'data' => $dialuxModule->data,
                ],
                'modules' => $dialuxProject->modules()->get([
                    'id',
                    'name',
                    'description',
                    'status',
                    'sort_order',
                ]),
            ]);
        }

        return response()->json(['module' => $dialuxModule]);
    }

    public function update(
        UpdateDialuxModuleRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $dialuxModule->update($request->validated());

        return response()->json([
            'message' => 'Módulo actualizado correctamente.',
            'module' => $dialuxModule->fresh(),
        ]);
    }

    public function destroy(DialuxProject $dialuxProject, DialuxModule $dialuxModule): JsonResponse
    {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        Storage::disk('local')->deleteDirectory("dialux/v2/modules/{$dialuxModule->id}");
        $dialuxModule->delete();

        return response()->json(status: 204);
    }

    public function duplicate(
        DuplicateDialuxModuleRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $module = $this->modules->duplicate($dialuxProject, $dialuxModule, $request->validated('name'));

        return response()->json(['module' => $module], 201);
    }

    public function reorder(ReorderDialuxModulesRequest $request, DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);
        $modules = $this->modules->reorder($dialuxProject, $request->validated('modules'));

        return response()->json(['modules' => $modules]);
    }
}
