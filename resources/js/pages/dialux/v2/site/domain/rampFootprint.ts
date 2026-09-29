import { closestPointOnPolygon, pointInPolygon } from './geometry';
import { elementBox, fitRampToElement, stairRunDirection } from './layoutFit';
import { levelTargets } from './levelLink';
import { buildStraightRampLayout, stairAsRampConfig, type FlightSegment3D } from './rampLayout';
import type { Point2D, RampConfig, SideLights, SiteElement } from './types';

/**
 * Geometría REAL de rampas y escaleras en planta, compartida por el 3D y los
 * cálculos: cada tramo/descanso como polígono con su cota, y la llegada.
 *
 * Arregla el "abismo" en la llegada (2026-09-28, proyecto 9): los tramos se
 * dibujaban con la subida escrita a mano (p. ej. 4,10 m) aunque las
 * plataformas estén a 3,50 m, así que la rampa terminaba en el aire; y el
 * recorte de la plataforma quitaba también la franja donde la rampa LLEGA.
 */

const EPS_M = 0.01;

/**
 * Reparte el desnivel real (destino − origen) entre los tramos en la misma
 * proporción que sus subidas escritas: la rampa siempre llega a la cota de
 * destino. Sin desnivel (origen = destino) no se toca (lo avisa la revisión
 * normativa). Devuelve la misma config si ya cuadra.
 */
export function normalizeFlightRises(config: RampConfig): RampConfig {
    const flights = config.flights ?? [];
    if (flights.length === 0) return config;
    const target = config.toElevationM - config.fromElevationM;
    const sum = flights.reduce((acc, flight) => acc + flight.riseM, 0);
    if (Math.abs(target) < EPS_M || Math.abs(sum) < EPS_M || Math.abs(sum - target) <= 0.005) return config;
    const factor = target / sum;
    return { ...config, flights: flights.map((flight) => ({ ...flight, riseM: flight.riseM * factor })) };
}

/** Config de trazado (tramos) de una rampa o escalera, ya ajustada al desnivel. */
export function flightConfigOf(element: SiteElement, scaleM: number): RampConfig | null {
    const config = element.config;
    if (element.type === 'ramp' && config?.kind === 'ramp') {
        if (config.shape === 'spiral' || !config.flights || config.flights.length === 0) return null;
        return normalizeFlightRises(config);
    }
    if (element.type === 'stair' && config?.kind === 'stair') {
        return stairAsRampConfig(config, stairRunDirection(config, element, scaleM));
    }
    return null;
}

export interface PlanSegment {
    kind: FlightSegment3D['kind'];
    role?: FlightSegment3D['role'];
    /** Rectángulo del tramo en planta (unidades del plano). */
    corners: Point2D[];
    /** Cotas absolutas (m) al inicio y al final del tramo. */
    startM: number;
    endM: number;
}

/** Convierte un punto local del layout (m, centrado) a planta, con el giro del elemento (igual que el nodo 3D). */
function localToPlan(center: Point2D, rotationDeg: number, scaleM: number, p: { x: number; z: number }): Point2D {
    // Nodo 3D: rotation.y = −rot → x' = x·cos θ + z·sin θ; z' = −x·sin θ + z·cos θ.
    const theta = (-rotationDeg * Math.PI) / 180;
    const x = p.x * Math.cos(theta) + p.z * Math.sin(theta);
    const z = -p.x * Math.sin(theta) + p.z * Math.cos(theta);
    return { x: center.x + x / scaleM, y: center.y - z / scaleM };
}

/** Tramos y descansos de una rampa/escalera en planta, tal como los dibuja el 3D. */
export function rampPlanSegments(element: SiteElement, scaleM: number): PlanSegment[] {
    const requested = flightConfigOf(element, scaleM);
    if (!requested) return [];
    const config = fitRampToElement(requested, element, scaleM, { lockLengths: element.type === 'stair' }).config;
    const center = elementBox(element, scaleM).center;
    const rotation = element.rotation ?? 0;
    return buildStraightRampLayout(config).map((segment) => {
        const dx = segment.endLocal.x - segment.startLocal.x;
        const dz = segment.endLocal.z - segment.startLocal.z;
        const length = Math.hypot(dx, dz) || 1;
        const px = (-dz / length) * (segment.widthM / 2);
        const pz = (dx / length) * (segment.widthM / 2);
        const local = [
            { x: segment.startLocal.x + px, z: segment.startLocal.z + pz },
            { x: segment.endLocal.x + px, z: segment.endLocal.z + pz },
            { x: segment.endLocal.x - px, z: segment.endLocal.z - pz },
            { x: segment.startLocal.x - px, z: segment.startLocal.z - pz },
        ];
        return {
            kind: segment.kind,
            role: segment.role,
            corners: local.map((p) => localToPlan(center, rotation, scaleM, p)),
            startM: config.fromElevationM + segment.startY,
            endM: config.fromElevationM + segment.endY,
        };
    });
}

