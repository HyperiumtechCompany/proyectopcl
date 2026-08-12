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
    updateFloor: (sceneId: string, patch: Partial<Pick<Scene, 'name' | 'floorHeight' | 'floorIndex' | 'ifcGlobalId'>>) => void;
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
            const globalPanelIds = new Set(
                (source.electricalDevices ?? [])
                    .filter((device) =>
                        (device.type === 'main_panel' || device.type === 'sub_panel') &&
                        device.properties?.panelScope === 'project',
                    )
                    .map((device) => device.id),
            );

            /**
             * Mapeo old ID → new ID para reasignar referencias cruzadas.
             *
             * Se puebla en una primera pasada con el ID propio de CADA entidad
             * de la escena (recintos, muros, aberturas, luminarias,
             * interruptores, dispositivos eléctricos, conductores, cajas y
             * tabiques) ANTES de reconstruir ninguna referencia cruzada. Esto
             * evita bugs de orden: un conductor puede apuntar a un interruptor
             * o dispositivo declarado más adelante en su propio arreglo, y un
             * dispositivo eléctrico puede referenciar a otro dispositivo
             * (`connectedDeviceIds`) sin garantía de orden. Remapear en dos
             * pasadas (generar todos los IDs nuevos primero, resolver
             * referencias después) hace que el resultado no dependa del orden
             * de declaración.
             */
            const idMap = new Map<string, string>();
            const registerId = (oldId: string): void => {
                if (!idMap.has(oldId)) idMap.set(oldId, uuidv4());
            };
            const remapId = (oldId: string): string => {
                registerId(oldId);
                return idMap.get(oldId)!;
            };
            /** Referencia simple (wallId, sourceId, connectedFixtureIds, etc.) */
            const remapRef = <T extends string | undefined>(id: T): T =>
                (id === undefined ? undefined : (idMap.get(id) ?? id)) as T;
            const remapRefList = (ids: string[] | undefined): string[] | undefined =>
                ids?.map((id) => idMap.get(id) ?? id);
            /**
             * `roomId` puede ser un ID simple de recinto o un ID compuesto de
             * ambiente (`hooks/ambientSpaces.ts`: `${room.id}::ambient-N`, o
             * `${room.id}::${corridor.id}::ambient-N`). Se remapea cada
             * segmento del compuesto por separado; los segmentos que no son
             * IDs de entidad (ej. "ambient-1") no están en `idMap` y se
             * conservan tal cual.
             */
            const remapRoomRef = (roomId: string): string =>
                roomId
                    .split('::')
                    .map((segment) => idMap.get(segment) ?? segment)
                    .join('::');

            // Primera pasada: registrar un ID nuevo para cada entidad, sin
            // tocar todavía ninguna referencia cruzada.
            for (const r of source.rooms) registerId(r.id);
            for (const w of source.walls) registerId(w.id);
            for (const win of source.windows) registerId(win.id);
            for (const d of source.doors) registerId(d.id);
            for (const c of source.canopies) registerId(c.id);
            for (const f of source.fixtures) registerId(f.id);
            for (const s of source.lightSwitches ?? []) registerId(s.id);
            for (const d of source.electricalDevices ?? []) {
                if (!globalPanelIds.has(d.id)) registerId(d.id);
            }
            for (const c of source.conductors ?? []) {
                if (!globalPanelIds.has(c.sourceId) && !globalPanelIds.has(c.targetId)) registerId(c.id);
            }
            for (const j of source.junctionBoxes ?? []) registerId(j.id);
            for (const p of source.partitions ?? []) registerId(p.id);

            // Segunda pasada: clonar cada entidad con su ID nuevo y todas sus
            // referencias cruzadas ya resueltas contra el mapeo completo.
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
                    wallId: remapRef(win.wallId),
                })),
                doors: source.doors.map((d) => ({
                    ...d,
                    id: remapId(d.id),
                    wallId: remapRef(d.wallId),
                })),
                canopies: source.canopies.map((c) => ({ ...c, id: remapId(c.id) })),
                fixtures: source.fixtures.map((f) => ({
                    ...f,
                    id: remapId(f.id),
                    roomId: f.roomId ? remapRoomRef(f.roomId) : f.roomId,
                    wallId: remapRef(f.wallId),
                })),
                lightSwitches: (source.lightSwitches ?? []).map((s) => ({
                    ...s,
                    id: remapId(s.id),
                    wallId: remapRef(s.wallId),
                    connectedFixtureIds: remapRefList(s.connectedFixtureIds) ?? [],
                })),
                electricalDevices: (source.electricalDevices ?? []).filter((d) => !globalPanelIds.has(d.id)).map((d) => ({
                    ...d,
                    id: remapId(d.id),
                    wallId: remapRef(d.wallId),
                    roomId: d.roomId ? remapRoomRef(d.roomId) : d.roomId,
                    // `ambientId` (grupo de tomacorrientes generados por
                    // sub-ambiente, = id de la pared delimitadora — ver
                    // `types.ts::ElectricalDevice.ambientId`) es un id simple
                    // igual que `wallId`, no un roomId compuesto — sin este
                    // remapeo, un tomacorriente clonado quedaba apuntando a
                    // la pared del piso ORIGEN, y "Regenerar" en el piso
                    // nuevo nunca lo encontraba para reemplazarlo.
                    ambientId: remapRef(d.ambientId),
                    connectedDeviceIds: remapRefList(d.connectedDeviceIds) ?? [],
                    connectedFixtureIds: remapRefList(d.connectedFixtureIds),
                    connectedSwitchIds: remapRefList(d.connectedSwitchIds),
                })),
                conductors: (source.conductors ?? [])
                    .filter((c) => !globalPanelIds.has(c.sourceId) && !globalPanelIds.has(c.targetId))
                    .map((c) => ({
                    ...c,
                    id: remapId(c.id),
                    sourceId: remapRef(c.sourceId),
                    targetId: remapRef(c.targetId),
                })),
                junctionBoxes: (source.junctionBoxes ?? []).map((j) => ({ ...j, id: remapId(j.id) })),
                partitions: (source.partitions ?? []).map((p) => ({ ...p, id: remapId(p.id) })),
                // Fase 10 (auditoría `dialux-calc-reviewer`): las claves de
                // `switchStates` referencian IDs de interruptor — sin este
                // remapeo, quedarían apuntando a los IDs VIEJOS (los
                // interruptores clonados arriba ya tienen IDs nuevos), y
                // `resolveLuminaireStates` (`buildCalculationSnapshot.ts`)
                // trataría esos interruptores como "no listados" (encendidos
                // al 100% por defecto) en el piso duplicado — un preset como
                // "Modo nocturno" se calcularía silenciosamente como si todo
                // estuviera encendido.
                lightingScenes: source.lightingScenes?.map((preset) => ({
                    ...preset,
                    switchStates: Object.fromEntries(
                        Object.entries(preset.switchStates).map(([switchId, state]) => [remapRef(switchId), state]),
                    ),
                })),
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
