import { v4 as uuidv4 } from 'uuid';
import {
    buildFixtureGridObjects,
    calculateCenteredOffsetOnWall,
} from '../fixtureGrid';
import { buildDefaultStairConfig } from '../stairNorms';
import { mutateScene, normalizeWallPatch, normalizeWallState } from '../storeHelpers';
import type {
    Canopy,
    Conductor,
    Door,
    ElectricalDevice,
    ElectricalDeviceProperties,
    ElectricalDeviceType,
    Fixture,
    FixtureGridConfig,
    JunctionBox,
    LightSwitch,
    Partition,
    Room,
    Vertex,
    Wall,
    Window,
} from '../types';
import type { EditorSlice } from './sliceTypes';

export interface SceneObjectsSlice {
    addRoom: (room: Omit<Room, 'id'>) => string;
    addWall: (wall: Omit<Wall, 'id'>) => string;
    addWindow: (win: Omit<Window, 'id'>) => string;
    addDoor: (door: Omit<Door, 'id'>) => string;
    addCanopy: (can: Omit<Canopy, 'id'>) => string;
    addFixture: (fix: Omit<Fixture, 'id'>) => string;
    /** Genera una grilla de focos N×M centrada en el room indicado */
    addFixtureGrid: (config: FixtureGridConfig) => string[];
    addPartition: (partition: Omit<Partition, 'id'>) => string;
    addLightSwitch: (lightSwitch: Omit<LightSwitch, 'id' | 'connectedFixtureIds'>) => string;
    addConductor: (conductor: Omit<Conductor, 'id'>) => string;
    addJunctionBox: (box: Omit<JunctionBox, 'id'>) => string;
    addElectricalDevice: (device: Omit<ElectricalDevice, 'id'>) => string;
    replaceGeneratedOutletsForRoom: (roomId: string, devices: Array<Omit<ElectricalDevice, 'id'>>) => string[];
    updateGeneratedOutletsForRoom: (roomId: string, patch: Partial<Omit<ElectricalDevice, 'id'>>) => void;
    removeGeneratedOutletsForRoom: (roomId: string) => void;

    updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void;
    updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void;
    updateWindow: (id: string, patch: Partial<Omit<Window, 'id'>>) => void;
    updateDoor: (id: string, patch: Partial<Omit<Door, 'id'>>) => void;
    updateCanopy: (id: string, patch: Partial<Omit<Canopy, 'id'>>) => void;
    updateFixture: (id: string, patch: Partial<Omit<Fixture, 'id'>>) => void;
    updateFixtures: (ids: string[], patch: Partial<Omit<Fixture, 'id'>>) => void;
    updatePartition: (id: string, patch: Partial<Omit<Partition, 'id'>>) => void;
    updateLightSwitch: (id: string, patch: Partial<Omit<LightSwitch, 'id'>>) => void;
    updateConductor: (id: string, patch: Partial<Omit<Conductor, 'id'>>) => void;
    updateJunctionBox: (id: string, patch: Partial<Omit<JunctionBox, 'id'>>) => void;
    updateElectricalDevice: (id: string, patch: Partial<Omit<ElectricalDevice, 'id'>>) => void;
    setElectricalDeviceTemplate: (
        type: ElectricalDeviceType,
        label?: string,
        properties?: Partial<ElectricalDeviceProperties>,
    ) => void;

    /** Reposiciona una ventana al centro de su pared */
    centerWindowOnWall: (windowId: string) => void;
    /** Reposiciona una puerta al centro de su pared */
    centerDoorOnWall: (doorId: string) => void;
    /** Mueve un fixture al centroide de su room */
    centerFixtureInRoom: (fixtureId: string) => void;

    removeObject: (id: string) => void;
}