export interface ArrivalBridge {
    /** Polígono (planta) de la losa de llegada, del borde final de la rampa al borde de la plataforma. */
    polygon: Point2D[];
    elevationM: number;
    targetLabel: string;
    gapM: number;
}

/** Distancia máxima (m) que se salva con una losa de llegada; más allá es un error de trazado. */
export const MAX_ARRIVAL_GAP_M = 3;

/**
 * Llegada de la rampa/escalera a su plataforma (o edificio) de destino. Si el
 * final del último tramo NO está sobre una superficie a su cota, busca la
 * plataforma/edificación a esa cota más cercana (≤ `MAX_ARRIVAL_GAP_M`) y
 * devuelve la losa que une el borde final con el borde de esa plataforma
 * (el descanso de llegada que falta). null si ya apoya o si no hay destino.
 */
export function arrivalBridge(element: SiteElement, elements: SiteElement[], scaleM: number): ArrivalBridge | null {
    const segments = rampPlanSegments(element, scaleM);
    const last = segments[segments.length - 1];
    if (!last) return null;
    const topM = Math.max(last.startM, last.endM);
    const targets = levelTargets(elements).filter(
        (target) => target.element.id !== element.id && Math.abs(target.elevationM - topM) <= 0.05,
    );
    if (targets.length === 0) return null;
    // Borde final del último tramo: los dos vértices del extremo `end`.
    const edge = [last.corners[1], last.corners[2]];
    const mid = { x: (edge[0].x + edge[1].x) / 2, y: (edge[0].y + edge[1].y) / 2 };
    // Si el borde ya apoya sobre el destino, no hace falta losa.
    if (targets.some((target) => pointInPolygon(mid, target.element.vertices))) return null;
    let best: { target: (typeof targets)[number]; distanceM: number } | null = null;
    for (const target of targets) {
        const hit = closestPointOnPolygon(mid, target.element.vertices, true);
        if (!hit) continue;
        const distanceM = hit.distance * scaleM;
        if (!best || distanceM < best.distanceM) best = { target, distanceM };
    }
    if (!best || best.distanceM > MAX_ARRIVAL_GAP_M || best.distanceM < 0.02) return null;
    const vertices = best.target.element.vertices;
    const a = closestPointOnPolygon(edge[0], vertices, true)?.point ?? edge[0];
    const b = closestPointOnPolygon(edge[1], vertices, true)?.point ?? edge[1];
    return {
        polygon: [edge[0], edge[1], b, a],
        elevationM: topM,
        targetLabel: best.target.element.label,
        gapM: best.distanceM,
    };
}

/**
 * Parches de cálculo de una rampa/escalera (motor exterior): cada tramo se
 * corta en trozos de ≤ `pieceM` metros a lo largo, y cada trozo se calcula a
 * SU cota media (error ≤ la mitad de lo que sube un trozo, p. ej. ±6 cm con
 * 8 % y 1,5 m); los descansos, a su cota. Antes toda la rampa se evaluaba
 * como un plano horizontal a la cota media (±1,75 m en los extremos). Los
 * huecos entre tramos (ojo de la vuelta en U) no son superficie de paso: no
 * se calculan. Coordenadas en METROS. [] si no es una rampa/escalera por tramos.
 */
