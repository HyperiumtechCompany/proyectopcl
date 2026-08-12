import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { parseDxfTextFallback, type ParsedDxfPayload } from './dxfFallbackParser';
import type { DxfEntity, DxfExtents } from './types';
import type { ScaleConfig } from './useEditorStore';
import type { DialuxWasmModule } from './useWasmEngine';

/**
 * Cuenta marcadores de entidad (código 0 seguido de un nombre de tipo)
 * dentro de la sección ENTITIES del texto DXF crudo, sin pasar por ningún
 * parser propio -- sirve para aislar si el vacío viene de `dxfOut()` (el
 * texto ya no trae nada) o de nuestro parser (el texto sí trae entidades
 * pero no logramos extraerlas).
 */
function countRawEntitiesInSection(dxfText: string): number {
    const lines = dxfText.split(/\r\n|\r|\n/);
    let inEntities = false;
    let count = 0;
    for (let i = 0; i < lines.length - 1; i += 1) {
        const code = lines[i].trim();
        const value = lines[i + 1].trim();
        if (code === '0' && value === 'SECTION') {
            const nextValue = lines[i + 3]?.trim();
            inEntities = nextValue === 'ENTITIES';
            continue;
        }
        if (code === '0' && value === 'ENDSEC') {
            inEntities = false;
            continue;
        }
        if (inEntities && code === '0' && value.length > 0) {
            count += 1;
        }
    }
    return count;
}

export interface EngineEntitiesResult {
    entities: DxfEntity[];
    extents: DxfExtents | null;
    skippedEntityTypes: Record<string, number> | null;
}

/**
 * Scale DXF entity coordinates from CAD units to metres.
 * Mirrors the private scaleDxfEntities in useWasmEngine.ts.
 */
export function scaleDxfEntities(entities: DxfEntity[], factor: number): DxfEntity[] {
    if (factor === 1) return entities;
    return entities.map((ent) => {
        const s = { ...ent } as Record<string, unknown>;
        const scl = (k: string) => {
            if (k in s && typeof s[k] === 'number') s[k] = (s[k] as number) * factor;
        };
        const sclArr = (k: string) => {
            if (k in s && Array.isArray(s[k])) {
                s[k] = (s[k] as [number, number][]).map(
                    ([a, b]: [number, number]) => [a * factor, b * factor],
                );
            }
        };
        ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
            'width', 'height', 'major_x', 'major_y'].forEach(scl);
        ['vertices', 'control_points'].forEach(sclArr);
        if ('boundary_paths' in s && Array.isArray(s['boundary_paths'])) {
            s['boundary_paths'] = (s['boundary_paths'] as [number, number][][]).map(
                (path) => path.map(([a, b]) => [a * factor, b * factor]),
            );
        }
        return s as unknown as DxfEntity;
    });
}

/**
 * Extrae las entidades DXF del documento actualmente cargado en el motor
 * mlightcad, volcándolo a texto DXF (`database.dxfOut()`) y re-parseándolo
 * con el parser rico de `dialux-core` (WASM) si ya está cargado, o el
 * fallback TS limitado si no.
 *
 * Es el ÚNICO camino viable para archivos `.dwg`: `parseDxf` (useWasmEngine)
 * asume texto DXF (`file.text()`), y llamarlo sobre un `.dwg` binario
 * corrompería el contenido -- el motor mlightcad sí sabe leer DWG binario
 * (`engine.openFile`), así que se reusa SU documento ya parseado en vez de
 * reparsear el archivo original nosotros mismos.
 *
 * Se usa en dos puntos que DEBEN coincidir en comportamiento (por eso viven
 * en un solo lugar compartido):
 *   1. Auto-restauración del plano al abrir/cambiar de escena
 *      (`MlightcadCanvas2D.tsx`) -- puebla `state.dxfEntities` de una vez,
 *      para que detección de escala y exportación DXF tengan datos reales
 *      sin depender de un fallback tardío.
 *   2. Fallback de exportación (`useDialuxDxfExport.ts`) cuando
 *      `state.dxfEntities` sigue vacío por cualquier motivo (defensa en
 *      profundidad, no debería ser el camino principal).
 *
 * Devuelve entidades ya escaladas a metros según `scaleConfig`.
 */
