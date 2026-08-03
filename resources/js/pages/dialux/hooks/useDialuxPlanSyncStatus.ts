import { create } from 'zustand';

interface DialuxPlanSyncState {
    /** Escenas cuyo plano no se pudo sincronizar con el servidor. */
    failedSceneIds: string[];
}

/**
 * Store separado del useEditorStore principal: refleja fallos de
 * sincronización del plano (upload/link) para que la StatusBar avise en vez
 * de fallar en silencio con solo un console.warn — un plano que solo quedó
 * en el navegador nunca lo verá otra persona ni otro dispositivo.
 */
export const useDialuxPlanSyncStatusStore = create<DialuxPlanSyncState>(() => ({
    failedSceneIds: [],
}));

export function markDialuxPlanSyncFailed(sceneId: string): void {
    useDialuxPlanSyncStatusStore.setState((prev) => ({
        failedSceneIds: prev.failedSceneIds.includes(sceneId)
            ? prev.failedSceneIds
            : [...prev.failedSceneIds, sceneId],
    }));
}

export function markDialuxPlanSyncOk(sceneId: string): void {
    useDialuxPlanSyncStatusStore.setState((prev) => ({
        failedSceneIds: prev.failedSceneIds.filter((id) => id !== sceneId),
    }));
}
