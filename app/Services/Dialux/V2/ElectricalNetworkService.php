<?php

namespace App\Services\Dialux\V2;

use App\Models\Dialux\DialuxConductor;
use App\Models\Dialux\DialuxElectricalNetwork;
use App\Models\Dialux\DialuxProject;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ElectricalNetworkService
{
    /** @return Collection<int, DialuxConductor> */
    public function conductorsFor(DialuxProject $project): Collection
    {
        $defaults = DialuxConductor::query()->whereNull('user_id')->orderBy('section_mm2')->get()
            ->keyBy(fn (DialuxConductor $row): string => $row->material.'|'.$row->section_mm2.'|'.$row->insulation);
        DialuxConductor::query()->where('user_id', $project->user_id)->get()->each(
            fn (DialuxConductor $row) => $defaults->put($row->material.'|'.$row->section_mm2.'|'.$row->insulation, $row),
        );

        return $defaults->values();
    }

    /** @param array<string, mixed> $data
     * @return array<int, string>
     */
    public function validateTopology(array $data): array
    {
        $nodes = collect($data['nodes'] ?? [])->keyBy('id');
        $incoming = [];
        $children = [];
        $errors = [];
        if (! isset($data['rootNodeId']) || ! $nodes->has($data['rootNodeId'])) {
            $errors[] = 'La red necesita un origen válido.';
        }
        foreach ($data['edges'] ?? [] as $edge) {
            $source = $edge['sourceNodeId'];
            $target = $edge['targetNodeId'];
            if (! $nodes->has($source) || ! $nodes->has($target)) {
                $errors[] = 'Un alimentador referencia un nodo inexistente.';

                continue;
            }
            if ($source === $target) {
                $errors[] = 'Un equipo no puede alimentarse a sí mismo.';
            }
            $incoming[$target] = ($incoming[$target] ?? 0) + 1;
            $children[$source][] = $target;
        }
        if (collect($incoming)->contains(fn (int $count): bool => $count > 1)) {
            $errors[] = 'Un tablero sólo puede tener un alimentador aguas arriba.';
        }
        $visiting = [];
        $visited = [];
        $walk = function (string $id) use (&$walk, &$visiting, &$visited, $children, &$errors): void {
            if (isset($visiting[$id])) {
                $errors[] = 'La red contiene una conexión circular.';

                return;
            }
            if (isset($visited[$id])) {
                return;
            }
            $visiting[$id] = true;
            foreach ($children[$id] ?? [] as $child) {
                $walk($child);
            }
            unset($visiting[$id]);
            $visited[$id] = true;
        };
        if (isset($data['rootNodeId'])) {
            $walk($data['rootNodeId']);
        }

        return array_values(array_unique($errors));
    }

    /** @return array<string, mixed> */
    public function defaultData(DialuxProject $project): array
    {
        $serviceId = (string) Str::uuid();
        $meterId = (string) Str::uuid();
        $panelId = (string) Str::uuid();

        return [
            'schemaVersion' => 1,
            'rootNodeId' => $serviceId,
            'settings' => [
                'nominalVoltageV' => 380,
                'phases' => 3,
                'connectionType' => 'star',
                'frequencyHz' => 60,
                'conductorMaterial' => 'copper',
                'workingTemperatureC' => 20,
                'defaultPowerFactor' => 0.9,
                'feederDropLimitPercent' => 2.5,
                'totalDropLimitPercent' => 4,
            ],
            'nodes' => [
                ['id' => $serviceId, 'type' => 'service', 'label' => 'Suministro', 'position' => ['x' => 80, 'y' => 220]],
                ['id' => $meterId, 'type' => 'meter', 'label' => 'Medidor', 'position' => ['x' => 320, 'y' => 220]],
                ['id' => $panelId, 'type' => 'main_panel', 'label' => 'TG', 'position' => ['x' => 560, 'y' => 220]],
            ],
            'edges' => [
                $this->defaultEdge((string) Str::uuid(), $serviceId, $meterId),
                $this->defaultEdge((string) Str::uuid(), $meterId, $panelId),
            ],
        ];
    }

    public function networkFor(DialuxProject $project): DialuxElectricalNetwork
    {
        return $project->electricalNetwork()->firstOrCreate([], [
            'version' => 1,
            'data' => $this->defaultData($project),
        ]);
    }

    /** @return Collection<int, array<string, mixed>> */
    public function portsFor(DialuxProject $project): Collection
    {
        return $project->modules()
            ->where('kind', '!=', 'general')
            ->with('electricalProject')
            ->get()
            ->flatMap(function ($module): array {
                $electrical = $module->electricalProject;
                $documentPanels = collect($electrical?->data['panels'] ?? [])->keyBy('id');
                $documentFeeders = collect($electrical?->data['feeders'] ?? [])->keyBy('toPanelId');
                $summaries = collect($electrical?->derived_summary['panels'] ?? [])->keyBy('panelId');
                $ports = collect($module->data['scenes'] ?? [])->flatMap(function (array $scene) use ($module, $documentPanels, $documentFeeders, $summaries): array {
                    $panelDevices = collect($scene['electricalDevices'] ?? [])
                        ->filter(fn (array $device): bool => in_array($device['type'] ?? null, ['main_panel', 'sub_panel'], true))
                        ->values();
                    $panelIds = $panelDevices->pluck('id')->map(fn ($id): string => (string) $id)->flip();
                    $panelById = $panelDevices->keyBy(fn (array $device): string => (string) $device['id']);
                    $panelOrder = $panelDevices->pluck('id')->mapWithKeys(
                        fn ($id, int $index): array => [(string) $id => $index],
                    );
                    $cadParents = [];
                    foreach ($scene['conductors'] ?? [] as $conductor) {
                        $source = (string) ($conductor['sourceId'] ?? '');
                        $target = (string) ($conductor['targetId'] ?? '');
                        if ($panelIds->has($source) && $panelIds->has($target)) {
                            $sourceDevice = $panelById->get($source, []);
                            $targetDevice = $panelById->get($target, []);
                            $sourceUpstream = $sourceDevice['properties']['upstreamPanelId'] ?? null;
                            $targetUpstream = $targetDevice['properties']['upstreamPanelId'] ?? null;
                            if ($sourceUpstream === $target) {
                                $cadParents[$source] = $target;
                            } elseif ($targetUpstream === $source) {
                                $cadParents[$target] = $source;
                            } else {
                                $sourceRank = ($sourceDevice['type'] ?? null) === 'main_panel' ? 0 : (($sourceDevice['properties']['panelRole'] ?? null) === 'sub_distribution' ? 2 : 1);
                                $targetRank = ($targetDevice['type'] ?? null) === 'main_panel' ? 0 : (($targetDevice['properties']['panelRole'] ?? null) === 'sub_distribution' ? 2 : 1);
                                $sourceIsParent = $sourceRank < $targetRank
                                    || ($sourceRank === $targetRank && $panelOrder->get($source, 0) < $panelOrder->get($target, 0));
                                $cadParents[$sourceIsParent ? $target : $source] = $sourceIsParent ? $source : $target;
                            }
                        }
                    }
                    foreach ($panelDevices as $device) {
                        foreach ($device['connectedDeviceIds'] ?? [] as $target) {
                            if ($panelIds->has((string) $target)) {
                                $cadParents[(string) $target] = (string) $device['id'];
                            }
                        }
                    }

                    return $panelDevices
                        ->map(function (array $device) use ($module, $scene, $documentPanels, $documentFeeders, $summaries, $cadParents): array {
                            $properties = $device['properties'] ?? [];
                            $panelId = (string) $device['id'];
                            $panelDefinition = $documentPanels->get($panelId, []);
                            $panelSummary = $summaries->get($panelId, []);
                            $feeder = $documentFeeders->get($panelId, []);

                            return [
                                'key' => "{$module->id}:{$scene['id']}:{$panelId}",
                                'moduleId' => $module->id,
                                'moduleName' => $module->name,
                                'sceneId' => (string) $scene['id'],
                                'sceneName' => $scene['name'] ?? 'Nivel',
                                'panelId' => $panelId,
                                'panelLabel' => $device['label'] ?? ($device['type'] === 'main_panel' ? 'TG' : 'TD'),
                                'parentPanelId' => $panelSummary['parentPanelId']
                                    ?? $panelDefinition['parentPanelId']
                                    ?? $properties['upstreamPanelId']
                                    ?? $cadParents[$panelId]
                                    ?? null,
                                'feederLengthM' => (float) ($panelSummary['feederLengthM'] ?? $feeder['manualLengthM'] ?? $feeder['lengthM'] ?? 0),
                                'panelRole' => $properties['panelRole'] ?? ($device['type'] === 'main_panel' ? 'distribution' : 'sub_distribution'),
                                'nominalVoltageV' => (float) preg_replace('/[^0-9.]/', '', (string) ($properties['voltage'] ?? '220')),
                                'phases' => str_starts_with((string) ($properties['phases'] ?? '1'), '3') ? 3 : 1,
                                'installedPowerW' => (float) ($panelSummary['installedPowerW'] ?? $module->electricalProject?->installed_power_w ?? 0),
                                'demandPowerW' => (float) ($panelSummary['demandPowerW'] ?? $module->electricalProject?->demand_power_w ?? 0),
                                'ownInstalledPowerW' => (float) ($panelSummary['ownInstalledPowerW'] ?? $panelSummary['installedPowerW'] ?? $module->electricalProject?->installed_power_w ?? 0),
                                'ownDemandPowerW' => (float) ($panelSummary['ownDemandPowerW'] ?? $panelSummary['demandPowerW'] ?? $module->electricalProject?->demand_power_w ?? 0),
                                'currentA' => (float) ($panelSummary['currentA'] ?? 0),
                                'mainBreakerA' => (float) ($panelSummary['mainBreakerA'] ?? 0),
                                'circuitsCount' => (int) ($panelSummary['circuitCount'] ?? count($device['connectedDeviceIds'] ?? [])),
                                'revision' => optional($module->updated_at)->toISOString(),
                            ];
                        })->all();
                });

                if ($ports->isNotEmpty()) {
                    return $ports->all();
                }

                $scenes = collect($module->data['scenes'] ?? []);
                $firstScene = $scenes->first();
                if ($summaries->isNotEmpty()) {
                    return $summaries->map(function (array $summary) use ($module, $electrical, $documentPanels, $documentFeeders, $firstScene): array {
                        $panelId = (string) $summary['panelId'];
                        $definition = $documentPanels->get($panelId, []);
                        $feeder = $documentFeeders->get($panelId, []);
                        $sceneId = (string) ($definition['floorId'] ?? $firstScene['id'] ?? 'module');

                        return [
                            'key' => "{$module->id}:{$sceneId}:{$panelId}",
                            'moduleId' => $module->id,
                            'moduleName' => $module->name,
                            'sceneId' => $sceneId,
                            'sceneName' => $firstScene['name'] ?? 'Módulo',
                            'panelId' => $panelId,
                            'panelLabel' => $summary['panelLabel'] ?? $definition['code'] ?? $definition['name'] ?? $panelId,
                            'parentPanelId' => $summary['parentPanelId'] ?? $definition['parentPanelId'] ?? null,
                            'feederLengthM' => (float) ($summary['feederLengthM'] ?? $feeder['manualLengthM'] ?? $feeder['lengthM'] ?? 0),
                            'panelRole' => ($summary['parentPanelId'] ?? $definition['parentPanelId'] ?? null) ? 'sub_distribution' : 'distribution',
                            'nominalVoltageV' => (float) ($definition['voltageV'] ?? $electrical?->voltage_v ?? 220),
                            'phases' => (int) ($definition['phases'] ?? $electrical?->phases ?? 1) === 3 ? 3 : 1,
                            'installedPowerW' => (float) ($summary['installedPowerW'] ?? 0),
                            'demandPowerW' => (float) ($summary['demandPowerW'] ?? 0),
                            'ownInstalledPowerW' => (float) ($summary['ownInstalledPowerW'] ?? $summary['installedPowerW'] ?? 0),
                            'ownDemandPowerW' => (float) ($summary['ownDemandPowerW'] ?? $summary['demandPowerW'] ?? 0),
                            'currentA' => (float) ($summary['currentA'] ?? 0),
                            'mainBreakerA' => (float) ($summary['mainBreakerA'] ?? 0),
                            'circuitsCount' => (int) ($summary['circuitCount'] ?? 0),
                            'revision' => optional($module->updated_at)->toISOString(),
                            'isFallback' => true,
                        ];
                    })->values()->all();
                }
                $summary = $summaries->first() ?? [];
                $hasInternalElectricalData = $scenes->contains(
                    fn (array $scene): bool => count($scene['conductors'] ?? []) > 0 ||
                        count($scene['electricalDevices'] ?? []) > 0 ||
                        count($scene['fixtures'] ?? []) > 0,
                ) || $electrical !== null;

                if (! $hasInternalElectricalData) {
                    return [];
                }

                $sceneId = (string) ($firstScene['id'] ?? 'module');
                $panelId = (string) ($summary['panelId'] ?? "module-input-{$module->id}");

                return [[
                    'key' => "{$module->id}:{$sceneId}:{$panelId}",
                    'moduleId' => $module->id,
                    'moduleName' => $module->name,
                    'sceneId' => $sceneId,
                    'sceneName' => $firstScene['name'] ?? 'Módulo',
                    'panelId' => $panelId,
                    'panelLabel' => "Entrada · {$module->name}",
                    'parentPanelId' => $summary['parentPanelId'] ?? null,
                    'feederLengthM' => (float) ($summary['feederLengthM'] ?? 0),
                    'panelRole' => 'distribution',
                    'nominalVoltageV' => (float) ($electrical?->voltage_v ?? 220),
                    'phases' => (int) ($electrical?->phases ?? 1) === 3 ? 3 : 1,
                    'installedPowerW' => (float) ($summary['installedPowerW'] ?? $electrical?->installed_power_w ?? 0),
                    'demandPowerW' => (float) ($summary['demandPowerW'] ?? $electrical?->demand_power_w ?? 0),
                    'ownInstalledPowerW' => (float) ($summary['ownInstalledPowerW'] ?? $summary['installedPowerW'] ?? $electrical?->installed_power_w ?? 0),
                    'ownDemandPowerW' => (float) ($summary['ownDemandPowerW'] ?? $summary['demandPowerW'] ?? $electrical?->demand_power_w ?? 0),
                    'currentA' => (float) ($summary['currentA'] ?? 0),
                    'mainBreakerA' => (float) ($summary['mainBreakerA'] ?? 0),
                    'circuitsCount' => count($electrical?->data['circuits'] ?? []),
                    'revision' => optional($module->updated_at)->toISOString(),
                    'isFallback' => true,
                ]];
            })->values();
    }

    /** @return array<string, mixed> */
    private function defaultEdge(string $id, string $source, string $target): array
    {
        return [
            'id' => $id, 'sourceNodeId' => $source, 'targetNodeId' => $target,
            'lengthMode' => 'manual', 'horizontalLengthM' => 0, 'verticalLengthM' => 0,
            'conductorType' => 'N2XOH', 'conductorMaterial' => 'copper', 'sectionMm2' => 10,
            'wireConfiguration' => '3F+N+T', 'powerFactor' => 0.9,
        ];
    }
}
