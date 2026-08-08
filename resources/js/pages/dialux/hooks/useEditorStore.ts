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
import type { CalculationRun } from '@/pages/dialux/domain/calculation/types';

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
    LightSwitch,
    Conductor,
    JunctionBox,
    ElectricalDevice,
    ElectricalDeviceType,
    ElectricalLayerGroup,
    ElectricalDeviceProperties,
    FixtureGridConfig,
    RoomLightingCalculation,
    ModuleLightingCalculations,
    Scene,
    LightingScenePreset,
    SceneTrigger,
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
    CorridorConfig,
} from './types';

import {
    buildFixtureGridObjects,
    calculateCenteredOffsetOnWall,
} from './fixtureGrid';
import type { NormativeStandard } from './roomLighting';
import { buildDefaultStairConfig } from './stairNorms';
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
    LightSwitch,
    Conductor,
    JunctionBox,
    ElectricalDevice,
    ElectricalDeviceType,
    ElectricalLayerGroup,
    ElectricalDeviceProperties,
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
    CorridorConfig,
} from './types';
import {
    createScaleConfig,
    mutateScene,
    normalizeScaleConfig,
    normalizeWallPatch,
    normalizeWallState,
    rescaleDxfEntities,
    rescaleDxfExtents,
    rescaleSceneEntities,
} from './storeHelpers';
import { createFloorSlice, type FloorSlice } from './store/floorSlice';
import { createScaleDxfSlice, type ScaleDxfSlice } from './store/scaleDxfSlice';
import { createProjectSlice, type ProjectSlice } from './store/projectSlice';
import { createSceneObjectsSlice, type SceneObjectsSlice } from './store/sceneObjectsSlice';
import { createUiSlice, type UiSlice } from './store/uiSlice';
import { createDeletionSlice, type DeletionSlice } from './store/deletionSlice';
import {
    createHistorySlice,
    installHistoryCapture,
    type HistorySlice,
} from './store/historySlice';

export { createScaleConfig, normalizeScaleConfig } from './storeHelpers';

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
    selectedFixtureIds: string[];
    fixtureTemplate: Partial<Fixture>;
    windowTemplate: Partial<Window>;
    doorTemplate: Partial<Door>;
    corridorTemplate: CorridorConfig;
    switchTemplate: {
        type: LightSwitch['type'];
        mountingHeight: number;
        label?: string;
    };
    wireTemplate: {
        wireCount: Conductor['wireCount'];
        wireLabel: NonNullable<Conductor['wireLabel']>;
    };
    junctionBoxTemplate: { size: JunctionBox['size'] };
    /** Template para el dispositivo eléctrico activo (tipo que se insertará al hacer clic) */
    electricalDeviceTemplate: {
        type: ElectricalDeviceType;
        label?: string;
        /** Overrides de propiedades (p.ej. potencia, marca) al colocar desde el catálogo. */
        properties?: Partial<ElectricalDeviceProperties>;
    } | null;
    /** Tipo de muro que se creará al dibujar con la herramienta 'wall' */
    wallTypeTemplate: 'interior' | 'exterior' | 'cerco';
    /**
     * Tipo de espacio que se creará al dibujar con la herramienta 'room':
     *   'room'    → Recinto (envolvente exterior, sin iluminación)
     *   'ambient' → Ambiente interior (espacio habitable con normativa)
     */
    roomTypeTemplate: 'room' | 'ambient';
    /** Configuración de la grilla de focos en el panel de luz */
    fixtureGridRows: number;
    fixtureGridCols: number;
    /** Cuando true, el canvas 2D y 3D muestran todos los pisos visibles superpuestos */
    showAllFloors: boolean;
    electricalLayerVisibility: Record<ElectricalLayerGroup, boolean>;
    hiddenElectricalIds: string[];
    /**
     * Se incrementa cada vez que el plano del piso activo cambia por una vía
     * que no cambia `activeSceneId` (ej. reutilizar el plano de otro piso
     * para el piso ya abierto). El canvas 2D lo usa para saber que debe
     * releer el plano aunque siga en el mismo piso.
     */
    planReloadTick: number;
}

// ─── Estado global ────────────────────────────────────────────────────────────

