import { useEffect, useState } from 'react';

/** Messages exchanged with the "Asistente del Cuaderno" browser extension. */
type ExtensionMessage =
    | {
          source: 'costos-cuaderno-extension';
          type: 'status';
          paired: boolean;
          version: string;
      }
    | {
          source: 'costos-cuaderno-extension';
          type: 'pair-error';
          message: string;
      };

const send = (message: Record<string, unknown>) =>
    window.postMessage(
        { ...message, source: 'costos-cuaderno-page' },
        window.location.origin,
    );

export const pairExtension = (codigo: string) => send({ type: 'pair', codigo });

/** Brings the holder's OECE tab to the front (opens it when missing). */
export const focusPortalTab = () => send({ type: 'focus' });

/**
 * The extension marks the page when installed (data-costos-cuaderno) and answers through
 * window messages. Pairing needs no code typed by the holder.
 */
export function useCuadernoExtension() {
    const [installed] = useState(
        () =>
            typeof document !== 'undefined' &&
            Boolean(document.documentElement.dataset.costosCuaderno),
    );
    const [paired, setPaired] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!installed) return;
        const listener = (event: MessageEvent<ExtensionMessage>) => {
            if (
                event.source !== window ||
                event.data?.source !== 'costos-cuaderno-extension'
            )
                return;
            if (event.data.type === 'status') {
                setPaired(event.data.paired);
                if (event.data.paired) setError(null);
            }
            if (event.data.type === 'pair-error') setError(event.data.message);
        };
        window.addEventListener('message', listener);
        send({ type: 'status' });
        return () => window.removeEventListener('message', listener);
    }, [installed]);

    return { installed, paired, error };
}