export function extractDxfEntitiesFromEngineDocument(
    scaleConfig: ScaleConfig,
    wasmModule: DialuxWasmModule | null,
): EngineEntitiesResult {
    const empty: EngineEntitiesResult = { entities: [], extents: null, skippedEntityTypes: null };
    try {
        const curDocument = AcApDocManager.instance?.curDocument;
        const db = curDocument?.database as unknown as (Record<string, unknown> | undefined);
        console.log('[DXF base] diag: curDocument existe =', !!curDocument,
            '| curDocument.fileName =', (curDocument as unknown as Record<string, unknown> | undefined)?.['fileName'],
            '| curDocument.docTitle =', (curDocument as unknown as Record<string, unknown> | undefined)?.['docTitle'],
            '| db existe =', !!db,
            '| db.dxfOut es funcion =', !!db && typeof db['dxfOut'] === 'function');

        if (!db || typeof db['dxfOut'] !== 'function') {
            console.warn('[DXF base] diag: abortando -- no hay db o dxfOut no es función.');
            return empty;
        }

        const dxfText = (db['dxfOut'] as () => unknown)() as string;
        console.log('[DXF base] diag: dxfOut() devolvió tipo =', typeof dxfText,
            '| longitud =', typeof dxfText === 'string' ? dxfText.length : 'n/a',
            '| primeros 200 chars =', typeof dxfText === 'string' ? dxfText.slice(0, 200) : dxfText);
        if (typeof dxfText !== 'string' || dxfText.length < 20) {
            console.warn('[DXF base] diag: abortando -- dxfText inválido o demasiado corto.');
            return empty;
        }
        console.log('[DXF base] diag: marcadores de entidad crudos en sección ENTITIES (sin pasar por ningún parser) =',
            countRawEntitiesInSection(dxfText));

        console.log('[DXF base] diag: wasmModule cargado =', !!wasmModule,
            '| usando', wasmModule ? 'parser WASM rico' : 'fallback JS');
        const parsed: ParsedDxfPayload = wasmModule
            ? JSON.parse(wasmModule.parse_dxf_web(dxfText))
            : parseDxfTextFallback(dxfText);
        console.log('[DXF base] diag: parsed.error =', parsed.error,
            '| parsed.entities?.length =', parsed.entities?.length,
            '| skipped_entity_types =', parsed.skipped_entity_types);
        const entities: DxfEntity[] = Array.isArray(parsed.entities) ? parsed.entities : [];
        if (entities.length === 0) {
            console.warn('[DXF base] diag: abortando -- 0 entidades tras parsear.', {
                parseError: parsed.error,
                skippedEntityTypes: parsed.skipped_entity_types,
            });
            return {
                ...empty,
                skippedEntityTypes: parsed.skipped_entity_types && Object.keys(parsed.skipped_entity_types).length > 0
                    ? parsed.skipped_entity_types
                    : null,
            };
        }

        const effectiveScale =
            (scaleConfig.factor ?? 1) * (scaleConfig.calibrationFactor ?? 1);
        const extents: DxfExtents = {
            min_x: (parsed.min_x ?? 0) * effectiveScale,
            min_y: (parsed.min_y ?? 0) * effectiveScale,
            max_x: (parsed.max_x ?? 0) * effectiveScale,
            max_y: (parsed.max_y ?? 0) * effectiveScale,
        };
        return {
            entities: scaleDxfEntities(entities, effectiveScale),
            extents,
            skippedEntityTypes: parsed.skipped_entity_types && Object.keys(parsed.skipped_entity_types).length > 0
                ? parsed.skipped_entity_types
                : null,
        };
    } catch (e) {
        console.warn('[DXF] No se pudo leer el documento del motor mlightcad:', e);
        return empty;
    }
}
