import { IfcAPI } from 'web-ifc';

/**
 * Fase 19 del plan maestro ("BIM/IFC" — importar y mapear estructura
 * espacial, primer ciclo). Wrapper delgado sobre `web-ifc` (`IfcAPI`) — sin
 * lógica de dominio, solo el ciclo de vida abrir/cerrar. Verificado por
 * spike (2026-08-05) que `web-ifc` inicializa y parsea correctamente bajo
 * Vitest/Node (import ESM, no solo `require`) antes de construir el resto
 * del pipeline.
 */

export async function createIfcApi(): Promise<IfcAPI> {
    const api = new IfcAPI();
    // En navegador, `web-ifc` resuelve su `.wasm` vía `fetch` en runtime, no
    // vía el bundler — `vite.config.ts` lo copia a `public/wasm/` (mismo
    // problema ya resuelto para los workers de `@mlightcad`). En Node
    // (Vitest) el paquete ya resuelve `web-ifc-node.wasm` por su cuenta vía
    // el sistema de archivos — llamar `SetWasmPath` ahí no es necesario y
    // se evita explícitamente.
    if (typeof window !== 'undefined') {
        api.SetWasmPath('/wasm/', true);
    }
    // `forceSingleThread: true` — evita depender de `web-ifc-mt.wasm`
    // (requiere cabeceras COOP/COEP para SharedArrayBuffer, no configuradas
    // en este proyecto).
    await api.Init(undefined, true);
    return api;
}

export function openIfcModel(api: IfcAPI, data: Uint8Array): number {
    return api.OpenModel(data);
}

export function closeIfcModel(api: IfcAPI, modelId: number): void {
    api.CloseModel(modelId);
}
