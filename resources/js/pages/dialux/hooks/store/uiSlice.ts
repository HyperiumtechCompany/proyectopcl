import { normalizeGuideBoundaries } from '../fixtureGrid';
import type {
    AngleSnapMode,
    Conductor,
    CorridorConfig,
    Door,
    DrawTool,
    ElectricalLayerGroup,
    Fixture,
    IsoluxMode,
    JunctionBox,
    LightSwitch,
    SidebarTab,
    Vertex,
    Window,
} from '../types';
import type { FixtureGridGuideEditorState } from '../useEditorStore';
import type { EditorSlice } from './sliceTypes';
import { classifyConductorLayer } from '@/pages/dialux/electrical/electricalLayerVisibility';

/** Fronteras internas (sin 0/1) para una division uniforme -- estado inicial del editor de guias. */
function uniformGuides(cellCount: number): number[] {
    return normalizeGuideBoundaries(undefined, Math.max(1, Math.round(cellCount)) - 1).slice(1, -1);
}

export interface UiSlice {
    setTool: (tool: DrawTool) => void;
    setAngleSnapMode: (mode: AngleSnapMode) => void;
    setSidebarTab: (tab: SidebarTab) => void;
    toggleElectricalLayer: (group: ElectricalLayerGroup) => void;
    toggleElectricalItemVisibility: (id: string) => void;
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
    setSwitchTemplate: (template: { type: LightSwitch['type']; mountingHeight: number; label?: string }) => void;
    setWireTemplate: (template: { wireCount: Conductor['wireCount']; wireLabel: NonNullable<Conductor['wireLabel']> }) => void;
    setJunctionBoxTemplate: (template: { size: JunctionBox['size'] }) => void;
    setWallTypeTemplate: (type: 'interior' | 'exterior' | 'cerco') => void;
    setRoomTypeTemplate: (type: 'room' | 'ambient') => void;
    setFixtureGridRows: (rows: number) => void;
    setFixtureGridCols: (cols: number) => void;
    /** Abre (o reinicia con division uniforme) el editor de lineas guia para este room/rows/columns. */
    openFixtureGridGuideEditor: (roomId: string, rows: number, columns: number, vertices: Vertex[]) => void;
    closeFixtureGridGuideEditor: () => void;
    /** Arrastra una guia individual; se clampa contra sus vecinas para que nunca se crucen. */
    setFixtureGridGuide: (axis: 'row' | 'column', index: number, value: number) => void;
    setFixtureGridAreaMode: (mode: 'room' | 'draw') => void;
    /** Poligono recien cerrado en modo 'draw', esperando confirmacion de cantidad. `null` para cancelar/limpiar. */
    setPendingFixtureGridArea: (vertices: Vertex[] | null) => void;
}

const ELECTRICAL_TOOLS = new Set<DrawTool>([
    'fixture', 'fixture-grid', 'switch', 'wire',
    'elec-meter', 'elec-main-panel', 'elec-sub-panel', 'elec-transfer',
    'elec-arrival', 'elec-junction-box', 'elec-earth-pit', 'elec-facp',
    'elec-outlet-floor', 'elec-outlet-initial', 'elec-outlet-high-180',
    'elec-outlet-floor-box', 'elec-outlet-waterproof', 'elec-outlet-ceiling',
    'elec-outlet-rack', 'elec-water-heater',
]);

