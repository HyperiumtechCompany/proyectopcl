import { platformGroundAt } from './platformGround';
import { rampSurfaceSampler } from './rampFootprint';
import {
    sampleGroundElevation,
    terrainElevationPoints,
} from './terrainSurface';
import type { Point2D, SiteElement } from './types';

/**
 * Cota de apoyo de cada punto del cable. Comparte las plataformas y el terreno
 * modelado del emplazamiento para que el metrado reconozca subidas y bajadas.
 */
export function cableWaypointElevations(
    waypoints: Point2D[],
    elements: SiteElement[],
    scaleM: number,
): number[] {
    const terrain = terrainElevationPoints(elements);
    const rampAt = rampSurfaceSampler(elements, scaleM);
    const platforms = elements
        .filter(
            (element) =>
                element.type === 'terrace_platform' &&
                element.visible !== false &&
                element.vertices.length >= 3,
        )
        .map((element) => ({
            vertices: element.vertices,
            topM: element.baseElevationM ?? 0,
        }));

    return waypoints.map((point) => {
        const natural =
            terrain.length >= 3
                ? sampleGroundElevation(terrain, point.x, point.y)
                : 0;
        // Sobre una rampa/escalera manda SU superficie (sube con ella).
        const onRamp = rampAt(point);
        if (onRamp !== null) return onRamp;
        const platform = platformGroundAt(point, platforms, scaleM);
        return platform === null ? natural : Math.max(natural, platform);
    });
}

export interface CableProfileM {
    /** Recorrido sobre el suelo/plataformas (planta + pendiente suave), m. */
    alongM: number;
    /** Subidas y bajadas bruscas (bordes de plataforma, muros, taludes > 45°), m. */
    riseM: number;
}

/**
 * Perfil REAL del cable sobre el emplazamiento: muestrea cada tramo cada
 * ~`stepM` metros (no solo sus puntos dibujados), así un tramo recto que
 * cruza una plataforma a mitad de camino también cuenta su subida y bajada.
 *  - tramo por el suelo / sin tendido: sigue el terreno. Cada paso con
 *    pendiente ≤ 45° suma su longitud inclinada a `alongM`; uno más empinado
 *    (borde de plataforma) suma su planta a `alongM` y su desnivel a `riseM`.
 *  - tramo aéreo: vano recto entre apoyos; su desnivel de extremos va a `riseM`.
 */
export function cableProfileM(
    waypoints: Point2D[],
    elements: SiteElement[],
    scaleM: number,
    modes?: Array<'aerial' | 'underground'> | null,
    stepM = 0.5,
): CableProfileM {
    const terrain = terrainElevationPoints(elements);
    const rampAt = rampSurfaceSampler(elements, scaleM);
    const platforms = elements
        .filter(
            (element) =>
                element.type === 'terrace_platform' &&
                element.visible !== false &&
                element.vertices.length >= 3,
        )
        .map((element) => ({ vertices: element.vertices, topM: element.baseElevationM ?? 0 }));
    const groundAt = (point: Point2D) => {
        const natural = terrain.length >= 3 ? sampleGroundElevation(terrain, point.x, point.y) : 0;
        // Sobre una rampa/escalera manda SU superficie (sube con ella).
        const onRamp = rampAt(point);
        if (onRamp !== null) return onRamp;
        const platform = platformGroundAt(point, platforms, scaleM);
        return platform === null ? natural : Math.max(natural, platform);
    };
    let alongM = 0;
    let riseM = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const a = waypoints[i - 1];
        const b = waypoints[i];
        const spanM = Math.hypot(b.x - a.x, b.y - a.y) * scaleM;
        if (modes?.[i - 1] === 'aerial') {
            alongM += spanM;
            riseM += Math.abs(groundAt(b) - groundAt(a));
            continue;
        }
        const steps = Math.min(400, Math.max(1, Math.ceil(spanM / stepM)));
        const dh = spanM / steps;
        let previous = groundAt(a);
        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            const z = groundAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            const dz = Math.abs(z - previous);
            if (dz > dh) {
                alongM += dh;
                riseM += dz;
            } else {
                alongM += Math.hypot(dh, dz);
            }
            previous = z;
        }
    }
    return { alongM, riseM };
}
