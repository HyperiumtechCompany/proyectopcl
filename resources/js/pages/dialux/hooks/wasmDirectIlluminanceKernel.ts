import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import type { DirectIlluminanceBatchKernel, SurfacePoint } from './directIlluminance';
import type { Fixture } from './types';

/**
 * Carga perezosa del kernel WASM por lotes de la Fase 12
 * (`dialux-core::compute_direct_illuminance_grid`, ver `dialux-core/src/direct_illuminance.rs`).
 * Mismo patrón exacto que `useWasmEngine.ts` (DXF, Fase 3): módulo cacheado
 * a nivel de archivo, `new Function('u','return import(u)')` para esquivar
 * el análisis estático de Vite sobre una URL de runtime servida desde
 * `public/` (`npm run wasm:build` la genera en `public/dialux-core/pkg/`).
 * Si el build wasm no existe en el checkout (nunca se corrió
 * `npm run wasm:build`) o falla al cargar, `ensureWasmDirectIlluminanceKernel`
 * devuelve `null` — el llamador (el worker de cálculo) cae al bucle TS
 * puro existente, nunca bloquea ni rompe el cálculo.
 */
interface DialuxCoreWasmModule {
    default?: () => Promise<unknown> | unknown;
    init?: () => Promise<unknown> | unknown;
    compute_direct_illuminance_grid: (pointsJson: string, fixturesJson: string, obstaclesJson: string) => string;
}

let wasmModule: DialuxCoreWasmModule | null = null;
let wasmLoadFailed = false;

async function loadWasmModule(): Promise<DialuxCoreWasmModule | null> {
    if (wasmModule || wasmLoadFailed) {
        return wasmModule;
    }

    try {
        const _import = new Function('u', 'return import(u)') as (u: string) => Promise<DialuxCoreWasmModule>;
        const loadedModule = await _import('/dialux-core/pkg/dialux_core.js');

        if (typeof loadedModule.default === 'function') {
            await loadedModule.default();
        } else if (typeof loadedModule.init === 'function') {
            await loadedModule.init();
        } else {
            throw new Error('El modulo WASM no expone default() ni init()');
        }

        wasmModule = loadedModule;
        return wasmModule;
    } catch (error) {
        wasmLoadFailed = true;
        console.warn(
            '[Dialux] No se pudo cargar el kernel WASM de iluminancia directa; se usa el motor TS puro.',
            error,
        );
        return null;
    }
}

/**
 * Único punto de entrada real. Devuelve `null` si el módulo WASM no está
 * disponible en este entorno — nunca lanza.
 */
export async function ensureWasmDirectIlluminanceKernel(): Promise<DirectIlluminanceBatchKernel | null> {
    const module = await loadWasmModule();
    if (!module) {
        return null;
    }

    return (points: SurfacePoint[], fixtures: Fixture[], obstacles: OcclusionBox[]): number[] => {
        const raw = module.compute_direct_illuminance_grid(
            JSON.stringify(points),
            JSON.stringify(fixtures),
            JSON.stringify(obstacles),
        );
        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            throw new Error(`compute_direct_illuminance_grid devolvió un error: ${raw}`);
        }

        return parsed as number[];
    };
}