export const createUiSlice: EditorSlice<UiSlice> = (set, get) => ({
    setTool: (tool) => set((s) => ({
        ui: {
            ...s.ui,
            activeTool: tool,
            sidebarTab: ELECTRICAL_TOOLS.has(tool) ? 'legend' : s.ui.sidebarTab,
        },
    })),
    setAngleSnapMode: (mode) =>
        set((s) => ({ ui: { ...s.ui, angleSnapMode: mode } })),
    setSidebarTab: (tab) =>
        set((s) => ({ ui: { ...s.ui, sidebarTab: tab } })),
    toggleElectricalLayer: (group) =>
        set((s) => {
            const nextVisible = !s.ui.electricalLayerVisibility[group];
            if (nextVisible) {
                return { ui: { ...s.ui, electricalLayerVisibility: { ...s.ui.electricalLayerVisibility, [group]: true } } };
            }

            const scene = get().activeScene();
            const belongsToGroup = (id: string): boolean => {
                if (!scene) return false;
                if (group === 'fixtures' && scene.fixtures.some((item) => item.id === id)) return true;
                if (group === 'switches' && (scene.lightSwitches ?? []).some((item) => item.id === id)) return true;
                const device = (scene.electricalDevices ?? []).find((item) => item.id === id);
                if (device) return group === (device.type.startsWith('outlet_') ? 'outlets' : 'panels');
                const conductor = (scene.conductors ?? []).find((item) => item.id === id);
                return Boolean(conductor && group === classifyConductorLayer(
                    conductor,
                    scene.fixtures,
                    scene.lightSwitches ?? [],
                    scene.electricalDevices ?? [],
                ));
            };

            return {
                ui: {
                    ...s.ui,
                    electricalLayerVisibility: { ...s.ui.electricalLayerVisibility, [group]: false },
                    selectedId: s.ui.selectedId && belongsToGroup(s.ui.selectedId) ? null : s.ui.selectedId,
                    selectedFixtureIds: s.ui.selectedFixtureIds.filter((id) => !belongsToGroup(id)),
                },
            };
        }),
    toggleElectricalItemVisibility: (id) =>
        set((s) => {
            const hiding = !s.ui.hiddenElectricalIds.includes(id);
            return {
                ui: {
                    ...s.ui,
                    hiddenElectricalIds: hiding
                        ? [...s.ui.hiddenElectricalIds, id]
                        : s.ui.hiddenElectricalIds.filter((itemId) => itemId !== id),
                    selectedId: hiding && s.ui.selectedId === id ? null : s.ui.selectedId,
                    selectedFixtureIds: hiding
                        ? s.ui.selectedFixtureIds.filter((itemId) => itemId !== id)
                        : s.ui.selectedFixtureIds,
                },
            };
        }),
    setSelectedId: (id) =>
        set((s) => {
            // Si seleccionamos otra cosa, limpiamos selectedFixtureIds si id no es fixture
            // O limpiamos selectedFixtureIds y si id es fixture, lo agregamos
            const activeScene = get().activeScene();
            let isFixture = false;
            if (activeScene && id) {
                isFixture = activeScene.fixtures.some(f => f.id === id);
            }
            return {
                ui: {
                    ...s.ui,
                    selectedId: id,
                    selectedFixtureIds: isFixture && id ? [id] : [],
                }
            };
        }),
    setSelectedFixtureIds: (ids) =>
        set((s) => ({ ui: { ...s.ui, selectedFixtureIds: ids, selectedId: ids.length === 1 ? ids[0] : null } })),
    toggleFixtureSelection: (id) =>
        set((s) => {
            const current = s.ui.selectedFixtureIds;
            const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            return { ui: { ...s.ui, selectedFixtureIds: next, selectedId: next.length === 1 ? next[0] : null } };
        }),
    clearFixtureSelection: () =>
        set((s) => ({ ui: { ...s.ui, selectedFixtureIds: [], selectedId: null } })),
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
                // Reemplaza la plantilla por completo (no fusiona con la
                // anterior): si no lo hiciéramos, campos como
                // emergencyType/catalogSymbol de una luminaria de
                // emergencia seguirían "pegados" a la siguiente
                // luminaria normal seleccionada del catálogo.
                ...s.ui,
                fixtureTemplate: t,
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
    setCorridorTemplate: (template) =>
        set((s) => ({
            ui: {
                ...s.ui,
                corridorTemplate: { ...s.ui.corridorTemplate, ...template },
            },
        })),
    setSwitchTemplate: (template) =>
        set((s) => ({ ui: { ...s.ui, switchTemplate: { ...s.ui.switchTemplate, ...template } } })),
    setWireTemplate: (template) =>
        set((s) => ({ ui: { ...s.ui, wireTemplate: { ...s.ui.wireTemplate, ...template } } })),
    setJunctionBoxTemplate: (template) =>
        set((s) => ({ ui: { ...s.ui, junctionBoxTemplate: { ...s.ui.junctionBoxTemplate, ...template } } })),
    setWallTypeTemplate: (type) =>
        set((s) => ({ ui: { ...s.ui, wallTypeTemplate: type } })),
    setRoomTypeTemplate: (type) =>
        set((s) => ({ ui: { ...s.ui, roomTypeTemplate: type } })),
    setFixtureGridRows: (rows) =>
        set((s) => ({
            ui: { ...s.ui, fixtureGridRows: Math.max(1, rows) },
        })),
    setFixtureGridCols: (cols) =>
        set((s) => ({
            ui: { ...s.ui, fixtureGridCols: Math.max(1, cols) },
        })),
    openFixtureGridGuideEditor: (roomId, rows, columns, vertices) =>
        set((s) => ({
            ui: {
                ...s.ui,
                fixtureGridGuideEditor: {
                    roomId,
                    rows: Math.max(1, Math.round(rows)),
                    columns: Math.max(1, Math.round(columns)),
                    vertices,
                    rowGuides: uniformGuides(rows),
                    columnGuides: uniformGuides(columns),
                },
            },
        })),
    closeFixtureGridGuideEditor: () =>
        set((s) => ({ ui: { ...s.ui, fixtureGridGuideEditor: null } })),
    setFixtureGridGuide: (axis, index, value) =>
        set((s) => {
            const editor = s.ui.fixtureGridGuideEditor;
            if (!editor) return s;
            const key = axis === 'row' ? 'rowGuides' : 'columnGuides';
            const guides = [...editor[key]];
            if (index < 0 || index >= guides.length) return s;

            // Margen minimo (fraccion del bbox) para que dos guias nunca se
            // crucen ni colapsen una celda a ancho ~0 durante el arrastre.
            const MIN_GAP = 0.02;
            const lowerBound = index === 0 ? MIN_GAP : guides[index - 1] + MIN_GAP;
            const upperBound = index === guides.length - 1 ? 1 - MIN_GAP : guides[index + 1] - MIN_GAP;
            guides[index] = Math.min(upperBound, Math.max(lowerBound, value));

            const nextEditor: FixtureGridGuideEditorState = { ...editor, [key]: guides };
            return { ui: { ...s.ui, fixtureGridGuideEditor: nextEditor } };
        }),
    setFixtureGridAreaMode: (mode) =>
        set((s) => ({
            ui: {
                ...s.ui,
                fixtureGridAreaMode: mode,
                // Cambiar de modo a mitad de un area pendiente sin confirmar
                // la dejaria huerfana (referida a un modo que ya no aplica).
                pendingFixtureGridArea: null,
            },
        })),
    setPendingFixtureGridArea: (vertices) =>
        set((s) => ({ ui: { ...s.ui, pendingFixtureGridArea: vertices } })),
});
