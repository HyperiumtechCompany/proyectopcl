/**
 * ceilingProjection.ts -- resta el area de los StructuralObstacle (columnas,
 * vigas, zonas restringidas) del poligono de un Room para obtener las "zonas
 * validas de instalacion" donde SI se pueden colocar luminarias.
 *
 * Usa polygon-clipping (Martinez-Rueda) para la resta booleana exacta y
 * polylabel (pole of inaccessibility) para encontrar el centro visual/seguro
 * de cada zona resultante, incluso cuando tiene huecos o forma irregular.
 *
 * Todas las coordenadas de entrada/salida estan en metros (mismo sistema que
 * polygonGeometry.ts). Sin obstaculos relevantes para la altura de montaje
 * dada, el "camino rapido" devuelve el room intacto sin pasar por el CSG --
 * asi fixtureGrid.ts puede delegar al algoritmo clasico sin ningun cambio de
 * comportamiento quando no hay obstaculos.
 */

import polygonClipping, { type Polygon as ClipPolygon, type Ring as ClipRing } from 'polygon-clipping';
import polylabel from 'polylabel';
import {
    distancePointToSegment,
    pointInPolygon,
    polygonAreaM2,
    polygonCentroid,
    sanitizePolygon,
    type WorldPoint,
} from './polygonGeometry';
import type { StructuralObstacle, Vertex } from '../hooks/types';

/** Descarta fragmentos residuales del CSG (ruido de punto flotante en los bordes). */
const MIN_ZONE_AREA_M2 = 0.01;

/** Margen de seguridad por defecto al desplazar una luminaria fuera de un obstaculo. */
export const DEFAULT_OBSTACLE_SAFETY_MARGIN_M = 0.15;

export interface ValidInstallationZone {
    /** Anillo exterior de la zona, en metros */
    outer: Vertex[];
    /** Huecos (obstaculos) dentro del anillo exterior -- vacio si el obstaculo dividio el room en zonas separadas en vez de dejar un hueco */
    holes: Vertex[][];
    /** Area neta (exterior menos huecos), en m2 */
    areaM2: number;
    /** Pole of inaccessibility: mejor punto para centrar una grilla dentro de esta zona */
    pole: Vertex;
}

function toRing(vertices: Vertex[]): ClipRing {
    return vertices.map((v): [number, number] => [v.x, v.y]);
}

function fromRing(ring: ClipRing): Vertex[] {
    return ring.map(([x, y]) => ({ x, y }));
}

/**
 * True si el obstaculo intersecta el plano horizontal de montaje a `mountingHeight`.
 * `height <= 0` se interpreta como "sin extension vertical definida" (zona
 * restringida generica) y bloquea a cualquier altura de montaje.
 */
export function obstacleBlocksMountingPlane(obstacle: StructuralObstacle, mountingHeight: number): boolean {
    if (obstacle.height <= 0) return true;
    const top = obstacle.elevation + obstacle.height;
    return mountingHeight >= obstacle.elevation && mountingHeight <= top;
}

function polygonPoleOfInaccessibility(outer: Vertex[], holes: Vertex[][]): Vertex {
    if (outer.length === 0) return { x: 0, y: 0 };
    if (outer.length < 3) return outer[0];
    const rings = [toRing(outer), ...holes.map(toRing)];
    const areaM2 = polygonAreaM2(outer);
    // Zonas chicas piden mas precision relativa; zonas grandes no la necesitan
    // (evita costo de computo innecesario en recintos grandes).
    const precision = Math.max(0.01, Math.sqrt(Math.max(areaM2, 0.01)) / 200);
    const [x, y] = polylabel(rings, precision);
    return { x, y };
}

/**
 * Resta los obstaculos relevantes (segun `mountingHeight`) del poligono del
 * room y devuelve las zonas validas resultantes. Puede devolver mas de una
 * zona si un obstaculo atraviesa el room de lado a lado (lo divide en dos
 * areas separadas), o una sola zona con huecos si el obstaculo queda
 * totalmente rodeado de area valida (caso tipico: una columna).
 */
export function computeValidInstallationZones(
    roomVertices: Vertex[],
    obstacles: StructuralObstacle[],
    mountingHeight: number,
): ValidInstallationZone[] {
    const roomRing = sanitizePolygon(roomVertices);
    if (roomRing.length < 3) return [];

    const blocking = obstacles.filter(
        (o) => obstacleBlocksMountingPlane(o, mountingHeight) && sanitizePolygon(o.vertices).length >= 3,
    );

    if (blocking.length === 0) {
        return [
            {
                outer: roomRing,
                holes: [],
                areaM2: polygonAreaM2(roomRing),
                pole: polygonPoleOfInaccessibility(roomRing, []),
            },
        ];
    }

    const subject: ClipPolygon = [toRing(roomRing)];
    const clips: ClipPolygon[] = blocking.map((o): ClipPolygon => [toRing(sanitizePolygon(o.vertices))]);

    let result: ClipPolygon[];
    try {
        result = polygonClipping.difference(subject, ...clips);
    } catch {
        // Geometria degenerada (auto-interseccion severa, etc.): degradar al
        // room completo en vez de romper el editor por un obstaculo invalido.
        return [
            {
                outer: roomRing,
                holes: [],
                areaM2: polygonAreaM2(roomRing),
                pole: polygonPoleOfInaccessibility(roomRing, []),
            },
        ];
    }

    return result
        .map((poly): ValidInstallationZone => {
            const [outerRing, ...holeRings] = poly;
            const outer = fromRing(outerRing);
            const holes = holeRings.map(fromRing);
            const areaM2 = polygonAreaM2(outer) - holes.reduce((sum, h) => sum + polygonAreaM2(h), 0);
            return { outer, holes, areaM2, pole: polygonPoleOfInaccessibility(outer, holes) };
        })
        .filter((zone) => zone.areaM2 > MIN_ZONE_AREA_M2);
}

