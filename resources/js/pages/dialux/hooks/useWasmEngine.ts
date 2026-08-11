import { useCallback, useState } from 'react';
import {
    parseDxfTextFallback,
    type ParsedDxfPayload,
} from './dxfFallbackParser';
import { useEditorStore } from './useEditorStore';
import type { DxfEntity, DxfExtents } from './useEditorStore';

export interface DialuxWasmModule {
    default?: (wasmUrl?: URL) => Promise<unknown> | unknown;
    init?: (wasmUrl?: URL) => Promise<unknown> | unknown;
    parse_dxf_web: (text: string) => string;
}

let wasmModule: DialuxWasmModule | null = null;
let wasmLoadFailed = false;

/** Devuelve el modulo WASM ya cargado sin disparar una carga nueva, o null si aun no esta listo. */
export function peekWasmModule(): DialuxWasmModule | null {
    return wasmModule;
}

/**
 * Carga (una sola vez, cacheada a nivel modulo) el parser DXF rico de
 * dialux-core. Exportado para que otros consumidores (ej. el exportador DXF,
 * que necesita el mismo parser para reconstruir el plano base de archivos
 * .dwg) compartan la MISMA instancia cacheada en vez de duplicar el loader.
 */
export async function loadWasmModule(): Promise<DialuxWasmModule | null> {
    if (wasmModule || wasmLoadFailed) return wasmModule;

    try {
        // Cache-busting: `public/dialux-core/pkg/*` no tiene nombres de
        // archivo con hash de contenido (a diferencia de los assets que
        // pasan por Vite), así que el navegador puede servir una copia
        // vieja del .wasm/.js indefinidamente sin que un simple reload lo
        // note -- ya causó un bug real donde un fix de parseo confirmado y
        // reconstruido seguía fallando en el navegador con el error viejo.
        // `v` se calcula una sola vez por sesión de pestaña (este módulo
        // solo carga el WASM una vez, cacheado en `wasmModule`), así que el
        // costo es un único fetch fresco por carga de página, no por
        // llamada.
        const cacheBust = `v=${Date.now()}`;

        // new Function bypasses Vite 7 static import analysis; file is served from public/ at runtime
        const _import = new Function('u', 'return import(u)') as (u: string) => Promise<DialuxWasmModule>;
        const loadedModule = await _import(`/dialux-core/pkg/dialux_core.js?${cacheBust}`);

        // El `.wasm` se resuelve internamente con `new URL('dialux_core_bg.wasm', import.meta.url)`,
        // que NO hereda el query string de arriba (la resolución de URLs
        // relativas descarta la query del base) -- hay que pasar la ruta
        // ya cache-busteada explícitamente para que el binario en sí
        // también se refresque, no solo el glue JS.
        const wasmUrl = new URL(`/dialux-core/pkg/dialux_core_bg.wasm?${cacheBust}`, window.location.origin);

        if (typeof loadedModule.default === 'function') {
            await loadedModule.default(wasmUrl);
        } else if (typeof loadedModule.init === 'function') {
            await loadedModule.init(wasmUrl);
        } else {
            throw new Error('El modulo WASM no expone default() ni init()');
        }

        wasmModule = loadedModule;
        return wasmModule;
    } catch (error) {
        wasmLoadFailed = true;
        console.warn(
            '[DXF] No se pudo cargar dialux-core/pkg; usando parser TypeScript de respaldo.',
            error,
        );
        return null;
    }
}

function scaleDxfEntities(entities: DxfEntity[], factor: number): DxfEntity[] {
    return entities.map((ent) => {
        const scaled = { ...ent };

        if ('x' in scaled && 'y' in scaled) {
            scaled.x = scaled.x * factor;
            scaled.y = scaled.y * factor;
        }
        if ('x1' in scaled && 'y1' in scaled) {
            scaled.x1 = scaled.x1 * factor;
            scaled.y1 = scaled.y1 * factor;
        }
        if ('x2' in scaled && 'y2' in scaled) {
            scaled.x2 = scaled.x2 * factor;
            scaled.y2 = scaled.y2 * factor;
        }
        if ('cx' in scaled && 'cy' in scaled) {
            scaled.cx = scaled.cx * factor;
            scaled.cy = scaled.cy * factor;
        }
        if ('r' in scaled && typeof scaled.r === 'number') {
            scaled.r = scaled.r * factor;
        }
        if ('width' in scaled && typeof scaled.width === 'number') {
            scaled.width = scaled.width * factor;
        }
        if ('height' in scaled && typeof scaled.height === 'number') {
            scaled.height = scaled.height * factor;
        }
        if ('major_x' in scaled && typeof scaled.major_x === 'number') {
            scaled.major_x = scaled.major_x * factor;
        }
        if ('major_y' in scaled && typeof scaled.major_y === 'number') {
            scaled.major_y = scaled.major_y * factor;
        }
        if (
            'control_points' in scaled &&
            Array.isArray(scaled.control_points)
        ) {
            scaled.control_points = scaled.control_points.map(
                (point: [number, number]) => [
                    point[0] * factor,
                    point[1] * factor,
                ],
            );
        }
        if ('vertices' in scaled && Array.isArray(scaled.vertices)) {
            scaled.vertices = scaled.vertices.map((point: [number, number]) => [
                point[0] * factor,
                point[1] * factor,
            ]);
        }
        if (
            'boundary_paths' in scaled &&
            Array.isArray(scaled.boundary_paths)
        ) {
            scaled.boundary_paths = scaled.boundary_paths.map(
                (path: [number, number][]) =>
                    path.map((point) => [point[0] * factor, point[1] * factor]),
            );
        }
        return scaled;
    });
}

function scaleDxfExtents(
    extents: Partial<DxfExtents>,
    factor: number,
): DxfExtents {
    return {
        min_x: (extents?.min_x ?? 0) * factor,
        min_y: (extents?.min_y ?? 0) * factor,
        max_x: (extents?.max_x ?? 0) * factor,
        max_y: (extents?.max_y ?? 0) * factor,
    };
}

export const useWasmEngine = () => {
    const store = useEditorStore();
    const [isParsing, setIsParsing] = useState(false);

    const parseDxf = useCallback(
        async (file: File, scaleFactor = 1) => {
            try {
                setIsParsing(true);

                const text = await file.text();
                const module = await loadWasmModule();
                const data: ParsedDxfPayload = module
                    ? JSON.parse(module.parse_dxf_web(text))
                    : parseDxfTextFallback(text);

                if (data.error) {
                    throw new Error(data.error);
                }

                const entities = Array.isArray(data.entities)
                    ? scaleDxfEntities(data.entities, scaleFactor)
                    : [];

                console.debug('[DXF] parse result', {
                    entities: entities.length,
                    min_x: data.min_x,
                    min_y: data.min_y,
                    max_x: data.max_x,
                    max_y: data.max_y,
                    scaleFactor,
                    engine: module ? 'wasm' : 'typescript-fallback',
                });

                store.setDxfData(
                    entities,
                    scaleDxfExtents(
                        {
                            min_x: data.min_x,
                            min_y: data.min_y,
                            max_x: data.max_x,
                            max_y: data.max_y,
                        },
                        scaleFactor,
                    ),
                    data.skipped_entity_types ?? null,
                );
            } catch (err: unknown) {
                console.error('Error al parsear el DXF:', err);
                const message = err instanceof Error ? err.message : '';
                alert(`No se pudo parsear el archivo DXF. ${message}`);
            } finally {
                setIsParsing(false);
            }
        },
        [store],
    );

    return {
        parseDxf,
        isParsing,
    };
};
