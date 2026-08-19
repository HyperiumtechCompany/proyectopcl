import React from 'react';
import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import {
    connectedCircuitConductorIds,
    panelBoundaryIds,
} from '@/pages/dialux/hooks/conductorCircuitGroups';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    ConductorProps,
    ElectricalDeviceProps,
    LightSwitchProps,
    VirtualWireProps,
} from './properties/ElectricalProps';
import { FixtureProps } from './properties/FixtureProps';
import { ArrangementProps } from './properties/ArrangementProps';
import { CanopyProps, DoorProps, WindowProps } from './properties/OpeningProps';
import { PartitionProps } from './properties/PartitionProps';
import { RoomProps } from './properties/RoomProps';
import { StructuralObstacleProps } from './properties/StructuralObstacleProps';
import { WallProps } from './properties/WallProps';

export const PropertiesPanel = React.memo(function PropertiesPanel() {
    const store = useEditorStore();
    const scene = store.activeScene();
    const initialSelectedId = store.ui.selectedId;
    let selectedId = initialSelectedId;
    if (initialSelectedId && scene) {
        const clickedFixture = scene.fixtures.find(f => f.id === initialSelectedId);
        if (clickedFixture?.arrangementId) {
            selectedId = clickedFixture.arrangementId;
        }
    }
    const selectedFixtureIds = store.ui.selectedFixtureIds;

    if (!selectedId && selectedFixtureIds.length === 0) {
        return (
            <div className="px-2 py-6 text-center">
                <p className="text-[10px] text-slate-400 dark:text-gray-500">
                    Selecciona un objeto para ver sus propiedades
                </p>
            </div>
        );
    }

    if (selectedId?.startsWith('wire:dev-') && scene) {
        const [, , sourceId, targetId] = selectedId.split(':');
        const device = scene.electricalDevices?.find((d) => d.id === sourceId);
        if (device) {
            return (
                <VirtualWireProps
                    wireId={selectedId}
                    device={device}
                    onUpdate={(patch) => {
                        store.updateElectricalDevice(device.id, {
                            wireProps: {
                                ...(device.wireProps ?? {}),
                                [selectedId]: {
                                    ...(device.wireProps?.[selectedId] ?? {
                                        wireCount: selectedId.includes(
                                            'dev-dev',
                                        )
                                            ? 3
                                            : 2,
                                        routeType: selectedId.includes('dev-sw')
                                            ? 'wall_ceiling'
                                            : 'floor',
                                        tubeSize: 20,
                                        conductorType: 'THW-90',
                                        sectionMm2: 2.5,
                                    }),
                                    ...patch,
                                },
                            },
                        });
                    }}
                    onDelete={() => store.removeObject(selectedId)}
                />
            );
        }
    }

    if (selectedFixtureIds.length > 1 && scene) {
        const firstFixture = scene.fixtures.find(
            (f) => f.id === selectedFixtureIds[0],
        );
        if (firstFixture) {
            return (
                <FixtureProps
                    fixture={firstFixture}
                    onUpdate={(patch) =>
                        store.updateFixtures(selectedFixtureIds, patch)
                    }
                    multiple={true}
                    count={selectedFixtureIds.length}
                />
            );
        }
    }

    const room = scene?.rooms.find((r) => r.id === selectedId);
    const wall = scene?.walls.find((w) => w.id === selectedId);
    const win = scene?.windows.find((w) => w.id === selectedId);
    const door = scene?.doors.find((d) => d.id === selectedId);
    const canopy = scene?.canopies.find((c) => c.id === selectedId);
    const arrangement = scene?.fixtureArrangements?.find((a) => a.id === selectedId);
    const fixture = scene?.fixtures.find((f) => f.id === selectedId);
    const partition = scene?.partitions?.find((p) => p.id === selectedId);
    const structuralObstacle = scene?.structuralObstacles?.find(
        (o) => o.id === selectedId,
    );
    const lightSwitch = scene?.lightSwitches?.find((s) => s.id === selectedId);
    const conductor = scene?.conductors?.find((c) => c.id === selectedId);
    const electricalDevice = scene?.electricalDevices?.find(
        (d) => d.id === selectedId,
    );

    if (electricalDevice) {
        return (
            <ElectricalDeviceProps
                device={electricalDevice}
                onUpdate={(patch) =>
                    store.updateElectricalDevice(electricalDevice.id, patch)
                }
            />
        );
    }

    if (conductor) {
        const circuitConductorIds = connectedCircuitConductorIds(
            scene?.conductors ?? [],
            conductor.id,
            panelBoundaryIds(scene?.electricalDevices),
        );
        return (
            <ConductorProps
                conductor={conductor}
                circuitCount={circuitConductorIds.length}
                circuitConductorIds={circuitConductorIds}
                onUpdate={(patch) => {
                    store.beginHistoryGesture();
                    circuitConductorIds.forEach((id) => {
                        const targetConductor = scene?.conductors?.find(
                            (c) => c.id === id,
                        );
                        if (!targetConductor) return;

                        const finalPatch = { ...patch };

                        // Inteligencia de grupo: si estamos cambiando la cantidad de conductores,
                        // solo lo aplicamos a otros tramos que compartían nuestra misma cantidad original.
                        // (Ej: Si edito la línea principal de 3 a 4, no quiero que mis bajadas a
                        // interruptor que son de 2 se conviertan en 4).
                        if ('wireCount' in patch) {
                            if (
                                targetConductor.wireCount !==
                                conductor.wireCount
                            ) {
                                delete finalPatch.wireCount;
                                delete finalPatch.wireLabel;
                            }
                        }

                        if (Object.keys(finalPatch).length > 0) {
                            store.updateConductor(id, finalPatch);
                        }
                    });
                    store.endHistoryGesture();
                }}
                onUpdateIndividual={(patch) => {
                    store.updateConductor(conductor.id, patch);
                }}
                onDelete={() => store.removeObject(conductor.id)}
                onDeleteGroup={() => {
                    store.beginHistoryGesture();
                    circuitConductorIds.forEach((id) => store.removeObject(id));
                    store.endHistoryGesture();
                    store.setSelectedId(null);
                }}
            />
        );
    }

    if (partition) {
        return (
            <PartitionProps
                partition={partition}
                onUpdate={(patch) => store.updatePartition(partition.id, patch)}
            />
        );
    }

    if (structuralObstacle) {
        return (
            <StructuralObstacleProps
                obstacle={structuralObstacle}
                onUpdate={(patch) =>
                    store.updateStructuralObstacle(structuralObstacle.id, patch)
                }
            />
        );
    }

    if (lightSwitch) {
        return (
            <LightSwitchProps
                lightSwitch={lightSwitch}
                onUpdate={(patch) =>
                    store.updateLightSwitch(lightSwitch.id, patch)
                }
            />
        );
    }

    if (room) {
        const corridorAmbient =
            room.roomType === 'corridor'
                ? (deriveSceneAmbientSpaces(scene!).find(
                      (ambient) => ambient.sourceRoom.id === room.id,
                  ) ?? null)
                : null;
        const parentRoom = corridorAmbient
            ? (scene!.rooms.find(
                  (candidate) => candidate.id === corridorAmbient.roomId,
              ) ?? null)
            : null;

        return (
            <RoomProps
                room={room}
                scene={scene!}
                parentRoom={parentRoom}
                selectedAmbient={corridorAmbient}
                onUpdate={(patch) => store.updateRoom(room.id, patch)}
            />
        );
    }

    if (wall) {
        return (
            <WallProps
                wall={wall}
                scene={scene}
                onUpdate={(patch) => store.updateWall(wall.id, patch)}
                onUpdateRoom={(roomId, patch) =>
                    store.updateRoom(roomId, patch)
                }
            />
        );
    }

    if (win) {
        return (
            <WindowProps
                win={win}
                onUpdate={(patch) => store.updateWindow(win.id, patch)}
                onCenter={() => store.centerWindowOnWall(win.id)}
            />
        );
    }

    if (door) {
        return (
            <DoorProps
                door={door}
                onUpdate={(patch) => store.updateDoor(door.id, patch)}
                onCenter={() => store.centerDoorOnWall(door.id)}
            />
        );
    }

    if (canopy) {
        return (
            <CanopyProps
                canopy={canopy}
                onUpdate={(patch) => store.updateCanopy(canopy.id, patch)}
            />
        );
    }

    if (arrangement) {
        return <ArrangementProps arrangement={arrangement} />;
    }

    if (fixture) {
        return (
            <FixtureProps
                fixture={fixture}
                onUpdate={(patch) => store.updateFixture(fixture.id, patch)}
                multiple={false}
                count={1}
            />
        );
    }

    return (
        <p className="text-[10px] text-slate-400 dark:text-gray-500">
            Objeto no encontrado
        </p>
    );
});
