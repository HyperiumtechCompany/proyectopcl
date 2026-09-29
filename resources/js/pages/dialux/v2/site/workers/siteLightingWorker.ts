import { calculateSiteLighting } from '../domain/siteLightingCalculation';
import type { SiteLightingWorkerRequest, SiteLightingWorkerResponse } from './siteLightingWorkerProtocol';

/**
 * Worker del cálculo luminotécnico EXTERIOR ("Calcular alumbrado" de la
 * planta, fase C4 de `plan_conexion_edificio_modulo_caida_tension.md`): corre
 * `calculateSiteLighting` (motor V1 punto a punto, ~100 ms con el proyecto 9)
 * fuera del hilo de la interfaz. Mismo código que el cálculo síncrono: el
 * resultado es idéntico.
 */
function post(message: SiteLightingWorkerResponse): void {
    (self as unknown as { postMessage: (message: SiteLightingWorkerResponse) => void }).postMessage(message);
}

self.onmessage = (event: MessageEvent<SiteLightingWorkerRequest>) => {
    const { requestId, site, photometry, onlyAreaIds } = event.data;
    try {
        const result = calculateSiteLighting(
            site,
            new Map(photometry),
            onlyAreaIds ? new Set(onlyAreaIds) : undefined,
        );
        post({ type: 'result', requestId, result });
    } catch (error) {
        post({ type: 'error', requestId, message: error instanceof Error ? error.message : String(error) });
    }
};
