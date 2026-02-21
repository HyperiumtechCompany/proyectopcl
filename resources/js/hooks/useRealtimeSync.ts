import { useEffect, useRef, useState } from 'react';
import type { ATSRow, SelectionData, TableRowNode, TGRow, TGTableRow } from '@/types/caida-tension';

export interface RemoteUpdate {
    td_data: TableRowNode[];
    tg_data: { flattenedData: TGRow[]; atsData: ATSRow[]; tgData: TGTableRow[] };
    selection_data: SelectionData;
    updated_by: number;
    updated_by_name: string;
    updated_at: string;
}

interface UseRealtimeSyncOptions {
    spreadsheetId: number;
    /** ID del usuario actual — para ignorar los propios eventos (ya manejados por el save) */
    currentUserId: number;
    /** Callback cuando llega una actualización remota */
    onRemoteUpdate: (update: RemoteUpdate) => void;
    /** Si el spreadsheet no es colaborativo, no conecta */
    isCollaborative: boolean;
    /** Prefijo del canal (por defecto 'spreadsheet.') */
    channelPrefix?: string;
}

/**
 * useRealtimeSync
 *
 * Suscribe al canal privado `spreadsheet.{id}` via Laravel Echo (Reverb/Pusher).
 * Cuando otro colaborador guarda, llega el evento 'spreadsheet.updated' con
 * el estado completo. Se aplica al estado local sin recargar la página.
 *
 * Requiere que `window.Echo` esté configurado (ver bootstrap/echo.ts).
 */
export function useRealtimeSync({
    spreadsheetId,
    currentUserId,
    onRemoteUpdate,
    isCollaborative,
    channelPrefix,
}: UseRealtimeSyncOptions) {
    const [lastEditorName, setLastEditorName] = useState<string | null>(null);
    const [remoteUpdateCount, setRemoteUpdateCount] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!isCollaborative) return;

        // window.Echo se configura en resources/js/bootstrap.ts
        if (typeof window === 'undefined' || !('Echo' in window)) {
            console.warn('[useRealtimeSync] Laravel Echo no está inicializado.');
            return;
        }

        const channelName = `${channelPrefix || 'spreadsheet.'}${spreadsheetId}`;
        const channel = (window as any).Echo.private(channelName);

        channelRef.current = channel;

        // Si el evento viene con . inicial, Echo le agrega el namespace App\Events
        // Pero si es channelPrefix custom, asume que el evento emitido coincide con el BroadcastAs
        // Asumimos que escucha el predeterminado de CaidaTension (SpreadsheetUpdated -> .spreadsheet.updated)
        // O si no, si le pasamos channelPrefix, el broadcastAs puede ser 'AcCalculationUpdated'
        // Lo más seguro es que el event listener se parametrice también. 
        // Para no romper lo existente, si hay channelPrefix === 'ac-calculation.', escuchamos '.AcCalculationUpdated'.
        const eventName = channelPrefix === 'ac-calculation.' ? '.AcCalculationUpdated' : '.spreadsheet.updated';

        channel.listen(eventName, (payload: RemoteUpdate) => {
            // Ignorar los propios envíos (redundante con toOthers() del backend, pero como seguridad extra)
            if (payload.updated_by === currentUserId) return;

            setLastEditorName(payload.updated_by_name);
            setRemoteUpdateCount((c) => c + 1);
            onRemoteUpdate(payload);

            // Ocultar el indicador después de 5 segundos
            setTimeout(() => setLastEditorName(null), 5000);
        });

        return () => {
            channel.stopListening(eventName);
            (window as any).Echo.leave(channelName);
            channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spreadsheetId, currentUserId, isCollaborative, channelPrefix]);

    return { lastEditorName, remoteUpdateCount };
}
