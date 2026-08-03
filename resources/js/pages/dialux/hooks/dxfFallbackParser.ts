import type { DxfEntity, DxfExtents } from './useEditorStore';

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
    let idCounter = 0;

    const nextId = () => {
        idCounter += 1;
        return `dxf_ts_${idCounter}`;
    };

    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        const next = pairs[i + 1];

        if (pair.code === 0 && pair.value === 'SECTION' && next?.code === 2) {
            inEntitiesSection = next.value.toUpperCase() === 'ENTITIES';
            continue;
        }

        if (pair.code === 0 && pair.value === 'ENDSEC') {
            inEntitiesSection = false;
            continue;
        }

        if (!inEntitiesSection || pair.code !== 0) continue;

        const type = pair.value.toUpperCase();
        const [entityPairs, nextIndex] = collectEntityPairs(pairs, i);
        i = nextIndex - 1;

        if (type === 'LINE') {
            const x1 = num(valueFor(entityPairs, 10));
            const y1 = num(valueFor(entityPairs, 20));
            const x2 = num(valueFor(entityPairs, 11));
            const y2 = num(valueFor(entityPairs, 21));
            updateBounds(bounds, x1, y1);
            updateBounds(bounds, x2, y2);
            entities.push({
                id: nextId(),
                type: 'line',
                x1,
                y1,
                x2,
                y2,
                layer: layerFor(entityPairs),
            });
        } else if (type === 'LWPOLYLINE') {
            const vertices: [number, number][] = [];
            let pendingX: number | null = null;

            for (const entityPair of entityPairs) {
                if (entityPair.code === 10) {
                    pendingX = num(entityPair.value);
                } else if (entityPair.code === 20 && pendingX !== null) {
                    const vertex: [number, number] = [
                        pendingX,
                        num(entityPair.value),
                    ];
                    vertices.push(vertex);
                    updateBounds(bounds, vertex[0], vertex[1]);
                    pendingX = null;
                }
            }

            if (vertices.length > 0) {
                entities.push({
                    id: nextId(),
                    type: 'polyline',
                    vertices,
                    closed: (num(valueFor(entityPairs, 70)) & 1) === 1,
                    layer: layerFor(entityPairs),
                });
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
                const vertex: [number, number] = [
                    num(valueFor(vertexPairs, 10)),
                    num(valueFor(vertexPairs, 20)),
                ];
                vertices.push(vertex);
                updateBounds(bounds, vertex[0], vertex[1]);
                j = vertexEnd - 1;
            }

            if (vertices.length > 0) {
                entities.push({
                    id: nextId(),
                    type: 'polyline',
                    vertices,
                    closed,
                    layer,
                });
            }
        } else if (type === 'CIRCLE' || type === 'ARC') {
            const cx = num(valueFor(entityPairs, 10));
            const cy = num(valueFor(entityPairs, 20));
            const r = Math.max(0, num(valueFor(entityPairs, 40)));
            updateCircleBounds(bounds, cx, cy, r);

            if (type === 'CIRCLE') {
                entities.push({
                    id: nextId(),
                    type: 'circle',
                    cx,
                    cy,
                    r,
                    layer: layerFor(entityPairs),
                });
            } else {
                entities.push({
                    id: nextId(),
                    type: 'arc',
                    cx,
                    cy,
                    r,
                    start_angle: num(valueFor(entityPairs, 50)),
                    end_angle: num(valueFor(entityPairs, 51)),
                    layer: layerFor(entityPairs),
                });
            }
        } else if (type === 'TEXT' || type === 'MTEXT') {
            const x = num(valueFor(entityPairs, 10));
            const y = num(valueFor(entityPairs, 20));
            updateBounds(bounds, x, y);
            entities.push({
                id: nextId(),
                type: 'text',
                x,
                y,
                text: valueFor(entityPairs, 1) ?? '',
                height: num(valueFor(entityPairs, 40), 1),
                rotation: num(valueFor(entityPairs, 50)),
                layer: layerFor(entityPairs),
            });
        } else if (type === 'POINT') {
            const x = num(valueFor(entityPairs, 10));
            const y = num(valueFor(entityPairs, 20));
            updateBounds(bounds, x, y);
            entities.push({
                id: nextId(),
                type: 'point',
                x,
                y,
                layer: layerFor(entityPairs),
            });
        }
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
