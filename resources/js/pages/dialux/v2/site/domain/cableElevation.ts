import { platformGroundAt } from './platformGround';
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
        const platform = platformGroundAt(point, platforms, scaleM);
        return platform === null ? natural : Math.max(natural, platform);
    });
}
