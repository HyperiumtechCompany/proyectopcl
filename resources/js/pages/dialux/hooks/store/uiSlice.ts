import type {
    AngleSnapMode,
    Conductor,
    CorridorConfig,
    Door,
    DrawTool,
    Fixture,
    IsoluxMode,
    JunctionBox,
    LightSwitch,
    SidebarTab,
    Window,
} from '../types';
import type { EditorSlice } from './sliceTypes';

export interface UiSlice {
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
    setSwitchTemplate: (template: { type: LightSwitch['type']; mountingHeight: number; label?: string }) => void;
    setWireTemplate: (template: { wireCount: Conductor['wireCount']; wireLabel: NonNullable<Conductor['wireLabel']> }) => void;
    setJunctionBoxTemplate: (template: { size: JunctionBox['size'] }) => void;
    setWallTypeTemplate: (type: 'interior' | 'exterior' | 'cerco') => void;
    setRoomTypeTemplate: (type: 'room' | 'ambient') => void;
    setFixtureGridRows: (rows: number) => void;
    setFixtureGridCols: (cols: number) => void;
}

export const createUiSlice: EditorSlice<UiSlice> = (set, get) => ({
    setTool: (tool) => set((s) => ({ ui: { ...s.ui, activeTool: tool } })),
    setAngleSnapMode: (mode) =>
        set((s) => ({ ui: { ...s.ui, angleSnapMode: mode } })),
    setSidebarTab: (tab) =>
        set((s) => ({ ui: { ...s.ui, sidebarTab: tab } })),
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
});
