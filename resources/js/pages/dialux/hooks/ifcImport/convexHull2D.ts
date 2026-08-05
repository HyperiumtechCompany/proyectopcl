import type { Vertex } from '@/pages/dialux/hooks/types';

/**
 * Fase 19 del plan maestro ("BIM/IFC", primer ciclo). Casco convexo 2D de un
 * conjunto de puntos — algoritmo monótono de Andrew (O(n log n), sin
 * dependencias externas).
 *
 * Usado por `ifcSpaceFootprint.ts` como APROXIMACIÓN del polígono de planta
 * de un `IfcSpace` a partir de su malla tesselada. Limitación documentada
 * explícitamente (mismo criterio que `windowSkyAperture.ts::resolveInwardNormal`
 * en la Fase 17): un espacio con planta cóncava (L/U/T) se "rellena" a su
 * casco convexo — reconstruir el contorno cóncavo exacto desde una malla 3D
 * arbitraria requiere un algoritmo sustancialmente más complejo (extracción
 * del borde de la cara inferior), diferido a un ciclo posterior.
 */
function cross(o: Vertex, a: Vertex, b: Vertex): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Devuelve los vértices del casco convexo en orden antihorario, sin el punto de cierre repetido. `[]` si hay menos de 3 puntos distintos. */
export function convexHull2D(points: Vertex[]): Vertex[] {
    const unique = Array.from(new Map(points.map((p) => [`${p.x}|${p.y}`, p])).values()).sort(
        (a, b) => a.x - b.x || a.y - b.y,
    );

    if (unique.length < 3) {
        return [];
    }

    const lower: Vertex[] = [];
    for (const p of unique) {
        while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: Vertex[] = [];
    for (let i = unique.length - 1; i >= 0; i--) {
        const p = unique[i]!;
        while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    lower.pop();
    upper.pop();
    const hull = lower.concat(upper);
    return hull.length >= 3 ? hull : [];
}
