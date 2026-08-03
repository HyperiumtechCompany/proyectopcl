<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreElectricalProjectRequest;
use App\Models\Dialux\DialuxCircuitDefault;
use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxNormativeRequirement;
use App\Models\Dialux\DialuxOutletRule;
use App\Models\Dialux\DialuxOutletType;
use App\Models\Dialux\DialuxProject;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ElectricalProjectController extends Controller
{
    /**
     * Espacio de trabajo eléctrico de un proyecto DIALux: ambientes, luminarias,
     * tomacorrientes, circuitos, tableros, alimentadores y metrados.
     */
    public function workspace(DialuxProject $dialuxProject): Response
    {
        $this->authorizeProyecto($dialuxProject);

        $electrical = DialuxElectricalProject::query()
            ->where('dialux_project_id', (string) $dialuxProject->id)
            ->where('user_id', Auth::id())
            ->first();

        return Inertia::render('dialux/electrical/Show', [
            'project' => [
                'id' => (string) $dialuxProject->id,
                'name' => $dialuxProject->name,
                'data' => $dialuxProject->data,
            ],
            'electrical' => $electrical,
            'catalogs' => $this->buildCatalogs(),
            'normativeRequirements' => DialuxNormativeRequirement::query()
                ->where('standard', 'rne_peru')
                ->orderBy('id')
                ->get(),
        ]);
    }

    /**
     * Retorna el documento eléctrico del proyecto (para refetch desde el frontend).
     */
    public function show(Request $request, string $dialuxProjectId): JsonResponse
    {
        $electrical = DialuxElectricalProject::query()
            ->where('dialux_project_id', $dialuxProjectId)
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'data' => $electrical,
            'exists' => $electrical !== null,
        ]);
    }

    /**
     * Crea o actualiza el documento eléctrico del proyecto (autosave).
     */
    public function store(StoreElectricalProjectRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $electrical = DialuxElectricalProject::query()->updateOrCreate(
            [
                'dialux_project_id' => $validated['dialux_project_id'],
                'user_id' => $request->user()->id,
            ],
            array_merge($validated, ['user_id' => $request->user()->id]),
        );

        return response()->json([
            'message' => 'Documento eléctrico guardado correctamente.',
            'updated_at' => $electrical->updated_at->toISOString(),
        ], $electrical->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Catálogos combinados: valores del sistema (user_id null) con los
     * overrides del usuario reemplazando por clave natural.
     *
     * @return array<string, mixed>
     */
    private function buildCatalogs(): array
    {
        $userId = Auth::id();

        return [
            'outletRules' => $this->mergeByKey(
                DialuxOutletRule::query()->whereNull('user_id')->orderBy('room_type')->get(),
                DialuxOutletRule::query()->where('user_id', $userId)->get(),
                fn ($row) => $row->room_type,
            ),
            'outletTypes' => $this->mergeByKey(
                DialuxOutletType::query()->whereNull('user_id')->orderBy('id')->get(),
                DialuxOutletType::query()->where('user_id', $userId)->get(),
                fn ($row) => $row->code,
            ),
            'conductors' => $this->mergeByKey(
                DialuxConductor::query()->whereNull('user_id')->orderBy('section_mm2')->get(),
                DialuxConductor::query()->where('user_id', $userId)->get(),
                fn ($row) => $row->material.'|'.$row->section_mm2.'|'.$row->insulation,
            ),
            'circuitDefaults' => $this->mergeByKey(
                DialuxCircuitDefault::query()->whereNull('user_id')->get(),
                DialuxCircuitDefault::query()->where('user_id', $userId)->get(),
                fn ($row) => $row->circuit_type.'|'.$row->installation_category,
            ),
        ];
    }

    /**
     * @param  Collection<int, Model>  $defaults
     * @param  Collection<int, Model>  $overrides
     * @return array<int, Model>
     */
    private function mergeByKey($defaults, $overrides, callable $keyFn): array
    {
        $merged = $defaults->keyBy($keyFn);

        foreach ($overrides as $override) {
            $merged->put($keyFn($override), $override);
        }

        return $merged->values()->all();
    }

    /**
     * Verifica dueño del proyecto y bloquea demos expiradas.
     */
    protected function authorizeProyecto(DialuxProject $dialuxProject): void
    {
        if ($dialuxProject->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }

        if ($dialuxProject->is_demo && $dialuxProject->demo_expires_at?->isPast()) {
            abort(403, 'Tu demo expiró. Actualiza tu plan para seguir accediendo.');
        }
    }
}
