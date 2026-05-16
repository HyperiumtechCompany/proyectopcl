/**
 * useEditorStore.ts — Store global Zustand del editor DIAlux
 *
 * Todos los tipos de dominio viven en ./types.ts.
 * Aquí solo se define el estado reactivo y las mutaciones.
 *
 * Selectors exportados al final del archivo evitan re-renders
 * innecesarios al suscribir solo la slice relevante.
 */

import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

// Re-export todos los tipos para que los consumidores importen desde un solo lugar
export type {
    DrawTool,
    SidebarTab,
    IsoluxMode,
    AngleSnapMode,
    Vertex,
    ScaleConfig,
    Room,
    Wall,
    Window,
    Door,
    Canopy,
    Fixture,
    FixtureGridConfig,
    RoomLightingCalculation,
    ModuleLightingCalculations,
    Scene,
    Project,
    LightingResult,
    DxfEntity,
    DxfExtents,
    DxfLineEntity,
    DxfPolylineEntity,
    DxfCircleEntity,
    DxfArcEntity,
    DxfEllipseEntity,
    DxfTextEntity,
    DxfPointEntity,
    DxfRectangleEntity,
    DxfPolygonEntity,
    DxfHatchEntity,
    DxfSplineEntity,
    DxfSolidEntity,
    ProjectNormativeConfig,
    Partition,
    StairConfig,
    StairFlight,
} from './types';

import {
    buildFixtureGridObjects,
    calculateCenteredOffsetOnWall,
} from './fixtureGrid';
import type { NormativeStandard } from './roomLighting';
import type {
    DrawTool,
    SidebarTab,
    IsoluxMode,
    AngleSnapMode,
    ScaleConfig,
    Room,
    Wall,
    Window,
    Door,
    Canopy,
    Fixture,
    FixtureGridConfig,
    RoomLightingCalculation,
    ModuleLightingCalculations,
    Scene,
    Project,
    LightingResult,
    DxfEntity,
    DxfExtents,
    ProjectNormativeConfig,
    Partition,
} from './types';
import { getPeruWallPreset } from './wallNorms';
import { buildDefaultStairConfig } from './stairNorms';

// ─── UI State ─────────────────────────────────────────────────────────────────

interface UIState {
    activeTool: DrawTool;
    angleSnapMode: AngleSnapMode;
    zoom: number;
    panX: number;
    panY: number;
    show3DView: boolean;
    showRoof: boolean;
    showGrid: boolean;
    showIsolux: boolean;
    isoluxMode: IsoluxMode;
    sidebarTab: SidebarTab;
    selectedId: string | null;
    fixtureTemplate: Partial<Fixture>;
    windowTemplate: Partial<Window>;
    doorTemplate: Partial<Door>;
    /** Configuración de la grilla de focos en el panel de luz */
    fixtureGridRows: number;
    fixtureGridCols: number;
    /** Cuando true, el canvas 2D y 3D muestran todos los pisos visibles superpuestos */
    showAllFloors: boolean;
}

// ─── Estado global ────────────────────────────────────────────────────────────

interface EditorState {
    project: Project | null;
    activeSceneId: string | null;
    isCalculating: boolean;
    result: LightingResult | null;
    resultsByRoom: Record<string, LightingResult>;
    dxfEntities: DxfEntity[] | null;
    dxfExtents: DxfExtents | null;
    ui: UIState;
    defaultRoomNormativeStandard: NormativeStandard;
    /** Configuración normativa del proyecto (síncrona con backend) */
    projectNormativeConfig: ProjectNormativeConfig | null;

    // ── Project ──────────────────────────────────────────────────────────────
    setProject: (project: Project) => void;
    setActiveScene: (sceneId: string) => void;
    setDefaultRoomNormativeStandard: (standard: NormativeStandard) => void;
    applyDefaultNormativeStandardToRooms: () => void;
    setProjectNormativeConfig: (config: ProjectNormativeConfig | null) => void;
    updateComplianceSummary: (summary: ProjectNormativeConfig['complianceSummary']) => void;