export interface EditorState extends DeletionSlice, HistorySlice, SceneObjectsSlice, FloorSlice, ScaleDxfSlice, ProjectSlice, UiSlice {
    project: Project | null;
    activeSceneId: string | null;
    isCalculating: boolean;
    result: LightingResult | null;
    resultsByRoom: Record<string, LightingResult>;
    /**
     * Último `CalculationRun` completo (Fase 13: "evitar recálculos... e
     * invalidar si stale"). Distinto de `resultsByRoom` (solo valores
     * planos) — trae `snapshotHash`/`engineVersion`/`warnings`, necesarios
     * para `isCalculationRunStale` y para mostrar trazabilidad en la UI/PDF.
     */
    lastCalculationRun: CalculationRun | null;
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
    applyNormativeProfileToRooms: (opts: {
        standard: NormativeStandard;
        normaLux: number;
        ugrLimit?: number;
        uniformityTarget?: number;
        colorRenderingRa?: number;
        normativeLabel?: string;
        normativeCategory?: string;
        normativeSection?: string;
        normativeActivity?: string;
        specificRequirements?: string | null;
        roomIds?: string[];
    }) => void;
    setProjectNormativeConfig: (config: ProjectNormativeConfig | null) => void;
    updateComplianceSummary: (
        summary: ProjectNormativeConfig['complianceSummary'],
    ) => void;

    // ── Scale ────────────────────────────────────────────────────────────────
    setScaleConfig: (
        scaleConfig: ScaleConfig,
        rescaleObjects?: boolean,
    ) => void;
    rescaleScene: (ratio: number) => void;

    // --- DXF Entities ---
    setDxfEntities: (entities: DxfEntity[], extents?: DxfExtents) => void;
    setDxfData: (entities: DxfEntity[], extents: DxfExtents | null) => void;
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
    addLightSwitch: (
        lightSwitch: Omit<LightSwitch, 'id' | 'connectedFixtureIds'>,
    ) => string;
    addConductor: (conductor: Omit<Conductor, 'id'>) => string;
    addJunctionBox: (box: Omit<JunctionBox, 'id'>) => string;
    addElectricalDevice: (device: Omit<ElectricalDevice, 'id'>) => string;

    updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void;
    updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void;
    updateWindow: (id: string, patch: Partial<Omit<Window, 'id'>>) => void;
    updateDoor: (id: string, patch: Partial<Omit<Door, 'id'>>) => void;
    updateCanopy: (id: string, patch: Partial<Omit<Canopy, 'id'>>) => void;
    updateFixture: (id: string, patch: Partial<Omit<Fixture, 'id'>>) => void;
    updateFixtures: (
        ids: string[],
        patch: Partial<Omit<Fixture, 'id'>>,
    ) => void;
    updatePartition: (
        id: string,
        patch: Partial<Omit<Partition, 'id'>>,
    ) => void;
    updateLightSwitch: (
        id: string,
        patch: Partial<Omit<LightSwitch, 'id'>>,
    ) => void;
    updateConductor: (
        id: string,
        patch: Partial<Omit<Conductor, 'id'>>,
    ) => void;
    updateJunctionBox: (
        id: string,
        patch: Partial<Omit<JunctionBox, 'id'>>,
    ) => void;
    updateElectricalDevice: (
        id: string,
        patch: Partial<Omit<ElectricalDevice, 'id'>>,
    ) => void;
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

    // ── UI ───────────────────────────────────────────────────────────────────
    setTool: (tool: DrawTool) => void;
    setAngleSnapMode: (mode: AngleSnapMode) => void;
    setSidebarTab: (tab: SidebarTab) => void;
    setSelectedId: (id: string | null) => void;
    setSelectedFixtureIds: (ids: string[]) => void;
    toggleFixtureSelection: (id: string) => void;
    clearFixtureSelection: () => void;
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
    setCorridorTemplate: (template: CorridorConfig) => void;
    setSwitchTemplate: (template: {
        type: LightSwitch['type'];
        mountingHeight: number;
        label?: string;
    }) => void;
    setWireTemplate: (template: {
        wireCount: Conductor['wireCount'];
        wireLabel: NonNullable<Conductor['wireLabel']>;
    }) => void;
    setJunctionBoxTemplate: (template: { size: JunctionBox['size'] }) => void;
    setWallTypeTemplate: (type: 'interior' | 'exterior' | 'cerco') => void;
    setRoomTypeTemplate: (type: 'room' | 'ambient') => void;
    setFixtureGridRows: (rows: number) => void;
    setFixtureGridCols: (cols: number) => void;

