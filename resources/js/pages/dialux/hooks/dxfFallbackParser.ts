import type { DxfEntity, DxfExtents } from './useEditorStore';
import { stripMTextFormatting } from './mtextFormatting';

export interface ParsedDxfPayload {
    error?: string;
    entities?: DxfEntity[];
    min_x?: number;
    min_y?: number;
    max_x?: number;
    max_y?: number;
}

export interface DetectedDxfUnit {
    unit: 'mm' | 'cm' | 'm';
    factor: number;
    displayUnit: string;
}

/** Códigos $INSUNITS del estándar DXF que mapean exactamente a las unidades soportadas (mm/cm/m). */
const INSUNITS_TO_SCALE: Partial<Record<number, DetectedDxfUnit>> = {
    4: { unit: 'mm', factor: 0.001, displayUnit: 'Milímetros (detectado del DXF: $INSUNITS)' },
    5: { unit: 'cm', factor: 0.01, displayUnit: 'Centímetros (detectado del DXF: $INSUNITS)' },
    6: { unit: 'm', factor: 1, displayUnit: 'Metros (detectado del DXF: $INSUNITS)' },
};

/**
 * Lee la variable de cabecera $INSUNITS del DXF (unidad de dibujo declarada por el CAD de origen).
 * Devuelve null si el archivo no la declara o usa una unidad no métrica (ej. pulgadas/pies),
 * en cuyo caso el heurístico basado en extents debe decidir.
 */
export function detectDxfUnitFromHeader(text: string): DetectedDxfUnit | null {
    const pairs = readPairs(text);
    let inHeaderSection = false;

    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        const next = pairs[i + 1];

        if (pair.code === 0 && pair.value === 'SECTION' && next?.code === 2) {
            inHeaderSection = next.value.toUpperCase() === 'HEADER';
            continue;
        }
        if (pair.code === 0 && pair.value === 'ENDSEC') {
            if (inHeaderSection) break;
            continue;
        }
        if (!inHeaderSection) continue;

        if (pair.code === 9 && pair.value.toUpperCase() === '$INSUNITS') {
            const valuePair = pairs[i + 1];
            const code = valuePair ? Number.parseInt(valuePair.value, 10) : NaN;
            return Number.isFinite(code) ? (INSUNITS_TO_SCALE[code] ?? null) : null;
        }
    }

    return null;
}

type DxfPair = {
    code: number;
    value: string;
};

type MutableBounds = {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
    touched: boolean;
};

function readPairs(text: string): DxfPair[] {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const pairs: DxfPair[] = [];

    for (let i = 0; i < lines.length - 1; i += 2) {
        const code = Number.parseInt(lines[i].trim(), 10);
        if (!Number.isFinite(code)) continue;
        pairs.push({ code, value: lines[i + 1].trim() });
    }

    return pairs;
}

