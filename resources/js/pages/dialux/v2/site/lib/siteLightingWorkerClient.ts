import { calculateSiteLighting, type SiteLightingCalculation } from '../domain/siteLightingCalculation';
import type { SiteData } from '../domain/types';
import siteLightingWorkerUrl from '../workers/siteLightingWorker?worker&url';
import type { SiteLightingWorkerRequest, SiteLightingWorkerResponse } from '../workers/siteLightingWorkerProtocol';
import type { LuminairePhotometry } from './luminaireCatalog';

/**
 * Cliente del worker de alumbrado exterior: UNA instancia por pestaña,
 * compartida por el 2D y el 3D (ambos usan `useSiteLightingCalculation`).
 * Si el navegador no puede crear el worker (o se cae), calcula en el hilo
 * principal como antes: nunca se pierde el cálculo, solo la fluidez.
 */
let worker: Worker | null = null;
let workerFailed = false;
const pending = new Map<string, { resolve: (result: SiteLightingCalculation) => void; reject: (error: Error) => void }>();

const requestId = () => `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function getWorker(): Worker | null {
    if (worker) return worker;
    if (workerFailed || typeof Worker === 'undefined' || typeof window === 'undefined') return null;
    try {
        // Mismo patrón que `useDialuxCalculationWorker`: un módulo blob local
        // (mismo origen) que importa el módulo real (Vite en dev, asset en build).
        const moduleUrl = new URL(siteLightingWorkerUrl, window.location.href).href;
        const blobUrl = URL.createObjectURL(
            new Blob([`import ${JSON.stringify(moduleUrl)};`], { type: 'text/javascript' }),
        );
        worker = new Worker(blobUrl, { type: 'module' });
        worker.onmessage = (event: MessageEvent<SiteLightingWorkerResponse>) => {
            const message = event.data;
            const request = pending.get(message.requestId);
            if (!request) return;
            pending.delete(message.requestId);
            if (message.type === 'result') request.resolve(message.result);
            else request.reject(new Error(message.message));
        };
        worker.onerror = (event: ErrorEvent) => {
            // Falla al cargar el módulo: se deja de usar y lo pendiente se rechaza
            // (quien llamó reintenta en el hilo principal).
            workerFailed = true;
            worker?.terminate();
            worker = null;
            for (const request of pending.values()) {
                request.reject(new Error(event.message || 'Error en el worker de alumbrado.'));
            }
            pending.clear();
        };
        return worker;
    } catch {
        workerFailed = true;
        return null;
    }
}

/** `calculateSiteLighting` fuera del hilo de la interfaz (con respaldo síncrono). */
export async function calculateSiteLightingAsync(
    site: SiteData,
    photometry: ReadonlyMap<number, LuminairePhotometry>,
    onlyAreaIds?: ReadonlySet<string>,
): Promise<SiteLightingCalculation> {
    const sync = () => calculateSiteLighting(site, photometry, onlyAreaIds);
    const target = getWorker();
    if (!target) return sync();
    const id = requestId();
    const message: SiteLightingWorkerRequest = {
        requestId: id,
        site,
        photometry: [...photometry.entries()],
        ...(onlyAreaIds ? { onlyAreaIds: [...onlyAreaIds] } : {}),
    };
    try {
        return await new Promise<SiteLightingCalculation>((resolve, reject) => {
            pending.set(id, { resolve, reject });
            target.postMessage(message);
        });
    } catch {
        return sync();
    }
}
