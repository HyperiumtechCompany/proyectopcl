<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxModule;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\V2\StoreElectricalProjectRequest;
use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class ElectricalProjectController extends Controller
{
    use AuthorizesDialuxModule;

    public function workspace(DialuxProject $dialuxProject, DialuxModule $dialuxModule): Response
    {
        $this->authorizeModule($dialuxProject, $dialuxModule);

        return Inertia::render('dialux/electrical/Show', [
            'project' => [
                'id' => (string) $dialuxProject->id,
                'name' => $dialuxProject->name,
            ],
            'module' => [
                'id' => (string) $dialuxModule->id,
                'name' => $dialuxModule->name,
                'data' => $dialuxModule->data,
            ],
            'electrical' => $dialuxModule->electricalProject()->first(),
        ]);
    }

    public function show(DialuxProject $dialuxProject, DialuxModule $dialuxModule): JsonResponse
    {
        $this->authorizeModule($dialuxProject, $dialuxModule);
        $electrical = $dialuxModule->electricalProject()->first();

        return response()->json([
            'data' => $electrical,
            'exists' => $electrical !== null,
        ]);
    }

    public function store(
        StoreElectricalProjectRequest $request,
        DialuxProject $dialuxProject,
        DialuxModule $dialuxModule,
    ): JsonResponse {
        $this->authorizeModule($dialuxProject, $dialuxModule);

        $electrical = DialuxElectricalProject::query()->updateOrCreate(
            [
                'dialux_module_id' => $dialuxModule->id,
                'user_id' => $request->user()->id,
            ],
            [
                ...$request->validated(),
                'dialux_project_id' => null,
                'user_id' => $request->user()->id,
            ],
        );

        return response()->json([
            'message' => 'Documento eléctrico del módulo guardado correctamente.',
            'updated_at' => $electrical->updated_at->toISOString(),
        ], $electrical->wasRecentlyCreated ? 201 : 200);
    }
}