    // ── Scale ────────────────────────────────────────────────────────────────
    setScaleConfig: (
        scaleConfig: ScaleConfig,
        rescaleObjects?: boolean,
    ) => void;
    rescaleScene: (ratio: number) => void;
    detectScaleFromExtents: (extents: DxfExtents) => ScaleConfig;
    applyCalibration: (
        cadDistance: number,
        realDistance: number,
    ) => ScaleConfig | null;
    resetCalibration: () => ScaleConfig | null;

    // ── Scene mutations ───────────────────────────────────────────────────────
    addRoom: (room: Omit<Room, 'id'>) => string;
    addWall: (wall: Omit<Wall, 'id'>) => string;
    addWindow: (win: Omit<Window, 'id'>) => string;
    addDoor: (door: Omit<Door, 'id'>) => string;
    addCanopy: (can: Omit<Canopy, 'id'>) => string;
    addFixture: (fix: Omit<Fixture, 'id'>) => string;
    /** Genera una grilla de focos N×M centrada en el room indicado */
    addFixtureGrid: (config: FixtureGridConfig) => string[];
    addPartition: (partition: Omit<Partition, 'id'>) => string;

    updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void;
    updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void;
    updateWindow: (id: string, patch: Partial<Omit<Window, 'id'>>) => void;
    updateDoor: (id: string, patch: Partial<Omit<Door, 'id'>>) => void;
    updateCanopy: (id: string, patch: Partial<Omit<Canopy, 'id'>>) => void;
    updateFixture: (id: string, patch: Partial<Omit<Fixture, 'id'>>) => void;
    updatePartition: (id: string, patch: Partial<Omit<Partition, 'id'>>) => void;

    /** Reposiciona una ventana al centro de su pared */
    centerWindowOnWall: (windowId: string) => void;
    /** Reposiciona una puerta al centro de su pared */
    centerDoorOnWall: (doorId: string) => void;
    /** Mueve un fixture al centroide de su room */
    centerFixtureInRoom: (fixtureId: string) => void;

    removeObject: (id: string) => void;

    // ── UI ───────────────────────────────────────────────────────────────────
    setTool: (tool: DrawTool) => void;
    setAngleSnapMode: (mode: AngleSnapMode) => void;
    setSidebarTab: (tab: SidebarTab) => void;
    setSelectedId: (id: string | null) => void;
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;
    toggle3DView: () => void;
    toggleRoof: () => void;
    toggleGrid: () => void;
    toggleIsolux: () => void;
    setIsoluxMode: (mode: IsoluxMode) => void;
    setFixtureTemplate: (t: Partial<Fixture>) => void;
    setWindowTemplate: (t: Partial<Window>) => void;
    setDoorTemplate: (t: Partial<Door>) => void;
    setFixtureGridRows: (rows: number) => void;
    setFixtureGridCols: (cols: number) => void;

    // ── Calculation & DXF ────────────────────────────────────────────────────
    setCalculating: (val: boolean) => void;
    setResult: (result: LightingResult | null) => void;
    setResultsByRoom: (results: Record<string, LightingResult>) => void;
    setDxfData: (entities: DxfEntity[], extents: DxfExtents) => void;

    // ── Helpers ───────────────────────────────────────────────────────────────
    activeScene: () => Scene | null;
    /** Devuelve todos los pisos ordenados de sótano a planta alta */
    getFloorsSorted: () => Scene[];

