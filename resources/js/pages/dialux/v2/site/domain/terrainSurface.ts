import type { SiteElement } from './types';

export interface ElevationPoint {
    x: number;
    y: number;
    z: number; // cota en metros reales
}

function centroid(vertices: { x: number; y: number }[]): {
    x: number;
    y: number;
} {
    const s = vertices.reduce(
        (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
        { x: 0, y: 0 },
    );
    return { x: s.x / vertices.length, y: s.y / vertices.length };
}

/**
 * Puntos de cota que definen el relieve: cada vértice de cada curva de nivel
 * (con la cota de esa curva) + el centroide de cada punto acotado.
 */
export function terrainElevationPoints(
    elements: SiteElement[],
): ElevationPoint[] {
    const points: ElevationPoint[] = [];
    for (const el of elements) {
        if (el.visible === false) continue;
        if (el.type === 'contour') {
            const z = el.baseElevationM ?? 0;
            for (const v of el.vertices) points.push({ x: v.x, y: v.y, z });
        } else if (el.type === 'spot_elevation') {
            const c = centroid(el.vertices);
            points.push({ x: c.x, y: c.y, z: el.baseElevationM ?? 0 });
        }
    }
    return points;
}

/** ¿Hay datos suficientes para modelar una superficie de terreno? */
export function hasTerrainData(elements: SiteElement[]): boolean {
    return terrainElevationPoints(elements).length >= 3;
}

/**
 * Cota del terreno natural en `(x, y)` por interpolación IDW (media ponderada
 * por el inverso de la distancia al cuadrado). Suficiente para obra; una TIN
 * de Delaunay se puede añadir después si se necesita más fidelidad en zonas
 * con curvas muy juntas.
 */
export function sampleGroundElevation(
    points: ElevationPoint[],
    x: number,
    y: number,
): number {
    if (points.length === 0) return 0;
    let num = 0;
    let den = 0;
    for (const p of points) {
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d2 < 1e-4) return p.z; // sobre un dato
        const w = 1 / d2;
        num += w * p.z;
        den += w;
    }
    return num / den;
}

/** Rango [min, max] de cotas de los datos — para la escala de color del 3D. */
export function elevationRange(points: ElevationPoint[]): [number, number] {
    if (points.length === 0) return [0, 0];
    let lo = points[0].z;
    let hi = points[0].z;
    for (const p of points) {
        if (p.z < lo) lo = p.z;
        if (p.z > hi) hi = p.z;
    }
    return [lo, hi];
}
