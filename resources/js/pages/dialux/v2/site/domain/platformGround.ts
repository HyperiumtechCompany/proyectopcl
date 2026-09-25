import { closestPointOnPolygon, pointInPolygon } from './geometry';
import type { Point2D } from './types';

/** Un punto a menos de esta distancia (m) del borde de una plataforma está "sobre la línea": pertenece a las dos. */
export const PLATFORM_EDGE_ON_M = 0.05;

export interface PlatformSurface {
    vertices: Point2D[];
    /** Cota absoluta de su superficie (m). */
    topM: number;
}

/**
 * Cota de la superficie de plataforma bajo un punto, o `null` si el punto no
 * está sobre ninguna (entonces manda el terreno y los taludes).
 *
 * - Dentro de una plataforma (a más de `PLATFORM_EDGE_ON_M` de su borde): su
 *   cota; si son varias anidadas, la MÁS ALTA (la pequeña sobre la grande).
 * - Justo SOBRE la línea de una plataforma (un cerco dibujado en el borde que
 *   comparten dos niveles): cuenta como perteneciente a las dos, y se toma la
 *   más BAJA — el cerco queda al ras del nivel de abajo en vez de "subirse" al
 *   de arriba. Quien quiera lo contrario elige la plataforma a mano.
 * - Los taludes de plataformas MÁS ALTAS no levantan un punto que ya está sobre
 *   una plataforma: solo aplican al terreno fuera de ellas.
 */
export function platformGroundAt(
    point: Point2D,
    platforms: PlatformSurface[],
    scaleM: number,
): number | null {
    let strict: PlatformSurface | null = null; // la más alta que contiene el punto
    const edge: PlatformSurface[] = [];
    for (const platform of platforms) {
        if (platform.vertices.length < 3) continue;
        const inside = pointInPolygon(point, platform.vertices);
        const hit = closestPointOnPolygon(point, platform.vertices, true);
        const edgeDistM = hit ? hit.distance * scaleM : Infinity;
        if (edgeDistM <= PLATFORM_EDGE_ON_M) {
            edge.push(platform);
        } else if (inside && (!strict || platform.topM > strict.topM)) {
            strict = platform;
        }
    }
    if (edge.length === 0) return strict ? strict.topM : null;

    let result: number | null = null;
    for (const e of edge) {
        let value = e.topM;
        if (strict) {
            // ¿Una está dentro de la otra (la alta SOBRE la grande de abajo, o un foso)? Entonces el
            // borde es del nivel de arriba: un cerco perimetral de la plataforma alta se queda en ella.
            // Si son CONTIGUAS (comparten el borde), es ambiguo y se toma el nivel de abajo.
            const nested =
                polygonInside(e.vertices, strict.vertices) ||
                polygonInside(strict.vertices, e.vertices);
            value = nested ? Math.max(e.topM, strict.topM) : Math.min(e.topM, strict.topM);
        }
        result = result === null ? value : Math.min(result, value);
    }
    return result;
}

/** ¿Todos los vértices de `inner` caen dentro (o sobre el borde) de `outer`? */
function polygonInside(inner: Point2D[], outer: Point2D[]): boolean {
    return inner.every((v) => {
        if (pointInPolygon(v, outer)) return true;
        const hit = closestPointOnPolygon(v, outer, true);
        return !!hit && hit.distance <= 1e-6;
    });
}