    // ── Floor Management ─────────────────────────────────────────────────────
    /** Crea un nuevo piso vacío. Devuelve el ID de la nueva Scene. */
    addFloor: (name: string, floorIndex: number, floorHeight?: number) => string;
    /** Elimina un piso (y cambia activeScene si era el activo) */
    removeFloor: (sceneId: string) => void;
    /**
     * Duplica la geometría de un piso como nuevo piso.
     * Genera IDs nuevos para todos los objetos del piso clonado.
     */
    duplicateFloor: (sourceSceneId: string, newFloorIndex: number, newName: string) => string;
    /** Actualiza propiedades del piso (name, floorHeight, etc.) */
    updateFloor: (sceneId: string, patch: Partial<Pick<Scene, 'name' | 'floorHeight' | 'floorIndex'>>) => void;
    /**
     * Recalcula `floorElevation` de todos los pisos basándose en su
     * `floorIndex` y `floorHeight`. Llamar tras cualquier reordenamiento.
     */
    reorderFloors: () => void;
    /** Alterna la visibilidad de un piso individual en 2D y 3D */
    toggleFloorVisibility: (sceneId: string) => void;
    /** Alterna el modo "ver todos los pisos" superpuestos */
    toggleAllFloors: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()(
    subscribeWithSelector((set, get) => ({
        project: null,
        activeSceneId: null,
        isCalculating: false,
        result: null,
        resultsByRoom: {},
        dxfEntities: null,
        dxfExtents: null,
        defaultRoomNormativeStandard: 'en_12464',
        projectNormativeConfig: null,

        ui: {
            activeTool: 'pan',
            angleSnapMode: 'smart',
            zoom: 1,
            panX: 0,
            panY: 0,
            show3DView: false,
            showRoof: false,
            showGrid: true,
            showIsolux: false,
            isoluxMode: 'functional',
            sidebarTab: 'objects',
            selectedId: null,
            fixtureTemplate: {
                fixtureType: 'recessed',
                fixtureShape: 'round',
                lumens: 4000,
                efficiency: 0.8,
                lightColor: '#fff5e1',
            },
            windowTemplate: {
                windowType: 'fixed',
                windowShape: 'rectangular',
                width: 1.2,
                height: 1.1,
                sillHeight: 0.9,
            },
            doorTemplate: {
                doorType: 'single',
                openingDirection: 'inward',
                openingAngle: 90,
                width: 0.9,
                height: 2.1,
            },
            fixtureGridRows: 2,
            fixtureGridCols: 2,
            showAllFloors: false,
        },

        // ── Project ───────────────────────────────────────────────────────────
        setProject: (project) => set({ project }),
        setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
        setDefaultRoomNormativeStandard: (standard) =>
            set({ defaultRoomNormativeStandard: standard }),
        setProjectNormativeConfig: (config) => set({ projectNormativeConfig: config }),
        updateComplianceSummary: (summary) =>
            set((state) => {
                if (!state.projectNormativeConfig) return state;
                return {
                    projectNormativeConfig: {
                        ...state.projectNormativeConfig,
                        complianceSummary: summary,
                    },
                };
            }),
        applyDefaultNormativeStandardToRooms: () =>
            set((state) => {
                if (!state.project) return state;

                const defaultStandard =
                    state.defaultRoomNormativeStandard ?? 'en_12464';

                return {
                    ...state,
                    project: {
                        ...state.project,
                        scenes: state.project.scenes.map((scene) => ({
                            ...scene,
                            rooms: scene.rooms.map((room) => {
                                if (
                                    (room.normativeStandard ??
                                        defaultStandard) === defaultStandard
                                ) {
                                    return {
                                        ...room,
                                        normativeStandard: defaultStandard,
                                    };
                                }

                                return {
                                    ...room,
                                    normativeStandard: defaultStandard,
                                    normativeCategory: undefined,
                                    normativeSection: undefined,
                                    normativeActivity: undefined,
                                    normativeLabel: undefined,
                                    ugrLimit: undefined,
                                    uniformityTarget: undefined,
                                    colorRenderingRa: undefined,
                                    specificRequirements: undefined,
                                };
                            }),
                        })),
                    },
                };
            }),

        // ── Scale ─────────────────────────────────────────────────────────────
        setScaleConfig: (scaleConfig, rescaleObjects = false) => {
            const normalized = normalizeScaleConfig(scaleConfig);
            set((state) => {
                const scene = state.activeScene();
                if (!scene) return state;

                if (rescaleObjects) {
                    const prevScale = normalizeScaleConfig(scene.scaleConfig);
                    const prevEffective =
                        prevScale.factor * prevScale.calibrationFactor;
                    const nextEffective =
                        normalized.factor * normalized.calibrationFactor;

                    if (
                        prevEffective > 0 &&
                        nextEffective > 0 &&
                        prevEffective !== nextEffective
                    ) {
                        const ratio = nextEffective / prevEffective;
                        // No podemos llamar a rescaleScene aquí directamente sobre 'set' de forma limpia
                        // si queremos usar mutateScene, así que lo hacemos inline o pre-calculamos.
                        return mutateScene(state, (s) => ({
                            ...rescaleSceneEntities(s, ratio),
                            scaleConfig: normalized,
                        }));
                    }
                }

                return mutateScene(state, (s) => ({
                    ...s,
                    scaleConfig: normalized,
                }));
            });
        },

        rescaleScene: (ratio) => {
            if (!(ratio > 0) || ratio === 1) return;
            set((state) =>
                mutateScene(state, (s) => rescaleSceneEntities(s, ratio)),
            );
        },
        detectScaleFromExtents: (extents) => {
            // Un archivo DXF de una casa promedio en metros (ej. 20x20)
            // tendrá extents de min=0 max=20.
            // Si está en milímetros tendrá min=0 max=20000.
            const w = extents.max_x - extents.min_x;
            const h = extents.max_y - extents.min_y;
            const maxDim = Math.max(w, h);

            if (maxDim > 1000) {
                // Probablemente milímetros
                return createScaleConfig('mm', 0.001, 'Milímetros (1000 = 1m)');
            } else if (maxDim > 100) {
                // Probablemente centímetros
                return createScaleConfig('cm', 0.01, 'Centímetros (100 = 1m)');
            }
            // Probablemente metros
            return createScaleConfig('m', 1, 'Metros (1 = 1m)');
        },
        applyCalibration: (cadDistance, realDistance) => {
            if (!(cadDistance > 0) || !(realDistance > 0)) return null;
            let nextScale: ScaleConfig | null = null;
            set((state) => {
                const scene = state.activeScene();
                if (!scene) return state;
                const normalized = normalizeScaleConfig(scene.scaleConfig);
                const desiredEffectiveScale = realDistance / cadDistance;
                const baseFactor =
                    normalized.factor > 0 ? normalized.factor : 1;

                nextScale = {
                    ...normalized,
                    calibrationFactor: desiredEffectiveScale / baseFactor,
                    isCalibrated: true,
                };

                const prevEffective =
                    normalized.factor * normalized.calibrationFactor;
                const nextEffective =
                    nextScale.factor * nextScale.calibrationFactor;

                if (
                    prevEffective > 0 &&
                    nextEffective > 0 &&
                    prevEffective !== nextEffective
                ) {
                    const ratio = nextEffective / prevEffective;
                    return mutateScene(state, (s) => ({
                        ...rescaleSceneEntities(s, ratio),
                        scaleConfig: nextScale!,
                    }));
                }

                return mutateScene(state, (s) => ({
                    ...s,
                    scaleConfig: nextScale!,
                }));
            });
            return nextScale;
        },
        resetCalibration: () => {
            let nextScale: ScaleConfig | null = null;
            set((state) => {
                const scene = state.activeScene();
                if (!scene) return state;
                const normalized = normalizeScaleConfig(scene.scaleConfig);
                nextScale = {
                    ...normalized,
                    calibrationFactor: 1,
                    isCalibrated: false,
                };

                const prevEffective =
                    normalized.factor * normalized.calibrationFactor;
                const nextEffective =
                    nextScale.factor * nextScale.calibrationFactor;

                if (
                    prevEffective > 0 &&
                    nextEffective > 0 &&
                    prevEffective !== nextEffective
                ) {
                    const ratio = nextEffective / prevEffective;
                    return mutateScene(state, (s) => ({
                        ...rescaleSceneEntities(s, ratio),
                        scaleConfig: nextScale!,
                    }));
                }

                return mutateScene(state, (s) => ({
                    ...s,
                    scaleConfig: nextScale!,
                }));
            });
            return nextScale;
        },

        // ── Adders ────────────────────────────────────────────────────────────
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
            const room = scene.rooms.find((r) => r.id === config.roomId);
            if (!room) return [];

            const vertices = config.ambientVertices ?? room.vertices;
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

        // ── Remover ───────────────────────────────────────────────────────────
        removeObject: (id) => {
            set((state) => {
                if (!state.project || !state.activeSceneId) return state;
                const updated = mutateScene(state, (s) => ({
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
                    partitions: (s.partitions ?? []).filter((p) => p.id !== id),
                }));
                return {
                    ...updated,
                    ui: {
                        ...state.ui,
                        selectedId:
                            state.ui.selectedId === id
                                ? null
                                : state.ui.selectedId,
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

        // ── UI ────────────────────────────────────────────────────────────────
        setTool: (tool) => set((s) => ({ ui: { ...s.ui, activeTool: tool } })),
        setAngleSnapMode: (mode) =>
            set((s) => ({ ui: { ...s.ui, angleSnapMode: mode } })),
        setSidebarTab: (tab) =>
            set((s) => ({ ui: { ...s.ui, sidebarTab: tab } })),
        setSelectedId: (id) =>
            set((s) => ({ ui: { ...s.ui, selectedId: id } })),
        setZoom: (zoom) => set((s) => ({ ui: { ...s.ui, zoom } })),
        setPan: (x, y) => set((s) => ({ ui: { ...s.ui, panX: x, panY: y } })),
        toggle3DView: () =>
            set((s) => ({ ui: { ...s.ui, show3DView: !s.ui.show3DView } })),
        toggleRoof: () =>
            set((s) => ({ ui: { ...s.ui, showRoof: !s.ui.showRoof } })),
        toggleGrid: () =>
            set((s) => ({ ui: { ...s.ui, showGrid: !s.ui.showGrid } })),
        toggleIsolux: () =>
            set((s) => ({ ui: { ...s.ui, showIsolux: !s.ui.showIsolux } })),
        setIsoluxMode: (mode) =>
            set((s) => ({ ui: { ...s.ui, isoluxMode: mode } })),
        setFixtureTemplate: (t) =>
            set((s) => ({
                ui: {
                    ...s.ui,
                    fixtureTemplate: { ...s.ui.fixtureTemplate, ...t },
                },
            })),
        setWindowTemplate: (t) =>
            set((s) => ({
                ui: {
                    ...s.ui,
                    windowTemplate: { ...s.ui.windowTemplate, ...t },
                },
            })),
        setDoorTemplate: (t) =>
            set((s) => ({
                ui: { ...s.ui, doorTemplate: { ...s.ui.doorTemplate, ...t } },
            })),
        setFixtureGridRows: (rows) =>
            set((s) => ({
                ui: { ...s.ui, fixtureGridRows: Math.max(1, rows) },
            })),
        setFixtureGridCols: (cols) =>
            set((s) => ({
                ui: { ...s.ui, fixtureGridCols: Math.max(1, cols) },
            })),

        // ── Calc & DXF ────────────────────────────────────────────────────────
        setCalculating: (val) => set({ isCalculating: val }),
        setResult: (result) => set({ result }),
        setResultsByRoom: (resultsByRoom) => set({ resultsByRoom }),
        setDxfData: (entities, extents) =>
            set({ dxfEntities: entities, dxfExtents: extents }),

        // ── Helpers \u0026 Floor Management \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        activeScene: () => {
            const { project, activeSceneId } = get();
            if (!project || !activeSceneId) return null;
            return project.scenes.find((s) => s.id === activeSceneId) ?? null;
        },

        getFloorsSorted: () => {
            const { project } = get();
            if (!project) return [];
            return [...project.scenes].sort((a, b) => (a.floorIndex ?? 0) - (b.floorIndex ?? 0));
        },

        addFloor: (name, floorIndex, floorHeight = 3.0) => {
            const newId = uuidv4();
            const { project } = get();
            if (!project) return newId;

            const newScene: Scene = {
                id: newId,
                name,
                floorIndex,
                floorElevation: 0, // ser\u00e1 recalculada por reorderFloors
                floorHeight,
                scaleConfig: project.scenes[0]?.scaleConfig ?? createScaleConfig('m', 1, 'Metros (1 = 1m)'),
                rooms: [],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures: [],
                partitions: [],
                visible: true,
            };

            set((state) => ({
                project: state.project
                    ? { ...state.project, scenes: [...state.project.scenes, newScene] }
                    : state.project,
            }));

            // Recalcular elevaciones tras agregar
            get().reorderFloors();
            return newId;
        },

        removeFloor: (sceneId) => {
            set((state) => {
                if (!state.project) return state;
                const remaining = state.project.scenes.filter((s) => s.id !== sceneId);
                if (remaining.length === 0) return state; // no dejar sin pisos
                const newActiveId =
                    state.activeSceneId === sceneId
                        ? (remaining[0]?.id ?? null)
                        : state.activeSceneId;
                return {
                    project: { ...state.project, scenes: remaining },
                    activeSceneId: newActiveId,
                };
            });
            get().reorderFloors();
        },

        duplicateFloor: (sourceSceneId, newFloorIndex, newName) => {
            const newId = uuidv4();
            set((state) => {
                if (!state.project) return state;
                const source = state.project.scenes.find((s) => s.id === sourceSceneId);
                if (!source) return state;

                /** Mapeo old ID → new ID para reasignar referencias cruzadas */
                const idMap = new Map<string, string>();
                const remapId = (oldId: string): string => {
                    if (!idMap.has(oldId)) idMap.set(oldId, uuidv4());
                    return idMap.get(oldId)!;
                };

                const cloned: Scene = {
                    ...source,
                    id: newId,
                    name: newName,
                    floorIndex: newFloorIndex,
                    floorElevation: 0,
                    rooms: source.rooms.map((r) => ({ ...r, id: remapId(r.id) })),
                    walls: source.walls.map((w) => ({ ...w, id: remapId(w.id) })),
                    windows: source.windows.map((win) => ({
                        ...win,
                        id: remapId(win.id),
                        wallId: idMap.get(win.wallId) ?? win.wallId,
                    })),
                    doors: source.doors.map((d) => ({
                        ...d,
                        id: remapId(d.id),
                        wallId: idMap.get(d.wallId) ?? d.wallId,
                    })),
                    canopies: source.canopies.map((c) => ({ ...c, id: remapId(c.id) })),
                    fixtures: source.fixtures.map((f) => ({
                        ...f,
                        id: remapId(f.id),
                        roomId: f.roomId ? (idMap.get(f.roomId) ?? f.roomId) : f.roomId,
                    })),
                    partitions: (source.partitions ?? []).map((p) => ({ ...p, id: remapId(p.id) })),
                    visible: source.visible ?? true,
                };

                return {
                    project: { ...state.project, scenes: [...state.project.scenes, cloned] },
                };
            });
            get().reorderFloors();
            return newId;
        },

        updateFloor: (sceneId, patch) => {
            set((state) => {
                if (!state.project) return state;
                return {
                    project: {
                        ...state.project,
                        scenes: state.project.scenes.map((s) =>
                            s.id === sceneId ? { ...s, ...patch } : s,
                        ),
                    },
                };
            });
            if ('floorIndex' in patch || 'floorHeight' in patch) {
                get().reorderFloors();
            }
        },

        reorderFloors: () => {
            set((state) => {
                if (!state.project) return state;

                const sorted = [...state.project.scenes].sort(
                    (a, b) => (a.floorIndex ?? 0) - (b.floorIndex ?? 0),
                );

                // Separar pisos negativos (s\u00f3tanos) y positivos (sobre rasante)
                let elevationAbove = 0;
                const elevationMap = new Map<string, number>();

                // Calcular elevaciones ascendentes desde 0 hacia arriba
                sorted
                    .filter((s) => (s.floorIndex ?? 0) >= 0)
                    .forEach((s) => {
                        elevationMap.set(s.id, elevationAbove);
                        elevationAbove += s.floorHeight ?? 3.0;
                    });

                // Calcular elevaciones descendentes para s\u00f3tanos
                let elevationBelow = 0;
                [...sorted]
                    .filter((s) => (s.floorIndex ?? 0) < 0)
                    .sort((a, b) => (b.floorIndex ?? 0) - (a.floorIndex ?? 0)) // -1 primero
                    .forEach((s) => {
                        elevationBelow -= s.floorHeight ?? 3.0;
                        elevationMap.set(s.id, elevationBelow);
                    });

                return {
                    project: {
                        ...state.project,
                        scenes: state.project.scenes.map((s) => ({
                            ...s,
                            floorElevation: elevationMap.get(s.id) ?? 0,
                        })),
                    },
                };
            });
        },

        toggleFloorVisibility: (sceneId) =>
            set((state) => {
                if (!state.project) return state;
                return {
                    project: {
                        ...state.project,
                        scenes: state.project.scenes.map((s) =>
                            s.id === sceneId
                                ? { ...s, visible: !(s.visible ?? true) }
                                : s,
                        ),
                    },
                };
            }),

        toggleAllFloors: () =>
            set((s) => ({ ui: { ...s.ui, showAllFloors: !s.ui.showAllFloors } })),
    })),
);

// ─── Helper privado ───────────────────────────────────────────────────────────

function mutateScene(
    state: { project: Project | null; activeSceneId: string | null },
    mutator: (scene: Scene) => Scene,
): { project: Project } | typeof state {
    if (!state.project || !state.activeSceneId) return state as typeof state;
    return {
        project: {
            ...state.project,
            scenes: state.project.scenes.map((s) =>
                s.id === state.activeSceneId ? mutator(s) : s,
            ),
        },
    };
}

function rescaleSceneEntities(scene: Scene, ratio: number): Scene {
    return {
        ...scene,
        rooms: (scene.rooms || []).map((r) => ({
            ...r,
            vertices: (r.vertices || []).map((v) => ({
                x: v.x * ratio,
                y: v.y * ratio,
            })),
        })),
        walls: (scene.walls || []).map((w) => ({
            ...w,
            vertices: (w.vertices || []).map((v) => ({
                x: v.x * ratio,
                y: v.y * ratio,
            })),
        })),
        fixtures: (scene.fixtures || []).map((f) => ({
            ...f,
            x: f.x * ratio,
            y: f.y * ratio,
        })),
        canopies: (scene.canopies || []).map((c) => ({
            ...c,
            x1: c.x1 * ratio,
            y1: c.y1 * ratio,
            x2: c.x2 * ratio,
            y2: c.y2 * ratio,
            width: c.width * ratio,
        })),
        // Windows/Doors are relative to walls (offsetAlongWall), so rescale offset + dimensions
        windows: (scene.windows || []).map((w) => ({
            ...w,
            offsetAlongWall: w.offsetAlongWall * ratio,
            width: w.width * ratio,
            height: w.height * ratio,
            sillHeight: w.sillHeight * ratio,
        })),
        doors: (scene.doors || []).map((d) => ({
            ...d,
            offsetAlongWall: d.offsetAlongWall * ratio,
            width: d.width * ratio,
            height: d.height * ratio,
        })),
        partitions: (scene.partitions ?? []).map((p) => ({
            ...p,
            vertices: p.vertices.map((v) => ({ x: v.x * ratio, y: v.y * ratio })),
            thickness: p.thickness * ratio,
        })),
    };
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function normalizePositiveNumber(
    value: unknown,
    fallback: number,
    min = 0,
): number {
    const numeric = normalizeFiniteNumber(value, fallback);
    return Math.max(min, numeric);
}

function normalizeWallState(wall: Wall): Wall {
    const material = wall.material ?? 'brick';
    const normativeUse = wall.normativeUse ?? 'housing';
    const preset = getPeruWallPreset(material, normativeUse);

    return {
        ...wall,
        material,
        normativeUse,
        thickness: normalizePositiveNumber(
            wall.thickness,
            preset.recommendedThickness,
            0.01,
        ),
        height: normalizePositiveNumber(
            wall.height,
            preset.recommendedHeight,
            0.5,
        ),
        mortarJointMin: normalizePositiveNumber(
            wall.mortarJointMin,
            preset.mortarJointMin,
            0,
        ),
        mortarJointMax: normalizePositiveNumber(
            wall.mortarJointMax,
            preset.mortarJointMax,
            0,
        ),
    };
}

function normalizeWallPatch(
    currentWall: Wall,
    patch: Partial<Omit<Wall, 'id'>>,
): Wall {
    const nextMaterial = patch.material ?? currentWall.material ?? 'brick';
    const nextUse = patch.normativeUse ?? currentWall.normativeUse ?? 'housing';
    const preset = getPeruWallPreset(nextMaterial, nextUse);
    const isPresetSwitch =
        patch.material !== undefined || patch.normativeUse !== undefined;

    return normalizeWallState({
        ...currentWall,
        ...patch,
        material: nextMaterial,
        normativeUse: nextUse,
        thickness:
            patch.thickness ??
            (isPresetSwitch
                ? preset.recommendedThickness
                : currentWall.thickness),
        height:
            patch.height ??
            (isPresetSwitch ? preset.recommendedHeight : currentWall.height),
        mortarJointMin:
            patch.mortarJointMin ??
            (isPresetSwitch
                ? preset.mortarJointMin
                : currentWall.mortarJointMin),
        mortarJointMax:
            patch.mortarJointMax ??
            (isPresetSwitch
                ? preset.mortarJointMax
                : currentWall.mortarJointMax),
    });
}

// ─── Selectors memoizados ─────────────────────────────────────────────────────
// Usar estos en lugar de `useEditorStore()` completo para evitar re-renders.

/** Solo la herramienta activa — re-renderiza únicamente cuando cambia el tool. */
export const useActiveTool = () => useEditorStore((s) => s.ui.activeTool);

/** Solo el showGrid flag */
export const useShowGrid = () => useEditorStore((s) => s.ui.showGrid);

/** Solo el showIsolux flag */
export const useShowIsolux = () => useEditorStore((s) => s.ui.showIsolux);

/** Solo el estado de vista 2D/3D */
export const useShow3DView = () => useEditorStore((s) => s.ui.show3DView);

/** Solo el elemento seleccionado */
export const useSelectedId = () => useEditorStore((s) => s.ui.selectedId);

/** La escena activa — usa referencia estable */
export const useActiveScene = () =>
    useEditorStore((s) => {
        const { project, activeSceneId } = s;
        if (!project || !activeSceneId) return null;
        return project.scenes.find((sc) => sc.id === activeSceneId) ?? null;
    });

/** Escala unitaria activa (ScaleConfig) */
export const useScaleConfig = () =>
    useEditorStore(
        useShallow((s) => {
            const scene = s.activeScene();
            return normalizeScaleConfig(scene?.scaleConfig);
        }),
    );

/** El resultado de cálculo lumínico */
export const useLightingResultSelector = () => useEditorStore((s) => s.result);

/** Zoom y pan (UI de overlay) */
export const useViewport = () =>
    useEditorStore(
        useShallow((s) => ({
            zoom: s.ui.zoom,
            panX: s.ui.panX,
            panY: s.ui.panY,
        })),
    );

export function createScaleConfig(
    unit: ScaleConfig['unit'],
    factor: number,
    displayUnit: string,
): ScaleConfig {
    return {
        unit,
        factor,
        displayUnit,
        calibrationFactor: 1,
        isCalibrated: false,
    };
}

export function normalizeScaleConfig(
    scaleConfig?: Partial<ScaleConfig> | null,
): ScaleConfig {
    return {
        unit: scaleConfig?.unit ?? 'm',
        factor: scaleConfig?.factor ?? 1,
        displayUnit: scaleConfig?.displayUnit ?? 'Metros (1 = 1m)',
        calibrationFactor: scaleConfig?.calibrationFactor ?? 1,
        isCalibrated: scaleConfig?.isCalibrated ?? false,
    };
}
