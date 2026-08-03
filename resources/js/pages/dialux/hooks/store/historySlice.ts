import type { Project } from '../types';
import type { EditorSlice } from './sliceTypes';

/**
 * historySlice.ts — Undo/redo del proyecto DIAlux (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).
 *
 * Diseño: en todo el store, `project` SIEMPRE se reemplaza de forma inmutable
 * (spread, nunca mutación in-place — ver mutateScene en storeHelpers.ts). Eso
 * significa que guardar referencias anteriores de `project` en una pila es
 * barato (no clona nada; solo retiene el objeto anterior) y reconstruye el
 * estado completo con exactitud, sin necesidad de reescribir cada mutación
 * como un comando explícito.
 *
 * Las pilas viven en variables de módulo (mismo patrón que el singleton del
 * motor CAD en useMlightcadEngine.ts) para no forzar que cada snapshot pase
 * por el tipado reactivo del store; solo los flags derivados (`historyCanUndo`
 * / `historyCanRedo`) son estado reactivo, para que los botones de la UI se
 * actualicen.
 *
 * Gestos/transacciones: `beginHistoryGesture`/`endHistoryGesture` agrupan una
 * ráfaga de mutaciones (arrastre continuo, o una eliminación en cascada de
 * contenedor + hijos) en un ÚNICO paso de undo, capturando el snapshot antes
 * de la primera mutación del grupo y solo empujándolo al deshacer la ráfaga
 * completa si el estado realmente cambió.
 */

const HISTORY_LIMIT = 100;

let undoStack: Project[] = [];
let redoStack: Project[] = [];
let isRestoring = false;
let gestureDepth = 0;
let gestureBaseline: Project | null = null;

export interface HistorySlice {
    historyCanUndo: boolean;
    historyCanRedo: boolean;
    undo: () => void;
    redo: () => void;
    /** Limpia las pilas — llamar tras sembrar el store con un proyecto (carga inicial). */
    resetHistory: () => void;
    /** Agrupa las mutaciones siguientes en un único paso de undo. Debe cerrarse con endHistoryGesture. */
    beginHistoryGesture: () => void;
    endHistoryGesture: () => void;
}

function entityExistsInProject(project: Project | null, id: string | null): boolean {
    if (!project || !id) return false;
    for (const scene of project.scenes) {
        if (scene.rooms.some((r) => r.id === id)) return true;
        if (scene.walls.some((w) => w.id === id)) return true;
        if (scene.windows.some((w) => w.id === id)) return true;
        if (scene.doors.some((d) => d.id === id)) return true;
        if (scene.canopies.some((c) => c.id === id)) return true;
        if (scene.fixtures.some((f) => f.id === id)) return true;
        if ((scene.lightSwitches ?? []).some((s) => s.id === id)) return true;
        if ((scene.conductors ?? []).some((c) => c.id === id)) return true;
        if ((scene.junctionBoxes ?? []).some((j) => j.id === id)) return true;
        if ((scene.electricalDevices ?? []).some((d) => d.id === id)) return true;
        if ((scene.partitions ?? []).some((p) => p.id === id)) return true;
    }
    return false;
}

export const createHistorySlice: EditorSlice<HistorySlice> = (set, get) => ({
    historyCanUndo: false,
    historyCanRedo: false,

    undo: () => {
        if (undoStack.length === 0) return;
        const current = get().project;
        const previous = undoStack.pop()!;
        if (current) redoStack.push(current);

        isRestoring = true;
        set({ project: previous });
        isRestoring = false;

        const selectedId = get().ui.selectedId;
        if (!entityExistsInProject(previous, selectedId)) {
            set((s) => ({ ui: { ...s.ui, selectedId: null, selectedFixtureIds: [] } }));
        }
        set({ historyCanUndo: undoStack.length > 0, historyCanRedo: redoStack.length > 0 });
    },

    redo: () => {
        if (redoStack.length === 0) return;
        const current = get().project;
        const next = redoStack.pop()!;
        if (current) undoStack.push(current);

        isRestoring = true;
        set({ project: next });
        isRestoring = false;

        const selectedId = get().ui.selectedId;
        if (!entityExistsInProject(next, selectedId)) {
            set((s) => ({ ui: { ...s.ui, selectedId: null, selectedFixtureIds: [] } }));
        }
        set({ historyCanUndo: undoStack.length > 0, historyCanRedo: redoStack.length > 0 });
    },

    resetHistory: () => {
        undoStack = [];
        redoStack = [];
        gestureDepth = 0;
        gestureBaseline = null;
        set({ historyCanUndo: false, historyCanRedo: false });
    },

    beginHistoryGesture: () => {
        if (gestureDepth === 0) {
            gestureBaseline = get().project;
        }
        gestureDepth += 1;
    },

    endHistoryGesture: () => {
        gestureDepth = Math.max(0, gestureDepth - 1);
        if (gestureDepth > 0) return;
        const baseline = gestureBaseline;
        gestureBaseline = null;
        if (!baseline) return;
        const current = get().project;
        if (current === baseline) return; // el gesto no cambió nada realmente
        undoStack.push(baseline);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack = [];
        set({ historyCanUndo: true, historyCanRedo: false });
    },
});

/**
 * Instala el observador de `project` que alimenta la pila de undo.
 * Llamar UNA sola vez, después de crear el store (ver useEditorStore.ts).
 */
export function installHistoryCapture(
    api: {
        subscribe: (
            selector: (s: { project: Project | null }) => Project | null,
            listener: (project: Project | null, prev: Project | null) => void,
            options?: { equalityFn?: (a: unknown, b: unknown) => boolean },
        ) => () => void;
        setState: (partial: { historyCanUndo?: boolean; historyCanRedo?: boolean }) => void;
    },
): void {
    api.subscribe(
        (s) => s.project,
        (project, prev) => {
            if (isRestoring) return;
            if (gestureDepth > 0) return; // se captura una sola vez al cerrar el gesto
            if (prev === null) return; // nada previo a lo que volver (carga inicial)
            undoStack.push(prev);
            if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
            redoStack = [];
            api.setState({ historyCanUndo: true, historyCanRedo: false });
        },
    );
}