    // ── Calculation & DXF ────────────────────────────────────────────────────
    setCalculating: (val: boolean) => void;
    setResult: (result: LightingResult | null) => void;
    /** Fuerza al canvas 2D a releer el plano del piso activo (ver planReloadTick) */
    bumpPlanReloadTick: () => void;
    setResultsByRoom: (results: Record<string, LightingResult>) => void;
    setLastCalculationRun: (run: CalculationRun | null) => void;

    // ── Helpers ───────────────────────────────────────────────────────────────
    activeScene: () => Scene | null;
    /** Devuelve todos los pisos ordenados de sótano a planta alta */
    getFloorsSorted: () => Scene[];

    // ── Floor Management ─────────────────────────────────────────────────────
    /** Crea un nuevo piso vacío. Devuelve el ID de la nueva Scene. */
    addFloor: (
        name: string,
        floorIndex: number,
        floorHeight?: number,
    ) => string;
    /** Elimina un piso (y cambia activeScene si era el activo) */
    removeFloor: (sceneId: string) => void;
    /**
     * Duplica la geometría de un piso como nuevo piso.
     * Genera IDs nuevos para todos los objetos del piso clonado.
     */
    duplicateFloor: (
        sourceSceneId: string,
        newFloorIndex: number,
        newName: string,
    ) => string;
    /** Actualiza propiedades del piso (name, floorHeight, etc.) */
    updateFloor: (
        sceneId: string,
        patch: Partial<Pick<Scene, 'name' | 'floorHeight' | 'floorIndex' | 'ifcGlobalId'>>,
    ) => void;
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
    subscribeWithSelector((set, get, api) => ({
        ...createFloorSlice(set, get, api),
        ...createScaleDxfSlice(set, get, api),
        ...createUiSlice(set, get, api),
        ...createProjectSlice(set, get, api),
        ...createSceneObjectsSlice(set, get, api),
        ...createDeletionSlice(set, get, api),
        ...createHistorySlice(set, get, api),
        project: null,
        activeSceneId: null,
        isCalculating: false,
        result: null,
        resultsByRoom: {},
        lastCalculationRun: null,
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
            selectedFixtureIds: [],
            fixtureTemplate: {
                fixtureType: 'recessed',
                // 'rectangular' es el default seguro hasta que el usuario elija
                // un producto real del catálogo — 'round' aquí hacía que toda
                // luminaria colocada sin producto seleccionado se dibujara como
                // círculo, aunque terminara siendo un panel/lineal.
                fixtureShape: 'rectangular',
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
            corridorTemplate: {
                type: 'roof_only',
                slabThickness: 0.2,
                railingHeight: 1.05,
            },
            switchTemplate: {
                type: 'single',
                mountingHeight: 1.4,
                label: 'S(a)',
            },
            wireTemplate: { wireCount: 3, wireLabel: 'F+N+T' },
            junctionBoxTemplate: { size: '100x100x50' },
            electricalDeviceTemplate: null,
            wallTypeTemplate: 'interior',
            roomTypeTemplate: 'room',
            fixtureGridRows: 2,
            fixtureGridCols: 2,
            showAllFloors: false,
            electricalLayerVisibility: {
                cad: true,
                fixtures: true,
                wires: true,
                switches: true,
                outlets: true,
                panels: true,
            },
            hiddenElectricalIds: [],
            planReloadTick: 0,
        },

        // ── Calc & DXF ────────────────────────────────────────────────────────
        setCalculating: (val) => set({ isCalculating: val }),
        setResult: (result) => set({ result }),
        setResultsByRoom: (resultsByRoom) => set({ resultsByRoom }),
        setLastCalculationRun: (lastCalculationRun) => set({ lastCalculationRun }),
        bumpPlanReloadTick: () =>
            set((s) => ({
                ui: { ...s.ui, planReloadTick: s.ui.planReloadTick + 1 },
            })),
    })),
);

installHistoryCapture(useEditorStore);

export type {
    DeletionAnalysis,
    DeletionChild,
} from '@/pages/dialux/selection/deletionPolicy';

// ─── Helper privado ───────────────────────────────────────────────────────────

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
