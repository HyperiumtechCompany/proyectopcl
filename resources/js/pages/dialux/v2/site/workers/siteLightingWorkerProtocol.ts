import type { SiteLightingCalculation } from '../domain/siteLightingCalculation';
import type { SiteData } from '../domain/types';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';

/** Mensajes hilo principal ↔ worker del cálculo de alumbrado exterior. */
export interface SiteLightingWorkerRequest {
    requestId: string;
    site: SiteData;
    /** `Map` no es clonable en todos los navegadores de forma fiable: pares [id, fotometría]. */
    photometry: Array<[number, LuminairePhotometry]>;
    onlyAreaIds?: string[];
}

export type SiteLightingWorkerResponse =
    | { type: 'result'; requestId: string; result: SiteLightingCalculation }
    | { type: 'error'; requestId: string; message: string };
