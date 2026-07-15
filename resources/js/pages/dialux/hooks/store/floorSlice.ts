import { v4 as uuidv4 } from 'uuid';
import { createScaleConfig } from '../storeHelpers';
import type { Scene } from '../types';
import type { EditorSlice } from './sliceTypes';

export interface FloorSlice {
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

export const createFloorSlice: EditorSlice<FloorSlice> = (set, get) => ({
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
            floorElevation: 0, // será recalculada por reorderFloors
            floorHeight,
            scaleConfig: project.scenes[0]?.scaleConfig ?? createScaleConfig('m', 1, 'Metros (1 = 1m)'),
            rooms: [],
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: [],
            lightSwitches: [],
            conductors: [],
            junctionBoxes: [],
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

            // Separar pisos negativos (sótanos) y positivos (sobre rasante)
            let elevationAbove = 0;
            const elevationMap = new Map<string, number>();

            // Calcular elevaciones ascendentes desde 0 hacia arriba
            sorted
                .filter((s) => (s.floorIndex ?? 0) >= 0)
                .forEach((s) => {
                    elevationMap.set(s.id, elevationAbove);
                    elevationAbove += s.floorHeight ?? 3.0;
                });

            // Calcular elevaciones descendentes para sótanos
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
});
