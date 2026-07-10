import { create } from 'zustand';

export type DialuxSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface DialuxSaveStatusState {
    status: DialuxSaveStatus;
    savedAt: string | null;
}

/**
 * Store separado del useEditorStore principal: solo refleja el estado del
 * autosave (useDialuxProjectSync) para que la StatusBar lo muestre sin
 * acoplarse al store grande del editor.
 */
export const useDialuxSaveStatusStore = create<DialuxSaveStatusState>(() => ({
    status: 'idle',
    savedAt: null,
}));

export function setDialuxSaveStatus(status: DialuxSaveStatus): void {
    useDialuxSaveStatusStore.setState((prev) => ({
        status,
        savedAt: status === 'saved' ? new Date().toISOString() : prev.savedAt,
    }));
}