export function rampCalcPatches(
    element: SiteElement,
    scaleM: number,
    pieceM = 1.5,
): Array<{ vertices: Point2D[]; minX: number; maxX: number; minY: number; maxY: number; baseElevationM: number }> {
    const patches: Array<{ vertices: Point2D[]; minX: number; maxX: number; minY: number; maxY: number; baseElevationM: number }> = [];
    for (const segment of rampPlanSegments(element, scaleM)) {
        const [a0, a1, b1, b0] = segment.corners.map((p) => ({ x: p.x * scaleM, y: p.y * scaleM }));
        // a0→a1 y b0→b1 son los dos lados a lo largo del tramo.
        const lengthM = Math.hypot(a1.x - a0.x, a1.y - a0.y);
        const pieces = segment.kind === 'flight' ? Math.max(1, Math.ceil(lengthM / pieceM)) : 1;
        for (let k = 0; k < pieces; k++) {
            const t0 = k / pieces;
            const t1 = (k + 1) / pieces;
            const lerp = (p: Point2D, q: Point2D, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
            const vertices = [lerp(a0, a1, t0), lerp(a0, a1, t1), lerp(b0, b1, t1), lerp(b0, b1, t0)];
            const xs = vertices.map((v) => v.x);
            const ys = vertices.map((v) => v.y);
            patches.push({
                vertices,
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
                baseElevationM: segment.startM + (segment.endM - segment.startM) * ((t0 + t1) / 2),
            });
        }
    }
    return patches;
}

/** Balizas por defecto (muro a 0,30 m, cada 1,5 m, ambos lados). */
export const DEFAULT_SIDE_LIGHTS: SideLights = {
    enabled: false,
    mode: 'wall',
    spacingM: 1.5,
    sides: 'both',
    lumens: 150,
    wattage: 3,
};

export interface SideLightPoint {
    /** Planta en METROS (x, y = coordenadas del plano × escala). */
    x: number;
    y: number;
    /** Cota absoluta (m) de la baliza. */
    elevationM: number;
    /** Rumbo (°) hacia el centro del tramo (eje C0 de la fotometría). */
    rotationDeg: number;
}

/** Balizas configuradas de una rampa/escalera (o null). */
export function sideLightsOf(element: SiteElement): SideLights | null {
    const config = element.config;
    const lights = (config?.kind === 'ramp' || config?.kind === 'stair') ? config.lights : undefined;
    return lights?.enabled ? lights : null;
}

/**
 * Posición de cada baliza: a lo largo de cada tramo y descanso, en el/los
 * costado(s) elegidos, 5 cm hacia adentro del borde, a `heightM` sobre el
 * piso de paso EN ESE PUNTO (la cota varía a lo largo del tramo). Fuente
 * única para el cálculo, el 2D, el 3D y la carga eléctrica.
 */
export function rampSideLightPoints(element: SiteElement, scaleM: number): SideLightPoint[] {
    const lights = sideLightsOf(element);
    if (!lights) return [];
    const mount = lights.heightM ?? (lights.mode === 'bollard' ? 1 : 0.3);
    const spacing = Math.max(0.5, lights.spacingM);
    const points: SideLightPoint[] = [];
    for (const segment of rampPlanSegments(element, scaleM)) {
        const [a0, a1, b1, b0] = segment.corners.map((p) => ({ x: p.x * scaleM, y: p.y * scaleM }));
        const sides: Array<[Point2D, Point2D, Point2D, Point2D]> = [];
        // Lado "izquierdo" = a0→a1 (hacia b el interior); "derecho" = b0→b1.
        if (lights.sides !== 'right') sides.push([a0, a1, b0, b1]);
        if (lights.sides !== 'left') sides.push([b0, b1, a0, a1]);
        for (const [s0, s1, o0, o1] of sides) {
            const lengthM = Math.hypot(s1.x - s0.x, s1.y - s0.y);
            if (lengthM < 0.3) continue;
            const count = Math.max(1, Math.round(lengthM / spacing));
            for (let i = 0; i < count; i++) {
                const t = (i + 0.5) / count;
                const edge = { x: s0.x + (s1.x - s0.x) * t, y: s0.y + (s1.y - s0.y) * t };
                const opposite = { x: o0.x + (o1.x - o0.x) * t, y: o0.y + (o1.y - o0.y) * t };
                const width = Math.hypot(opposite.x - edge.x, opposite.y - edge.y) || 1;
                const nx = (opposite.x - edge.x) / width;
                const ny = (opposite.y - edge.y) / width;
                points.push({
                    x: edge.x + nx * 0.05,
                    y: edge.y + ny * 0.05,
                    elevationM: segment.startM + (segment.endM - segment.startM) * t + mount,
                    rotationDeg: (Math.atan2(ny, nx) * 180) / Math.PI,
                });
            }
        }
    }
    return points;
}

/** Luces subacuáticas de una piscina: repartidas en el perímetro, 0,5 m bajo la lámina de agua (planta en METROS). */
export function poolLightPoints(element: SiteElement, scaleM: number): Array<{ x: number; y: number; depthM: number }> {
    const lights = element.config?.kind === 'pool' ? element.config.lights : undefined;
    const vertices = element.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    if (!lights?.enabled || lights.count <= 0 || vertices.length < 3) return [];
    const edges = vertices.map((v, i) => [v, vertices[(i + 1) % vertices.length]] as const);
    const perimeter = edges.reduce((sum, [a, b]) => sum + Math.hypot(b.x - a.x, b.y - a.y), 0);
    const points: Array<{ x: number; y: number; depthM: number }> = [];
    for (let k = 0; k < lights.count; k++) {
        let target = ((k + 0.5) / lights.count) * perimeter;
        for (const [a, b] of edges) {
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (target <= len) {
                const t = len > 0 ? target / len : 0;
                points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, depthM: 0.5 });
                break;
            }
            target -= len;
        }
    }
    return points;
}

/**
 * Contorno(s) de lo que REALMENTE se calcula de un espacio, en unidades de
 * plano: en rampas/escaleras por tramos, cada tramo y descanso (la superficie
 * de paso, igual que en el cálculo y el 3D); en el resto, su polígono. Es el
 * recorte de los falsos colores y de las curvas isolux, para que coincidan
 * con lo calculado y no se salgan de él.
 */
export function calcOutlines(element: SiteElement, scaleM: number): Point2D[][] {
    const segments = rampPlanSegments(element, scaleM);
    if (segments.length > 0) return segments.map((segment) => segment.corners);
    return element.vertices.length >= 3 ? [element.vertices] : [];
}
