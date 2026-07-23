<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreCircuitDefaultRequest;
use App\Http\Requests\Dialux\StoreConductorRequest;
use App\Http\Requests\Dialux\StoreOutletRuleRequest;
use App\Http\Requests\Dialux\StoreOutletTypeRequest;
use App\Models\Dialux\DialuxCircuitDefault;
use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxOutletRule;
use App\Models\Dialux\DialuxOutletType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ElectricalCatalogController extends Controller
{
    /**
     * Crea o actualiza la regla de tomacorrientes del usuario para un tipo de ambiente.
     */
    public function storeOutletRule(StoreOutletRuleRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $rule = DialuxOutletRule::query()->updateOrCreate(
            ['user_id' => $request->user()->id, 'room_type' => $validated['room_type']],
            $validated,
        );

        return response()->json(['data' => $rule], $rule->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Elimina el override del usuario (vuelve a aplicar la regla del sistema).
     */
    public function destroyOutletRule(Request $request, int $id): JsonResponse
    {
        DialuxOutletRule::query()
            ->whereKey($id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Regla eliminada.']);
    }

    /**
     * Crea o actualiza un tipo de tomacorriente del usuario.
     */
    public function storeOutletType(StoreOutletTypeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $type = DialuxOutletType::query()->updateOrCreate(
            ['user_id' => $request->user()->id, 'code' => $validated['code']],
            $validated,
        );

        return response()->json(['data' => $type], $type->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Elimina un tipo de tomacorriente del usuario.
     */
    public function destroyOutletType(Request $request, int $id): JsonResponse
    {
        DialuxOutletType::query()
            ->whereKey($id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Tipo eliminado.']);
    }

    /**
     * Crea o actualiza un conductor del usuario.
     */
    public function storeConductor(StoreConductorRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $conductor = DialuxConductor::query()->updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'material' => $validated['material'],
                'section_mm2' => $validated['section_mm2'],
                'insulation' => $validated['insulation'],
            ],
            $validated,
        );

        return response()->json(['data' => $conductor], $conductor->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Elimina un conductor del usuario.
     */
    public function destroyConductor(Request $request, int $id): JsonResponse
    {
        DialuxConductor::query()
            ->whereKey($id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Conductor eliminado.']);
    }

    /**
     * Crea o actualiza los parámetros por defecto de un tipo de circuito.
     */
    public function storeCircuitDefault(StoreCircuitDefaultRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $default = DialuxCircuitDefault::query()->updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'circuit_type' => $validated['circuit_type'],
                'installation_category' => $validated['installation_category'],
            ],
            $validated,
        );

        return response()->json(['data' => $default], $default->wasRecentlyCreated ? 201 : 200);
    }
}