function num(value: string | undefined, fallback = 0): number {
    if (value === undefined) return fallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function updateBounds(bounds: MutableBounds, x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bounds.touched = true;
    bounds.min_x = Math.min(bounds.min_x, x);
    bounds.min_y = Math.min(bounds.min_y, y);
    bounds.max_x = Math.max(bounds.max_x, x);
    bounds.max_y = Math.max(bounds.max_y, y);
}

function updateCircleBounds(
    bounds: MutableBounds,
    cx: number,
    cy: number,
    radius: number,
): void {
    updateBounds(bounds, cx - radius, cy - radius);
    updateBounds(bounds, cx + radius, cy + radius);
}

function finalizeBounds(bounds: MutableBounds): DxfExtents {
    if (!bounds.touched) {
        return { min_x: 0, min_y: 0, max_x: 0, max_y: 0 };
    }

    return {
        min_x: bounds.min_x,
        min_y: bounds.min_y,
        max_x: bounds.max_x,
        max_y: bounds.max_y,
    };
}

function collectEntityPairs(
    pairs: DxfPair[],
    start: number,
): [DxfPair[], number] {
    const entityPairs: DxfPair[] = [];
    let i = start + 1;

    for (; i < pairs.length; i += 1) {
        const pair = pairs[i];
        if (pair.code === 0) break;
        entityPairs.push(pair);
    }

    return [entityPairs, i];
}

function valueFor(entityPairs: DxfPair[], code: number): string | undefined {
    return entityPairs.find((pair) => pair.code === code)?.value;
}

/** Todos los valores de un código de grupo, en orden — MTEXT reparte el texto largo (>250 caracteres) en varios pares de código 3 antes del código 1 final. */
function valuesFor(entityPairs: DxfPair[], code: number): string[] {
    return entityPairs.filter((pair) => pair.code === code).map((pair) => pair.value);
}

function layerFor(entityPairs: DxfPair[]): string {
    return valueFor(entityPairs, 8) ?? '0';
}

export function parseDxfTextFallback(text: string): ParsedDxfPayload {
    const pairs = readPairs(text);
    const entities: DxfEntity[] = [];
    const bounds: MutableBounds = {
        min_x: Number.POSITIVE_INFINITY,
        min_y: Number.POSITIVE_INFINITY,
        max_x: Number.NEGATIVE_INFINITY,
        max_y: Number.NEGATIVE_INFINITY,
        touched: false,
    };

    let inEntitiesSection = false;
    let inBlocksSection = false;
    let idCounter = 0;

    const nextId = () => {
        idCounter += 1;
        return `dxf_ts_${idCounter}`;
    };

    const blocks = new Map<string, { name: string; x: number; y: number; entities: any[] }>();
    let currentBlock: { name: string; x: number; y: number; entities: any[] } | null = null;
    const rawEntities: any[] = [];

    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        const next = pairs[i + 1];

        if (pair.code === 0 && pair.value === 'SECTION' && next?.code === 2) {
            const sectionName = next.value.toUpperCase();
            inEntitiesSection = sectionName === 'ENTITIES';
            inBlocksSection = sectionName === 'BLOCKS';
            continue;
        }

        if (pair.code === 0 && pair.value === 'ENDSEC') {
            inEntitiesSection = false;
            inBlocksSection = false;
            continue;
        }

        if (!inEntitiesSection && !inBlocksSection) continue;
        if (pair.code !== 0) continue;

        const type = pair.value.toUpperCase();
        const [entityPairs, nextIndex] = collectEntityPairs(pairs, i);
        i = nextIndex - 1;

        if (inBlocksSection && type === 'BLOCK') {
            currentBlock = {
                name: valueFor(entityPairs, 2) ?? '',
                x: num(valueFor(entityPairs, 10)),
                y: num(valueFor(entityPairs, 20)),
                entities: [],
            };
            continue;
        }
        if (inBlocksSection && type === 'ENDBLK') {
            if (currentBlock && currentBlock.name) {
                blocks.set(currentBlock.name, currentBlock);
            }
            currentBlock = null;
            continue;
        }

        let parsedEntity: any = null;

        if (type === 'LINE') {
            parsedEntity = {
                id: nextId(),
                type: 'line',
                x1: num(valueFor(entityPairs, 10)),
                y1: num(valueFor(entityPairs, 20)),
                x2: num(valueFor(entityPairs, 11)),
                y2: num(valueFor(entityPairs, 21)),
                layer: layerFor(entityPairs),
            };
        } else if (type === 'LWPOLYLINE') {
            const vertices: [number, number][] = [];
            let pendingX: number | null = null;

            for (const entityPair of entityPairs) {
                if (entityPair.code === 10) {
                    pendingX = num(entityPair.value);
                } else if (entityPair.code === 20 && pendingX !== null) {
                    vertices.push([pendingX, num(entityPair.value)]);
                    pendingX = null;
                }
            }

            if (vertices.length > 0) {
                parsedEntity = {
                    id: nextId(),
                    type: 'polyline',
                    vertices,
                    closed: (num(valueFor(entityPairs, 70)) & 1) === 1,
                    layer: layerFor(entityPairs),
                };
            }
        } else if (type === 'POLYLINE') {
            const layer = layerFor(entityPairs);
            const vertices: [number, number][] = [];
            const closed = (num(valueFor(entityPairs, 70)) & 1) === 1;

            for (let j = nextIndex; j < pairs.length; j += 1) {
                if (pairs[j].code !== 0) continue;
                if (pairs[j].value.toUpperCase() === 'SEQEND') {
                    i = j;
                    break;
                }
                if (pairs[j].value.toUpperCase() !== 'VERTEX') continue;

                const [vertexPairs, vertexEnd] = collectEntityPairs(pairs, j);
                vertices.push([
                    num(valueFor(vertexPairs, 10)),
                    num(valueFor(vertexPairs, 20)),
                ]);
                j = vertexEnd - 1;
            }

            if (vertices.length > 0) {
                parsedEntity = {
                    id: nextId(),
                    type: 'polyline',
                    vertices,
                    closed,
                    layer,
                };
            }
        } else if (type === 'CIRCLE' || type === 'ARC') {
            const cx = num(valueFor(entityPairs, 10));
            const cy = num(valueFor(entityPairs, 20));
            const r = Math.max(0, num(valueFor(entityPairs, 40)));

            if (type === 'CIRCLE') {
                parsedEntity = {
                    id: nextId(),
                    type: 'circle',
                    cx,
                    cy,
                    r,
                    layer: layerFor(entityPairs),
                };
            } else {
                parsedEntity = {
                    id: nextId(),
                    type: 'arc',
                    cx,
                    cy,
                    r,
                    start_angle: num(valueFor(entityPairs, 50)),
                    end_angle: num(valueFor(entityPairs, 51)),
                    layer: layerFor(entityPairs),
                };
            }
        } else if (type === 'TEXT' || type === 'MTEXT') {
            const rawText = type === 'MTEXT'
                ? [...valuesFor(entityPairs, 3), valueFor(entityPairs, 1) ?? ''].join('')
                : valueFor(entityPairs, 1) ?? '';
            parsedEntity = {
                id: nextId(),
                type: 'text',
                x: num(valueFor(entityPairs, 10)),
                y: num(valueFor(entityPairs, 20)),
                text: type === 'MTEXT' ? stripMTextFormatting(rawText) : rawText,
                height: num(valueFor(entityPairs, 40), 1),
                rotation: num(valueFor(entityPairs, 50)),
                layer: layerFor(entityPairs),
            };
        } else if (type === 'POINT') {
            parsedEntity = {
                id: nextId(),
                type: 'point',
                x: num(valueFor(entityPairs, 10)),
                y: num(valueFor(entityPairs, 20)),
                layer: layerFor(entityPairs),
            };
        } else if (type === 'INSERT') {
            parsedEntity = {
                id: nextId(),
                type: 'insert',
                blockName: valueFor(entityPairs, 2) ?? '',
                x: num(valueFor(entityPairs, 10)),
                y: num(valueFor(entityPairs, 20)),
                scaleX: num(valueFor(entityPairs, 41), 1),
                scaleY: num(valueFor(entityPairs, 42), 1),
                rotation: num(valueFor(entityPairs, 50), 0),
                layer: layerFor(entityPairs),
            };
        }

        if (parsedEntity) {
            if (currentBlock) {
                currentBlock.entities.push(parsedEntity);
            } else if (inEntitiesSection) {
                rawEntities.push(parsedEntity);
            }
        }
    }

    // Matrix utilities for recursive insert flattening
    type Matrix = [number, number, number, number, number, number];
    const identity: Matrix = [1, 0, 0, 1, 0, 0];
    const multiply = (m1: Matrix, m2: Matrix): Matrix => [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
    const translate = (tx: number, ty: number): Matrix => [1, 0, 0, 1, tx, ty];
    const scale = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];
    const rotate = (deg: number): Matrix => {
        const rad = (deg * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return [c, s, -s, c, 0, 0];
    };
    const applyTransform = (m: Matrix, x: number, y: number) => ({
        x: m[0] * x + m[2] * y + m[4],
        y: m[1] * x + m[3] * y + m[5],
    });

    const explodeEntity = (entity: any, parentMatrix: Matrix, fallbackLayer: string): void => {
        const layer = entity.layer === '0' ? fallbackLayer : (entity.layer || fallbackLayer);

        if (entity.type === 'insert') {
            const block = blocks.get(entity.blockName);
            if (!block) return;
            const m1 = translate(-block.x, -block.y);
            const m2 = scale(entity.scaleX, entity.scaleY);
            const m3 = rotate(entity.rotation);
            const m4 = translate(entity.x, entity.y);
            const insertMatrix = multiply(parentMatrix, multiply(m4, multiply(m3, multiply(m2, m1))));
            for (const child of block.entities) {
                explodeEntity(child, insertMatrix, layer);
            }
            return;
        }

        const outEntity: any = { ...entity, id: nextId(), layer };

        if (entity.type === 'line') {
            const p1 = applyTransform(parentMatrix, entity.x1, entity.y1);
            const p2 = applyTransform(parentMatrix, entity.x2, entity.y2);
            outEntity.x1 = p1.x; outEntity.y1 = p1.y;
            outEntity.x2 = p2.x; outEntity.y2 = p2.y;
            updateBounds(bounds, p1.x, p1.y);
            updateBounds(bounds, p2.x, p2.y);
        } else if (entity.type === 'polyline') {
            outEntity.vertices = entity.vertices.map((v: [number, number]) => {
                const p = applyTransform(parentMatrix, v[0], v[1]);
                updateBounds(bounds, p.x, p.y);
                return [p.x, p.y];
            });
        } else if (entity.type === 'circle' || entity.type === 'arc') {
            const p = applyTransform(parentMatrix, entity.cx, entity.cy);
            outEntity.cx = p.x;
            outEntity.cy = p.y;
            // Scale radius (assuming uniform scale for simplicity)
            const sx = Math.sqrt(parentMatrix[0] * parentMatrix[0] + parentMatrix[1] * parentMatrix[1]);
            outEntity.r = entity.r * sx;
            updateCircleBounds(bounds, outEntity.cx, outEntity.cy, outEntity.r);

            if (entity.type === 'arc') {
                // Approximate angle rotation (doesn't handle negative scale correctly, but good enough for fallback)
                const rotDeg = Math.atan2(parentMatrix[1], parentMatrix[0]) * 180 / Math.PI;
                outEntity.start_angle = entity.start_angle + rotDeg;
                outEntity.end_angle = entity.end_angle + rotDeg;
            }
        } else if (entity.type === 'text' || entity.type === 'point') {
            const p = applyTransform(parentMatrix, entity.x, entity.y);
            outEntity.x = p.x;
            outEntity.y = p.y;
            updateBounds(bounds, p.x, p.y);
            if (entity.type === 'text') {
                const rotDeg = Math.atan2(parentMatrix[1], parentMatrix[0]) * 180 / Math.PI;
                outEntity.rotation = (entity.rotation || 0) + rotDeg;
                const sy = Math.sqrt(parentMatrix[2] * parentMatrix[2] + parentMatrix[3] * parentMatrix[3]);
                outEntity.height = (entity.height || 1) * sy;
            }
        }

        entities.push(outEntity);
    };

    for (const raw of rawEntities) {
        explodeEntity(raw, identity, '0');
    }

    const extents = finalizeBounds(bounds);
    return {
        entities,
        min_x: extents.min_x,
        min_y: extents.min_y,
        max_x: extents.max_x,
        max_y: extents.max_y,
    };
}
