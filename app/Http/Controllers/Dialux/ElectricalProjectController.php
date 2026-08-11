<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\MaterializeOutletCircuitRequest;
use App\Http\Requests\Dialux\PlacePanelRequest;
use App\Http\Requests\Dialux\StoreElectricalProjectRequest;
use App\Models\Dialux\DialuxCircuitDefault;
use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxElectricalProject;
use App\Models\Dialux\DialuxNormativeRequirement;
use App\Models\Dialux\DialuxOutletRule;
use App\Models\Dialux\DialuxOutletType;
use App\Models\Dialux\DialuxProject;
use App\Services\Dialux\CadElectricalBridgeService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
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
     * Puente TD/TG (Fase D del plan "exportador DXF profesional"): materializa
     * en el plano CAD (`project.data`, BD) los tomacorrientes que un Circuit
     * del Módulo Eléctrico analítico calculó para un ElectricalRoom ya
     * importado. Las dos páginas Inertia (canvas / eléctrico) no comparten
     * estado en vivo -- este endpoint hace la escritura server-side directo
     * sobre el `data` persistido, idempotente por `circuit_id` (regenerar
     * reemplaza solo lo que este circuito ya había generado antes).
     *
     * Riesgo aceptado y documentado (no resuelto aquí): si el usuario tiene
     * el editor de plano abierto en otra pestaña con cambios sin guardar, el
     * próximo autosave de esa pestaña sobrescribirá lo que este endpoint
     * generó, con el estado (más viejo) que esa pestaña tenía en memoria.
     * Reconciliación en vivo entre ambos módulos queda fuera de alcance.
     */
    public function materializeOutlets(MaterializeOutletCircuitRequest $request, DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $validated = $request->validated();
        $data = $dialuxProject->data;

        if (! is_array($data) || empty($data['scenes'])) {
            return response()->json(['message' => 'El proyecto no tiene un plano CAD todavía.'], 422);
        }

        $sceneIndex = null;
        $roomIndex = null;
        foreach ($data['scenes'] as $sIdx => $scene) {
            foreach ($scene['rooms'] ?? [] as $rIdx => $room) {
                if (($room['id'] ?? null) === $validated['source_room_id']) {
                    $sceneIndex = $sIdx;
                    $roomIndex = $rIdx;
                    break 2;
                }
            }
        }

        if ($sceneIndex === null) {
            return response()->json([
                'message' => 'El ambiente ya no existe en el plano — vuelve a importarlo desde la pestaña "Ambientes".',
            ], 404);
        }

        $vertices = $data['scenes'][$sceneIndex]['rooms'][$roomIndex]['vertices'] ?? [];
        if (count($vertices) < 3) {
            return response()->json(['message' => 'El ambiente no tiene un polígono válido en el plano.'], 422);
        }

        $circuitId = $validated['circuit_id'];
        $deviceType = CadElectricalBridgeService::mapOutletTypeCodeToDeviceType($validated['outlet_type_code']);
        $defaults = CadElectricalBridgeService::outletDeviceDefaults($deviceType);
        $points = CadElectricalBridgeService::distributeOnPerimeter(
            $vertices,
            $validated['quantity'],
            $validated['start_offset'] ?? null,
        );

        // Regeneración idempotente: solo lo que ESTE circuito había generado antes.
        $existingDevices = $data['scenes'][$sceneIndex]['electricalDevices'] ?? [];
        $keptDevices = [];
        $removedIds = [];
        foreach ($existingDevices as $device) {
            $isOwnGenerated = ($device['generatedBy'] ?? null) === 'analytic-circuit'
                && ($device['linkedCircuitId'] ?? null) === $circuitId;
            if ($isOwnGenerated) {
                $removedIds[] = $device['id'];
            } else {
                $keptDevices[] = $device;
            }
        }

        $newDevices = [];
        foreach ($points as $index => $point) {
            $newDevices[] = [
                'id' => (string) Str::uuid(),
                'type' => $deviceType,
                'x' => $point['x'],
                'y' => $point['y'],
                'label' => $defaults['label'].'-'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                'mountingHeight' => $defaults['mountingHeight'],
                'roomId' => $validated['source_room_id'],
                'generatedBy' => 'analytic-circuit',
                'linkedCircuitId' => $circuitId,
                'connectedDeviceIds' => [],
                'properties' => $defaults['properties'],
            ];
        }

        $data['scenes'][$sceneIndex]['electricalDevices'] = [...$keptDevices, ...$newDevices];

        // Conductores rectos tablero→tomacorriente (Fase D.3): solo si hay un
        // ElectricalDevice YA ubicado en esta misma escena vinculado al panel
        // del circuito (linkedAnalyticPanelId, Fase D.1). Sin panel ubicado,
        // solo se generan los tomacorrientes.
        $conductors = $data['scenes'][$sceneIndex]['conductors'] ?? [];
        $conductors = array_values(array_filter(
            $conductors,
            fn ($c) => ! in_array($c['sourceId'] ?? null, $removedIds, true)
                && ! in_array($c['targetId'] ?? null, $removedIds, true),
        ));

        $conductorsCreated = 0;
        $panelId = $validated['panel_id'] ?? null;
        if ($panelId) {
            $panelDevice = collect($keptDevices)->first(
                fn ($d) => ($d['linkedAnalyticPanelId'] ?? null) === $panelId,
            );
            if ($panelDevice) {
                $conductorDefaults = CadElectricalBridgeService::conductorDefaults();
                foreach ($newDevices as $device) {
                    $conductors[] = array_merge($conductorDefaults, [
                        'id' => (string) Str::uuid(),
                        'sourceId' => $panelDevice['id'],
                        'targetId' => $device['id'],
                        'waypoints' => [],
                    ]);
                    $conductorsCreated++;
                }
            }
        }
        $data['scenes'][$sceneIndex]['conductors'] = $conductors;

        $dialuxProject->update(['data' => $data]);

        $message = "Se generaron {$defaults['label']} × ".count($newDevices).' tomacorriente(s) en el plano';
        $message .= $conductorsCreated > 0
            ? ", con {$conductorsCreated} cable(s) al tablero vinculado."
            : ' (sin tablero vinculado en este nivel — solo los tomacorrientes).';

        return response()->json([
            'message' => $message,
            'createdCount' => count($newDevices),
            'conductorsCreated' => $conductorsCreated,
            'sceneId' => $data['scenes'][$sceneIndex]['id'] ?? null,
        ]);
    }

    /**
     * Puente TD/TG (Fase D.1): ubica (o renombra, si ya existe) el símbolo
     * de un Panel analítico en el plano CAD. El Panel NUNCA tiene x/y propio
     * (confirmado: es un nodo abstracto de árbol code/name/parentPanelId,
     * sin geometría en ningún punto del Módulo Eléctrico) -- se coloca en el
     * centro del bounding box de los rooms de la escena destino (o (0,0) si
     * la escena no tiene rooms todavía) como punto de partida; el usuario lo
     * arrastra a su posición real en el editor de plano.
     *
     * Idempotente por `panel_id`: si ya existe un `ElectricalDevice` con ese
     * `linkedAnalyticPanelId` en CUALQUIER escena, solo se renombra (no se
     * duplica ni se mueve de escena).
     */
    public function placePanel(PlacePanelRequest $request, DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $validated = $request->validated();
        $data = $dialuxProject->data;

        if (! is_array($data) || empty($data['scenes'])) {
            return response()->json(['message' => 'El proyecto no tiene un plano CAD todavía.'], 422);
        }

        $panelId = $validated['panel_id'];

        // Ya ubicado en algún nivel -- solo renombrar, no duplicar.
        foreach ($data['scenes'] as $sIdx => $scene) {
            foreach ($scene['electricalDevices'] ?? [] as $dIdx => $device) {
                if (($device['linkedAnalyticPanelId'] ?? null) === $panelId) {
                    $data['scenes'][$sIdx]['electricalDevices'][$dIdx]['label'] = $validated['code'];
                    $dialuxProject->update(['data' => $data]);

                    return response()->json([
                        'message' => "\"{$validated['code']}\" ya estaba ubicado en el plano (nivel \"{$scene['name']}\") — se actualizó su etiqueta.",
                        'sceneId' => $scene['id'] ?? null,
                        'created' => false,
                    ]);
                }
            }
        }

        // Nivel destino: por floor_level (ElectricalFloor.level == floorIndex+1,
        // mismo criterio que importRoomsFromCad) o el primero disponible.
        $targetSceneIndex = 0;
        if (! empty($validated['floor_level'])) {
            foreach ($data['scenes'] as $sIdx => $scene) {
                if ((($scene['floorIndex'] ?? 0) + 1) === $validated['floor_level']) {
                    $targetSceneIndex = $sIdx;
                    break;
                }
            }
        }

        $roomPolygons = array_map(
            fn ($room) => $room['vertices'] ?? [],
            $data['scenes'][$targetSceneIndex]['rooms'] ?? [],
        );
        $center = CadElectricalBridgeService::boundingBoxCenter($roomPolygons) ?? ['x' => 0.0, 'y' => 0.0];

        $deviceType = $validated['is_root'] ? 'main_panel' : 'sub_panel';
        $defaults = CadElectricalBridgeService::panelDeviceDefaults($validated['is_root']);

        $device = [
            'id' => (string) Str::uuid(),
            'type' => $deviceType,
            'x' => $center['x'],
            'y' => $center['y'],
            'label' => $validated['code'],
            'mountingHeight' => $defaults['mountingHeight'],
            'linkedAnalyticPanelId' => $panelId,
            'connectedDeviceIds' => [],
            'properties' => $defaults['properties'],
        ];

        $data['scenes'][$targetSceneIndex]['electricalDevices'] = [
            ...($data['scenes'][$targetSceneIndex]['electricalDevices'] ?? []),
            $device,
        ];

        $dialuxProject->update(['data' => $data]);

        return response()->json([
            'message' => "\"{$validated['code']}\" se ubicó en el nivel \"{$data['scenes'][$targetSceneIndex]['name']}\" — ábrelo en el editor de plano para moverlo a su posición real.",
            'sceneId' => $data['scenes'][$targetSceneIndex]['id'] ?? null,
            'created' => true,
        ]);
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
