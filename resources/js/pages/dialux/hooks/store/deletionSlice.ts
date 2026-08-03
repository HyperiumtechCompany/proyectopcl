import { analyzeDeletion, type DeletionAnalysis } from '@/pages/dialux/selection/deletionPolicy';
import type { EditorSlice } from './sliceTypes';
import { isElectricalItemVisible } from '@/pages/dialux/electrical/electricalLayerVisibility';

/**
 * deletionSlice.ts — Punto único de entrada para "eliminar objeto seleccionado".
 *
 * Todos los flujos de borrado del editor (tecla Delete, botón de la barra de
 * herramientas, panel de objetos) deben llamar a `requestDelete(id)` en vez de
 * `removeObject(id)` directamente. Así la política de protección de
 * contenedores (recintos/ambientes con hijos) se aplica sin importar desde
 * dónde se dispare el borrado.
 */
export interface DeletionSlice {
    /** Análisis pendiente de confirmación del usuario, o null si no hay ninguno */
    pendingDeletion: DeletionAnalysis | null;
    /** Punto único de entrada: borra directo si es seguro, o abre confirmación */
    requestDelete: (id: string) => void;
    /** Confirma la eliminación en cascada del contenedor pendiente + sus hijos */
    confirmPendingDeletion: () => void;
    cancelPendingDeletion: () => void;
}

export const createDeletionSlice: EditorSlice<DeletionSlice> = (set, get) => ({
    pendingDeletion: null,

    requestDelete: (id) => {
        const scene = get().activeScene();
        if (!scene) return;
        const ui = get().ui;
        if (!isElectricalItemVisible(scene, ui.electricalLayerVisibility, ui.hiddenElectricalIds, id)) return;
        const analysis = analyzeDeletion(scene, id);
        if (analysis.requiresConfirmation) {
            set({ pendingDeletion: analysis });
            return;
        }
        get().removeObject(id);
    },

    confirmPendingDeletion: () => {
        const analysis = get().pendingDeletion;
        if (!analysis) return;
        // Toda la cascada (hijos + contenedor) cuenta como UN solo paso de undo.
        get().beginHistoryGesture();
        for (const child of analysis.children) {
            get().removeObject(child.id);
        }
        get().removeObject(analysis.id);
        get().endHistoryGesture();
        set({ pendingDeletion: null });
    },

    cancelPendingDeletion: () => set({ pendingDeletion: null }),
});
