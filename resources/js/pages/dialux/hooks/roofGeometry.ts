import { pointInPolygon } from './ambientSpaces';
import type { StructuralObstacle, Vertex } from './types';

const ROUTE_CLEARANCE_M = 0.02;

function localRoofX(surface: StructuralObstacle, point: Vertex): {
    x: number;
    minX: number;
    maxX: number;
} {
    const xs = surface.vertices.map((vertex) => vertex.x);
    const ys = surface.vertices.map((vertex) => vertex.y);
    const minWorldX = Math.min(...xs);
    const maxWorldX = Math.max(...xs);
    const minWorldY = Math.min(...ys);
    const maxWorldY = Math.max(...ys);
    const centerX = (minWorldX + maxWorldX) / 2;
    const centerY = (minWorldY + maxWorldY) / 2;
    const angle = ((surface.orientationDeg ?? 0) * Math.PI) / 180;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const x = Math.cos(angle) * dx - Math.sin(angle) * dy;
    const halfWidth = Math.max(0.025, (maxWorldX - minWorldX) / 2);

    return { x, minX: -halfWidth, maxX: halfWidth };
}

/** Cota de la cara inferior de una cubierta/cielorraso en un punto de planta. */
export function structuralSurfaceUndersideAt(
    surface: StructuralObstacle,
    point: Vertex,
): number | undefined {
    if (
        !['roof', 'ceiling'].includes(surface.obstacleType) ||
        surface.vertices.length < 3 ||
        !pointInPolygon(point, surface.vertices)
    ) {
        return undefined;
    }

    const eave = surface.eaveHeight ?? surface.elevation ?? 0;
    const { x, minX, maxX } = localRoofX(surface, point);
    const width = Math.max(0.05, maxX - minX);
    const ridge = surface.ridgeHeight ??
        eave + (width * Math.abs(surface.slopePercent ?? 0)) / 200;
    const rise = ridge - eave;
    const normalized = Math.max(0, Math.min(1, (x - minX) / width));
    const centerDistance = Math.min(1, Math.abs(x) / (width / 2));
    const type = surface.roofType ??
        (surface.obstacleType === 'ceiling' ? 'full' : 'flat');

    let surfaceHeight = eave;
    if (['gable', 'mansard', 'hip'].includes(type)) {
        surfaceHeight = ridge - centerDistance * rise;
    } else if (type === 'butterfly') {
        surfaceHeight = eave + centerDistance * rise;
    } else if (['shed', 'custom', 'cove', 'stepped'].includes(type)) {
        surfaceHeight = eave + normalized * ((width * (surface.slopePercent ?? 0)) / 100);
    }

    return Math.max(
        0,
        surfaceHeight - Math.max(0.02, surface.thickness ?? 0.15) / 2 - ROUTE_CLEARANCE_M,
    );
}

export function structuralRouteHeightAt(
    surfaces: StructuralObstacle[],
    point: Vertex,
): number | undefined {
    const heights = surfaces
        .map((surface) => structuralSurfaceUndersideAt(surface, point))
        .filter((height): height is number => height !== undefined);

    return heights.length > 0 ? Math.min(...heights) : undefined;
}
