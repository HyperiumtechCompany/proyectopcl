import type { StateCreator } from 'zustand';
import type { EditorState } from '../useEditorStore';

/**
 * Helper de tipo para slices de Zustand: cada slice recibe el `set`/`get` completo
 * del store combinado (no aislado), tal como exige el patrón oficial de slices —
 * así las acciones que cruzan dominios (ej. `get().activeScene()` desde otro slice)
 * siguen funcionando exactamente igual que en el store monolítico original.
 */
export type EditorSlice<T> = StateCreator<
    EditorState,
    [['zustand/subscribeWithSelector', never]],
    [],
    T
>;