export const createSceneObjectsSlice: EditorSlice<SceneObjectsSlice> = (set, get) => ({
    addRoom: (roomData) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;

            // Generar stairConfig por defecto para escaleras
            const activeScene = state.activeScene();
            const floorHeight = activeScene?.floorHeight ?? 3.0;
            const stairConfig =
                roomData.roomType === 'stair' && !roomData.stairConfig
                    ? buildDefaultStairConfig('housing', floorHeight)
                    : roomData.stairConfig;

            const room: Room = {
                illuminanceLux: 500,
                fixtureLumens: 4000,
                norma: 500,
                fixtureFlux: 4000,
                normativeStandard:
                    roomData.normativeStandard ??
                    state.defaultRoomNormativeStandard ??
                    'en_12464',
                ...roomData,
                id,
                stairConfig,
            };
            return mutateScene(state, (s) => ({
                ...s,
                rooms: [...s.rooms, room],
            }));
        });
        return id;
    },

    addWall: (wallData) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;
            const wall = normalizeWallState({ ...wallData, id });
            return mutateScene(state, (s) => ({
                ...s,
                walls: [...s.walls, wall],
            }));
        });
        return id;
    },

    addWindow: (winData) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;

            // Aplicar dimensiones predeterminadas de baño si corresponde
            let finalData = { ...winData };
            if (winData.windowType === 'bathroom') {
                finalData = {
                    ...finalData,
                    width: winData.width ?? 0.6,
                    height: winData.height ?? 0.4,
                    sillHeight: winData.sillHeight ?? 1.5,
                };
            }

            let win = { id, ...finalData };
            // Solo centramos si se especifica explicitamente (botón "Centrar en Pared")
            if (win.centered === true) {
                const scene = state.activeScene();
                const wall = scene?.walls.find((w) => w.id === win.wallId);
                if (wall) {
                    win = {
                        ...win,
                        offsetAlongWall: calculateCenteredOffsetOnWall(
                            wall,
                            win.width,
                        ),
                        centered: true,
                    };
                }
            }
            return mutateScene(state, (s) => ({
                ...s,
                windows: [...s.windows, win],
            }));
        });
        return id;
    },

    addDoor: (doorData) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;
            let door = { id, ...doorData };
            // Solo centramos si se especifica explicitamente (botón "Centrar en Pared")
            if (door.centered === true) {
                const scene = state.activeScene();
                const wall = scene?.walls.find((w) => w.id === door.wallId);
                if (wall) {
                    door = {
                        ...door,
                        offsetAlongWall: calculateCenteredOffsetOnWall(
                            wall,
                            door.width,
                        ),
                        centered: true,
                    };
                }
            }
            return mutateScene(state, (s) => ({
                ...s,
                doors: [...s.doors, door],
            }));
        });
        return id;
    },

    addCanopy: (canData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      canopies: [...sc.canopies, { id, ...canData }],
                  })),
        );
        return id;
    },
    addFixture: (fixtureData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      fixtures: [...sc.fixtures, { id, ...fixtureData }],
                  })),
        );
        return id;
    },

    addFixtureGrid: (config) => {
        const scene = get().activeScene();
        if (!scene) return [];

        let vertices: Vertex[];
        if (config.roomId) {
            const room = scene.rooms.find((r) => r.id === config.roomId);
            if (!room) return [];
            vertices = config.ambientVertices ?? room.vertices;
        } else {
            if (!config.ambientVertices || config.ambientVertices.length < 3) return [];
            vertices = config.ambientVertices;
        }
        const fixtureData = buildFixtureGridObjects(
            config,
            vertices,
            uuidv4,
        );
        const ids: string[] = [];

        set((state) => {
            if (!state.project || !state.activeSceneId) return state;
            const newFixtures = fixtureData.map((fd) => {
                const id = uuidv4();
                ids.push(id);
                return { id, ...fd };
            });
            return mutateScene(state, (s) => ({
                ...s,
                fixtures: [...s.fixtures, ...newFixtures],
            }));
        });
        return ids;
    },

    // ── Updaters ──────────────────────────────────────────────────────────
    updateRoom: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                rooms: sc.rooms.map((r) =>
                    r.id === id ? { ...r, ...patch } : r,
                ),
            })),
        ),
    updateWall: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                walls: sc.walls.map((w) =>
                    w.id === id ? normalizeWallPatch(w, patch) : w,
                ),
            })),
        ),
    updateWindow: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                windows: sc.windows.map((w) =>
                    w.id === id ? { ...w, ...patch } : w,
                ),
            })),
        ),
    updateDoor: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                doors: sc.doors.map((d) =>
                    d.id === id ? { ...d, ...patch } : d,
                ),
            })),
        ),
    updateCanopy: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                canopies: sc.canopies.map((c) =>
                    c.id === id ? { ...c, ...patch } : c,
                ),
            })),
        ),
    updateFixture: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                fixtures: sc.fixtures.map((f) =>
                    f.id === id ? { ...f, ...patch } : f,
                ),
            })),
        ),
    updateFixtures: (ids, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                fixtures: sc.fixtures.map((f) =>
                    ids.includes(f.id) ? { ...f, ...patch } : f,
                ),
            })),
        ),

    centerWindowOnWall: (windowId) =>
        set((state) => {
            const scene = state.activeScene();
            if (!scene) return state;
            const win = scene.windows.find((w) => w.id === windowId);
            if (!win) return state;
            const wall = scene.walls.find((w) => w.id === win.wallId);
            if (!wall) return state;
            const offset = calculateCenteredOffsetOnWall(wall, win.width);
            return mutateScene(state, (s) => ({
                ...s,
                windows: s.windows.map((w) =>
                    w.id === windowId
                        ? { ...w, offsetAlongWall: offset, centered: true }
                        : w,
                ),
            }));
        }),

    centerDoorOnWall: (doorId) =>
        set((state) => {
            const scene = state.activeScene();
            if (!scene) return state;
            const door = scene.doors.find((d) => d.id === doorId);
            if (!door) return state;
            const wall = scene.walls.find((w) => w.id === door.wallId);
            if (!wall) return state;
            const offset = calculateCenteredOffsetOnWall(wall, door.width);
            return mutateScene(state, (s) => ({
                ...s,
                doors: s.doors.map((d) =>
                    d.id === doorId
                        ? { ...d, offsetAlongWall: offset, centered: true }
                        : d,
                ),
            }));
        }),

    centerFixtureInRoom: (fixtureId) =>
        set((state) => {
            const scene = state.activeScene();
            if (!scene) return state;
            const fix = scene.fixtures.find((f) => f.id === fixtureId);
            if (!fix || !fix.roomId) return state;
            const room = scene.rooms.find(
                (r) => r.id === fix.roomId || fix.roomId?.startsWith(r.id),
            );
            if (!room || room.vertices.length < 3) return state;
            const xs = room.vertices.map((v) => v.x);
            const ys = room.vertices.map((v) => v.y);
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            return mutateScene(state, (s) => ({
                ...s,
                fixtures: s.fixtures.map((f) =>
                    f.id === fixtureId ? { ...f, x: cx, y: cy } : f,
                ),
            }));
        }),

    addPartition: (partitionData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      partitions: [...(sc.partitions ?? []), { id, ...partitionData }],
                  })),
        );
        return id;
    },

    updatePartition: (id, patch) =>
        set((s) =>
            mutateScene(s, (sc) => ({
                ...sc,
                partitions: (sc.partitions ?? []).map((p) =>
                    p.id === id ? { ...p, ...patch } : p,
                ),
            })),
        ),

    addLightSwitch: (lightSwitchData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      lightSwitches: [...(sc.lightSwitches || []), { id, connectedFixtureIds: [], ...lightSwitchData } as any],
                  })),
        );
        return id;
    },

    updateLightSwitch: (id, patch) => {
        set((s) => {
            if (!s.project || !s.activeSceneId) return s;
            return mutateScene(s, (sc) => {
                const lsArray = sc.lightSwitches || [];
                const idx = lsArray.findIndex((x) => x.id === id);
                if (idx < 0) return sc;
                const updated = [...lsArray];
                updated[idx] = { ...updated[idx], ...patch };
                return { ...sc, lightSwitches: updated };
            });
        });
    },

    addConductor: (conductorData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      conductors: [...(sc.conductors ?? []), { id, ...conductorData }],
                  })),
        );
        return id;
    },

    updateConductor: (id, patch) => {
        set((s) => {
            if (!s.project || !s.activeSceneId) return s;
            return mutateScene(s, (sc) => {
                const arr = sc.conductors ?? [];
                const idx = arr.findIndex((x) => x.id === id);
                if (idx < 0) return sc;
                const updated = [...arr];
                updated[idx] = { ...updated[idx], ...patch };
                return { ...sc, conductors: updated };
            });
        });
    },

    addJunctionBox: (boxData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      junctionBoxes: [...(sc.junctionBoxes ?? []), { id, ...boxData }],
                  })),
        );
        return id;
    },

    updateJunctionBox: (id, patch) => {
        set((s) => {
            if (!s.project || !s.activeSceneId) return s;
            return mutateScene(s, (sc) => {
                const arr = sc.junctionBoxes ?? [];
                const idx = arr.findIndex((x) => x.id === id);
                if (idx < 0) return sc;
                const updated = [...arr];
                updated[idx] = { ...updated[idx], ...patch };
                return { ...sc, junctionBoxes: updated };
            });
        });
    },

    addElectricalDevice: (deviceData) => {
        const id = uuidv4();
        set((s) =>
            !s.project || !s.activeSceneId
                ? s
                : mutateScene(s, (sc) => ({
                      ...sc,
                      electricalDevices: [
                          ...(sc.electricalDevices ?? []),
                          { id, ...deviceData },
                      ],
                  })),
        );
        return id;
    },

    replaceGeneratedOutletsForRoom: (roomId, deviceData) => {
        const ids = deviceData.map(() => uuidv4());
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;
            return mutateScene(state, (scene) => {
                const removedIds = new Set((scene.electricalDevices ?? [])
                    .filter((device) => device.generatedBy === 'outlet-rule' && device.roomId === roomId)
                    .map((device) => device.id));
                return {
                    ...scene,
                    electricalDevices: [
                        ...(scene.electricalDevices ?? []).filter((device) => !removedIds.has(device.id)),
                        ...deviceData.map((device, index) => ({ ...device, roomId, generatedBy: 'outlet-rule' as const, id: ids[index] })),
                    ],
                    conductors: (scene.conductors ?? []).filter(
                        (conductor) => !removedIds.has(conductor.sourceId) && !removedIds.has(conductor.targetId),
                    ),
                };
            });
        });
        return ids;
    },

    updateGeneratedOutletsForRoom: (roomId, patch) =>
        set((state) => !state.project || !state.activeSceneId ? state : mutateScene(state, (scene) => ({
            ...scene,
            electricalDevices: (scene.electricalDevices ?? []).map((device) =>
                device.generatedBy === 'outlet-rule' && device.roomId === roomId
                    ? { ...device, ...patch, roomId, generatedBy: 'outlet-rule' }
                    : device,
            ),
        }))),

    removeGeneratedOutletsForRoom: (roomId) =>
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;
            return mutateScene(state, (scene) => {
                const removedIds = new Set((scene.electricalDevices ?? [])
                    .filter((device) => device.generatedBy === 'outlet-rule' && device.roomId === roomId)
                    .map((device) => device.id));
                return {
                    ...scene,
                    electricalDevices: (scene.electricalDevices ?? []).filter((device) => !removedIds.has(device.id)),
                    conductors: (scene.conductors ?? []).filter(
                        (conductor) => !removedIds.has(conductor.sourceId) && !removedIds.has(conductor.targetId),
                    ),
                };
            });
        }),

    updateElectricalDevice: (id, patch) => {
        set((s) => {
            if (!s.project || !s.activeSceneId) return s;
            return mutateScene(s, (sc) => {
                const arr = sc.electricalDevices ?? [];
                const idx = arr.findIndex((x) => x.id === id);
                if (idx < 0) return sc;
                const updated = [...arr];
                updated[idx] = { ...updated[idx], ...patch };
                return { ...sc, electricalDevices: updated };
            });
        });
    },

    setElectricalDeviceTemplate: (type, label, properties) =>
        set((s) => ({ ui: { ...s.ui, electricalDeviceTemplate: { type, label, properties } } })),

    // ── Remover ───────────────────────────────────────────────────────────
    removeObject: (id) => {
        set((state) => {
            if (!state.project || !state.activeSceneId) return state;
            const updated = mutateScene(state, (s) => {
                // Find what we're deleting for cascade logic
                const conductorToRemove = (s.conductors ?? []).find((c) => c.id === id);
                const isSwitchId = (s.lightSwitches || []).some((ls) => ls.id === id);
                const isDeviceId = (s.electricalDevices || []).some((ed) => ed.id === id);
                const isFixtureId = (s.fixtures || []).some((f) => f.id === id);

                // lightSwitches: remove target; if deleting a conductor also clear its switch's fixtureIds
                let lightSwitches = (s.lightSwitches || []).filter((ls) => ls.id !== id);
                let electricalDevices = (s.electricalDevices || []).filter((ed) => ed.id !== id);

                if (conductorToRemove) {
                    const { sourceId, targetId } = conductorToRemove;
                    lightSwitches = lightSwitches.map((ls) =>
                        ls.id === sourceId || ls.id === targetId
                            ? { ...ls, connectedFixtureIds: (ls.connectedFixtureIds || []).filter(fid => fid !== sourceId && fid !== targetId) }
                            : ls
                    );
                    electricalDevices = electricalDevices.map((ed) =>
                        ed.id === sourceId || ed.id === targetId
                            ? { ...ed, connectedFixtureIds: (ed.connectedFixtureIds || []).filter(fid => fid !== sourceId && fid !== targetId) }
                            : ed
                    );
                }

                // conductors: remove target; if deleting a node also remove its conductors
                const conductors = (s.conductors ?? []).filter(
                    (c) => c.id !== id &&
                           !(isSwitchId && (c.sourceId === id || c.targetId === id)) &&
                           !(isDeviceId && (c.sourceId === id || c.targetId === id)) &&
                           !(isFixtureId && (c.sourceId === id || c.targetId === id))
                );

                // handle virtual wire segments deletion
                if (id.startsWith('wire:dev-')) {
                    const parts = id.split(':');
                    const type = parts[1]; // dev-fix, dev-sw, dev-dev
                    const devId = parts[2];
                    const targetId = parts[3];

                    electricalDevices = electricalDevices.map((ed) => {
                        if (ed.id !== devId) return ed;
                        if (type === 'dev-fix') {
                            return { ...ed, connectedFixtureIds: (ed.connectedFixtureIds ?? []).filter(fid => fid !== targetId) };
                        }
                        if (type === 'dev-sw') {
                            return { ...ed, connectedSwitchIds: (ed.connectedSwitchIds ?? []).filter(sid => sid !== targetId) };
                        }
                        if (type === 'dev-dev') {
                            return { ...ed, connectedDeviceIds: (ed.connectedDeviceIds ?? []).filter(did => did !== targetId) };
                        }
                        return ed;
                    });
                }

                return {
                    ...s,
                    rooms: (s.rooms || []).filter((r) => r.id !== id),
                    walls: (s.walls || []).filter((w) => w.id !== id),
                    windows: (s.windows || []).filter(
                        (w) => w.id !== id && w.wallId !== id,
                    ),
                    doors: (s.doors || []).filter(
                        (d) => d.id !== id && d.wallId !== id && d.partitionId !== id,
                    ),
                    canopies: (s.canopies || []).filter((c) => c.id !== id),
                    fixtures: (s.fixtures || []).filter((f) => f.id !== id),
                    lightSwitches,
                    partitions: (s.partitions ?? []).filter((p) => p.id !== id),
                    conductors,
                    junctionBoxes: (s.junctionBoxes ?? []).filter((jb) => jb.id !== id),
                    electricalDevices,
                };
            });
            return {
                ...updated,
                ui: {
                    ...state.ui,
                    selectedId:
                        state.ui.selectedId === id
                            ? null
                            : state.ui.selectedId,
                    selectedFixtureIds: state.ui.selectedFixtureIds.filter(fid => fid !== id),
                },
                result: null,
                resultsByRoom: Object.fromEntries(
                    Object.entries(state.resultsByRoom).filter(
                        ([roomId]) => roomId !== id,
                    ),
                ),
                dxfEntities: state.dxfEntities
                    ? state.dxfEntities.filter((e) => e.id !== id)
                    : null,
            };
        });
    },
});