/** True si `point` cae en area valida de la zona (dentro del exterior, fuera de todo hueco). */
export function isPointInZone(point: WorldPoint, zone: ValidInstallationZone): boolean {
    if (!pointInPolygon(point, zone.outer)) return false;
    return !zone.holes.some((hole) => pointInPolygon(point, hole));
}

function nearestPointOnSegment(p: WorldPoint, a: WorldPoint, b: WorldPoint): WorldPoint {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0;
    return { x: a.x + t * dx, y: a.y + t * dy };
}

function nearestPointOnRing(p: WorldPoint, ring: WorldPoint[]): WorldPoint {
    let best = ring[0];
    let bestDist = Infinity;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const candidate = nearestPointOnSegment(p, a, b);
        const d = Math.hypot(candidate.x - p.x, candidate.y - p.y);
        if (d < bestDist) {
            bestDist = d;
            best = candidate;
        }
    }
    return best;
}

/**
 * Empuja `point` fuera de `hole` hacia el area valida, mas un margen de
 * seguridad medido perpendicular al borde del hueco. Si el margen lo saca
 * del anillo exterior de la zona (obstaculo pegado a una pared del room),
 * se conserva el punto de borde exacto sin margen -- preferible pegado al
 * obstaculo que fuera del recinto.
 */
function pushOutOfHole(point: WorldPoint, hole: Vertex[], zone: ValidInstallationZone, marginM: number): Vertex {
    const edgePoint = nearestPointOnRing(point, hole);
    const holeCentroid = polygonCentroid(hole) ?? edgePoint;
    let dx = edgePoint.x - holeCentroid.x;
    let dy = edgePoint.y - holeCentroid.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const withMargin = { x: edgePoint.x + dx * marginM, y: edgePoint.y + dy * marginM };
    if (isPointInZone(withMargin, zone)) return withMargin;
    return edgePoint;
}

/**
 * Corrige `point` para que caiga en area valida de `zone` ("snap-to-valid"):
 *  - si cae dentro de un hueco (obstaculo), lo desplaza al borde del hueco + margen;
 *  - si cae fuera del anillo exterior (posible por precision del CSG en el borde),
 *    lo desplaza en linea recta hacia el pole de la zona;
 *  - si ya es valido, lo devuelve sin cambios.
 */
export function snapPointIntoZone(
    point: Vertex,
    zone: ValidInstallationZone,
    marginM: number = DEFAULT_OBSTACLE_SAFETY_MARGIN_M,
): Vertex {
    if (isPointInZone(point, zone)) return point;

    const hole = zone.holes.find((h) => pointInPolygon(point, h));
    if (hole) return pushOutOfHole(point, hole, zone, marginM);

    // Fuera del anillo exterior: desplazar hacia el pole (garantizado adentro
    // por construccion de computeValidInstallationZones, salvo zona degenerada).
    if (!pointInPolygon(zone.pole, zone.outer)) return zone.pole;
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const candidate = {
            x: point.x + (zone.pole.x - point.x) * t,
            y: point.y + (zone.pole.y - point.y) * t,
        };
        if (isPointInZone(candidate, zone)) return candidate;
    }
    return zone.pole;
}

/**
 * Reparte `totalCount` luminarias entre `zones` proporcionalmente a su area,
 * por metodo de restos mayores (Hamilton) -- la suma de los repartos siempre
 * da exactamente `totalCount`, sin sesgo sistematico de redondeo hacia abajo.
 */
export function distributeCountAcrossZones(zones: ValidInstallationZone[], totalCount: number): number[] {
    const count = Math.max(0, Math.round(totalCount));
    const totalArea = zones.reduce((sum, z) => sum + z.areaM2, 0);
    if (zones.length === 0 || totalArea <= 0 || count === 0) {
        return zones.map(() => 0);
    }

    const raw = zones.map((z) => (z.areaM2 / totalArea) * count);
    const floors = raw.map((r) => Math.floor(r));
    const assigned = floors.reduce((sum, f) => sum + f, 0);
    let remaining = count - assigned;

    const byRemainderDesc = floors
        .map((_, i) => ({ i, frac: raw[i] - floors[i] }))
        .sort((a, b) => b.frac - a.frac);

    const result = [...floors];
    for (let k = 0; k < byRemainderDesc.length && remaining > 0; k++, remaining--) {
        result[byRemainderDesc[k].i] += 1;
    }
    return result;
}

/** Distancia perpendicular minima de `point` al borde de `hole` -- usado solo por tests. */
export function distanceToHoleEdge(point: WorldPoint, hole: Vertex[]): number {
    let min = Infinity;
    for (let i = 0; i < hole.length; i++) {
        const a = hole[i];
        const b = hole[(i + 1) % hole.length];
        const d = distancePointToSegment(point, a, b);
        if (d < min) min = d;
    }
    return min;
}
