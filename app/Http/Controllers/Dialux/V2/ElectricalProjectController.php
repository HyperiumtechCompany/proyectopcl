<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxModule;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\V2\StoreElectricalProjectRequest;
use App\Models\Dialux\DialuxCircuitDefault;
use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxNormativeRequirement;
use App\Models\Dialux\DialuxOutletRule;
use App\Models\Dialux\DialuxOutletType;
use App\Models\Dialux\DialuxProject;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
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
                'data' => $dialuxModule->data,
            ],
            'module' => [
                'id' => (string) $dialuxModule->id,
                'name' => $dialuxModule->name,
                'data' => $dialuxModule->data,
            ],
            'electrical' => $dialuxModule->electricalProject()->first(),
            'saveUrl' => route('dialux-v2.modules.electrical.store', [$dialuxProject, $dialuxModule]),
            'catalogs' => $this->buildCatalogs((int) auth()->id()),
            'normativeRequirements' => DialuxNormativeRequirement::query()->where('standard', 'rne_peru')->orderBy('id')->get(),
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

    /** @return array<string, mixed> */
    private function buildCatalogs(int $userId): array
    {
        return [
            'outletRules' => $this->mergeByKey(DialuxOutletRule::query()->whereNull('user_id')->orderBy('room_type')->get(), DialuxOutletRule::query()->where('user_id', $userId)->get(), fn ($row) => $row->room_type),
            'outletTypes' => $this->mergeByKey(DialuxOutletType::query()->whereNull('user_id')->orderBy('id')->get(), DialuxOutletType::query()->where('user_id', $userId)->get(), fn ($row) => $row->code),
            'conductors' => $this->mergeByKey(DialuxConductor::query()->whereNull('user_id')->orderBy('section_mm2')->get(), DialuxConductor::query()->where('user_id', $userId)->get(), fn ($row) => $row->material.'|'.$row->section_mm2.'|'.$row->insulation),
            'circuitDefaults' => $this->mergeByKey(DialuxCircuitDefault::query()->whereNull('user_id')->get(), DialuxCircuitDefault::query()->where('user_id', $userId)->get(), fn ($row) => $row->circuit_type.'|'.$row->installation_category),
        ];
    }

    /** @param Collection<int, Model> $defaults
     * @param  Collection<int, Model>  $overrides
     * @return array<int, Model>
     */
    private function mergeByKey(Collection $defaults, Collection $overrides, callable $keyFn): array
    {
        $merged = $defaults->keyBy($keyFn);
        foreach ($overrides as $override) {
            $merged->put($keyFn($override), $override);
        }

        return $merged->values()->all();
    }
}
