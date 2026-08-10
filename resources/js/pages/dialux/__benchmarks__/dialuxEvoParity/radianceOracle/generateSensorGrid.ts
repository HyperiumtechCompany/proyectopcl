/**
 * Grilla de sensores horizontales (mirando hacia +Z) para `rtrace -I`, sobre
 * el plano útil de un ambiente rectangular — excluye la zona marginal
 * declarada en todo el contorno, igual criterio que
 * `export/document/ambientDossier.ts` usa para el plano útil real (aunque
 * aquí, al ser rectangular, la exclusión es simplemente un margen fijo por
 * lado, no la aproximación de polígono general que usa esa función).
 */

import { distanceToPolygonEdge, pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Vertex } from '@/pages/dialux/hooks/types';

export interface SensorGridOptions {
    width: number;
    depth: number;
    /** Altura del plano de trabajo (Z) donde se miden los sensores. */
    workingPlaneHeight: number;
    /** Excluida en todo el contorno, igual que `Room.marginalZone`. */
    marginalZone: number;
    /** Pequeño desplazamiento vertical sobre el plano de trabajo para evitar que el sensor coincida exactamente con una superficie (piso). Default 0.01 m. */
    verticalOffset?: number;
    columns: number;
    rows: number;
}

export interface SensorPoint {
    x: number;
    y: number;
    z: number;
    dx: number;
    dy: number;
    dz: number;
}

export function generateSensorGrid(options: SensorGridOptions): SensorPoint[] {
    const { width, depth, workingPlaneHeight, marginalZone, columns, rows } = options;
    const verticalOffset = options.verticalOffset ?? 0.01;
    const usableWidth = width - 2 * marginalZone;
    const usableDepth = depth - 2 * marginalZone;
    if (usableWidth <= 0 || usableDepth <= 0) {
        throw new Error(
            `generateSensorGrid: zona marginal (${marginalZone} m) deja un área útil no positiva para un ambiente de ${width}x${depth} m.`,
        );
    }

    const points: SensorPoint[] = [];
    for (let row = 0; row < rows; row++) {
        const y = marginalZone + (rows === 1 ? usableDepth / 2 : (usableDepth * row) / (rows - 1));
        for (let col = 0; col < columns; col++) {
            const x = marginalZone + (columns === 1 ? usableWidth / 2 : (usableWidth * col) / (columns - 1));
            points.push({ x, y, z: workingPlaneHeight + verticalOffset, dx: 0, dy: 0, dz: 1 });
        }
    }
    return points;
}

/** Formato de entrada de `rtrace`: una línea "x y z dx dy dz" por punto. */
export function formatSensorGridForRtrace(points: SensorPoint[]): string {
    return points.map((p) => `${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)} ${p.dx} ${p.dy} ${p.dz}`).join('\n') + '\n';
}

/**
 * Generalización de `generateSensorGrid()` a un piso de forma ARBITRARIA
 * (mismo motivo que `generatePolygonRoomScene()` en `generateRoomScene.ts`
 * — terrenos reales no siempre son rectangulares). En vez de reinventar la
 * exclusión de zona marginal (que para un rectángulo es solo un margen fijo
 * por lado), reutiliza el MISMO criterio que ya usa el motor de producción
 * para ambientes poligonales (`marginalZoneFilter.ts::filterPointsOutsideMarginalZone`,
 * vía `pointInPolygon`/`distanceToPolygonEdge` de `geometry/polygonGeometry.ts`):
 * un punto es válido solo si cae DENTRO del polígono y a una distancia ≥
 * `marginalZone` de cualquier borde. Se arma una grilla regular sobre el
 * rectángulo envolvente (bounding box) al espaciado declarado y se
 * descartan los puntos que no cumplan ese criterio — así el oráculo mide
 * exactamente sobre el mismo "plano útil" que el motor real usaría para
 * este ambiente, no una aproximación aparte.
 */
export interface PolygonSensorGridOptions {
    vertices: Vertex[];
    workingPlaneHeight: number;
    marginalZone: number;
    /** Espaciado objetivo entre sensores, en metros (grilla regular sobre el bounding box, luego filtrada al polígono). */
    spacing: number;
    verticalOffset?: number;
}

export function generatePolygonSensorGrid(options: PolygonSensorGridOptions): SensorPoint[] {
    const { vertices, workingPlaneHeight, marginalZone, spacing } = options;
    const verticalOffset = options.verticalOffset ?? 0.01;
    if (vertices.length < 3) {
        throw new Error('generatePolygonSensorGrid: se necesitan al menos 3 vértices para definir un piso.');
    }
    if (spacing <= 0) {
        throw new Error('generatePolygonSensorGrid: el espaciado debe ser positivo.');
    }

    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const columns = Math.max(1, Math.floor((maxX - minX) / spacing) + 1);
    const rows = Math.max(1, Math.floor((maxY - minY) / spacing) + 1);

    const points: SensorPoint[] = [];
    for (let row = 0; row < rows; row++) {
        const y = rows === 1 ? (minY + maxY) / 2 : minY + (spacing * row);
        for (let col = 0; col < columns; col++) {
            const x = columns === 1 ? (minX + maxX) / 2 : minX + (spacing * col);
            const point = { x, y };
            if (pointInPolygon(point, vertices) && distanceToPolygonEdge(point, vertices) >= marginalZone) {
                points.push({ x, y, z: workingPlaneHeight + verticalOffset, dx: 0, dy: 0, dz: 1 });
            }
        }
    }

    if (points.length === 0) {
        throw new Error(
            `generatePolygonSensorGrid: la zona marginal (${marginalZone} m) y el espaciado (${spacing} m) no dejaron ningún sensor dentro del polígono.`,
        );
    }

    return points;
}
