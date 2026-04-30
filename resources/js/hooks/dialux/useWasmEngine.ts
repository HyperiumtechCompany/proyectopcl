import { useState, useCallback } from 'react';
import { useEditorStore } from './useEditorStore';
import type { DxfEntity, DxfExtents } from './useEditorStore';

// Import dinámico de la librería wasm generada. 
// Vite soporta WebAssembly, pero usualmente requiere el plugin vite-plugin-wasm o 
// una carga asíncrona estándar con import().
interface DialuxWasmModule {
    default?: () => Promise<unknown> | unknown;
    init?: () => Promise<unknown> | unknown;
    parse_dxf_web: (text: string) => string;
}

interface ParsedDxfPayload {
    error?: string;
    entities?: DxfEntity[];
    min_x?: number;
    min_y?: number;
    max_x?: number;
    max_y?: number;
}

let wasmModule: DialuxWasmModule | null = null;

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
        if ('control_points' in scaled && Array.isArray(scaled.control_points)) {
            scaled.control_points = scaled.control_points.map((point: [number, number]) => [point[0] * factor, point[1] * factor]);
        }
        if ('vertices' in scaled && Array.isArray(scaled.vertices)) {
            scaled.vertices = scaled.vertices.map((point: [number, number]) => [point[0] * factor, point[1] * factor]);
        }
        if ('boundary_paths' in scaled && Array.isArray(scaled.boundary_paths)) {
            scaled.boundary_paths = scaled.boundary_paths.map((path: [number, number][]) =>
                path.map((point) => [point[0] * factor, point[1] * factor]),
            );
        }
        return scaled;
    });
}

function scaleDxfExtents(extents: Partial<DxfExtents>, factor: number): DxfExtents {
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

    const parseDxf = useCallback(async (file: File, scaleFactor = 1) => {
        try {
            setIsParsing(true);
            
            // Cargar el módulo WASM solo cuando sea necesario por primera vez
            if (!wasmModule) {
                // Asumimos que compilaremos a 'dialux-core/pkg' 
                // En un proyecto vite real, se ajusta al path correcto del build
                const loadedModule = await import('../../../../dialux-core/pkg/dialux_core.js');
                wasmModule = loadedModule;
                if (typeof loadedModule.default === 'function') {
                    await loadedModule.default();
                } else if (typeof loadedModule.init === 'function') {
                    await loadedModule.init();
                } else {
                    throw new Error('El módulo WASM no expone default() ni init()');
                }
            }

            if (!wasmModule) {
                throw new Error('El mÃ³dulo WASM no pudo inicializarse');
            }

            const text = await file.text();
            
            // Llamada a la función expuesta: #[wasm_bindgen] pub fn parse_dxf_web(...) -> String
            const resultJson = wasmModule.parse_dxf_web(text);
            const data = JSON.parse(resultJson) as ParsedDxfPayload;

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
            });

            // data = { entities: [...], min_x: ..., min_y: ..., max_x: ..., max_y: ... }
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
            );

        } catch (err: unknown) {
            console.error("Error al parsear el DXF:", err);
            const message = err instanceof Error ? err.message : '';
            alert("No se pudo parsear el archivo DXF. " + message);
        } finally {
            setIsParsing(false);
        }
    }, [store]);

    const rescaleDxfEntities = useCallback((currentFactor: number, newFactor: number) => {
        if (!(currentFactor > 0) || !(newFactor > 0)) return;
        const entities = store.dxfEntities;
        const extents = store.dxfExtents;
        if (!entities || !extents) return;

        const ratio = newFactor / currentFactor;
        store.setDxfData(
            scaleDxfEntities(entities, ratio),
            scaleDxfExtents(extents, ratio),
        );
    }, [store]);

    return {
        parseDxf,
        rescaleDxfEntities,
        isParsing,
    };
};
