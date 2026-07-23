/**
 * hitTest.ts — Hit-testing determinista por tipo de geometría.
 *
 * Sustituye la cadena de `findNearest*` con retorno temprano (donde el primer
 * tipo que acertaba ganaba aunque otro objeto estuviera más cerca) por un
 * ranking único y estable de TODOS los candidatos bajo el puntero.
 *
 * Reglas de prioridad (menor número gana):
 *   0  interruptores, dispositivos eléctricos, luminarias  (objetos puntuales)
 *   1  ventanas y puertas                                   (ancladas a muros)
 *   2  cables/conductores                                   (distancia a segmento)
 *   3  marquesinas (canopies)
 *   4  muros y tabiques                                     (distancia a polilínea)
 *   5  ambientes / pasadizos / escaleras                    (punto-en-polígono)
 *   6  recintos (envolvente)                                (punto-en-polígono)
 *
 * Dentro de la misma prioridad gana el más cercano al puntero; entre
 * contenedores superpuestos gana el de MENOR área (el ambiente interior antes
 * que el recinto que lo contiene). El empate final se resuelve por id para que
 * el orden sea 100% determinista.
 *
 * Todas las distancias se evalúan en píxeles de pantalla (tolerancias táctiles
 * constantes independientes del zoom); la geometría de entrada está en metros.
 */

import {
    distancePointToSegment,
    pointInPolygon,
    polygonAreaM2,
} from '@/pages/dialux/geometry/polygonGeometry';
import type {
    Canopy,
    Conductor,
    Door,
    ElectricalDevice,
    Fixture,
    LightSwitch,
    Partition,
    Room,
    Wall,
    Window,
} from '@/pages/dialux/hooks/types';
import { resolveOffsetOnWall } from '@/pages/dialux/hooks/useInteractionHelpers';

export type HitKind =
    | 'fixture'
    | 'switch'
    | 'electrical-device'
    | 'window'
    | 'door'
    | 'conductor'
    | 'canopy'
    | 'wall'
    | 'partition'
    | 'room';

export interface HitCandidate {
    id: string;
    kind: HitKind;
    priority: number;
    /** Distancia en píxeles al puntero (0 si el puntero está dentro del polígono) */
    distPx: number;
    /** Área en m² — solo contenedores; desempata "el más pequeño primero" */
    areaM2?: number;
    /** roomType original cuando kind === 'room' */
    roomType?: Room['roomType'];
}

export interface HitTestScene {
    fixtures?: Fixture[];
    lightSwitches?: LightSwitch[];
    electricalDevices?: ElectricalDevice[];
    windows?: Window[];
    doors?: Door[];
    conductors?: Conductor[];
    canopies?: Canopy[];
    walls?: Wall[];
    partitions?: Partition[];
    rooms?: Room[];
}

export interface HitTestOptions {
    /** Tolerancia base en px para objetos puntuales y segmentos (default 15) */
    tolerancePx?: number;
    /** Tolerancia para puertas (umbral más ancho, default 18) */
    doorTolerancePx?: number;
    /** Tolerancia para dispositivos eléctricos (símbolos grandes, default 20) */
    deviceTolerancePx?: number;
    /** Permite excluir objetos ocultos sin quitar los nodos usados para trazar cables. */
    isSelectable?: (id: string, kind: HitKind) => boolean;
}

const PRIORITY: Record<HitKind, number> = {
    switch: 0,
    'electrical-device': 0,
    fixture: 0,
    window: 1,
    door: 1,
    conductor: 2,
    canopy: 3,
    wall: 4,
    partition: 4,
    room: 5, // los recintos ('room') se degradan a 6 al construir el candidato
};

type SceneToCanvas = (sx: number, sy: number) => { x: number; y: number };

function distToPolylinePx(
    canvasPt: { x: number; y: number },
    verticesM: { x: number; y: number }[],
    sceneToCanvas: SceneToCanvas,
    closed = false,
): number {
    if (verticesM.length === 0) return Infinity;
    const pts = verticesM.map((v) => sceneToCanvas(v.x, v.y));
    if (pts.length === 1) return Math.hypot(pts[0].x - canvasPt.x, pts[0].y - canvasPt.y);
    let min = Infinity;
    const segCount = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const d = distancePointToSegment(canvasPt, a, b);
        if (d < min) min = d;
    }
    return min;
}

function conductorPathCanvasPx(
    conductor: Conductor,
    nodesM: { x: number; y: number }[],
    sceneToCanvas: SceneToCanvas,
): { x: number; y: number }[] {
    const nodes = nodesM.map((node) => sceneToCanvas(node.x, node.y));
    const curveDir = conductor.routeType === 'floor' ? 1 : -1;
    const path: { x: number; y: number }[] = [];

    for (let segment = 0; segment < nodes.length - 1; segment++) {
        const a = nodes[segment];
        const b = nodes[segment + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 0.5) continue;

        // Debe coincidir con la curva cuadrática dibujada por OverlayWires.
        const control = {
            x: (a.x + b.x) / 2 + (-dy / length) * length * 0.18 * curveDir,
            y: (a.y + b.y) / 2 + (dx / length) * length * 0.18 * curveDir,
        };
        const samples = Math.max(12, Math.ceil(length / 24));
        for (let step = segment === 0 ? 0 : 1; step <= samples; step++) {
            const t = step / samples;
            const inverse = 1 - t;
            path.push({
                x: inverse * inverse * a.x + 2 * inverse * t * control.x + t * t * b.x,
                y: inverse * inverse * a.y + 2 * inverse * t * control.y + t * t * b.y,
            });
        }
    }

    return path;
}

/**
 * Devuelve TODOS los candidatos bajo el puntero, ordenados de forma estable.
 * `canvasPt` en píxeles CSS del canvas; `scenePt` el mismo punto en metros.
 */
export function hitTestAtPoint(
    scene: HitTestScene,
    canvasPt: { x: number; y: number },
    scenePt: { x: number; y: number },
    sceneToCanvas: SceneToCanvas,
    options: HitTestOptions = {},
): HitCandidate[] {
    const tol = options.tolerancePx ?? 15;
    const doorTol = options.doorTolerancePx ?? 18;
    const deviceTol = options.deviceTolerancePx ?? 20;
    const candidates: HitCandidate[] = [];
    const isSelectable = options.isSelectable ?? (() => true);

    const pushPoint = (id: string, kind: HitKind, xM: number, yM: number, kindTol: number) => {
        const p = sceneToCanvas(xM, yM);
        const d = Math.hypot(p.x - canvasPt.x, p.y - canvasPt.y);
        if (d <= kindTol && isSelectable(id, kind)) {
            candidates.push({ id, kind, priority: PRIORITY[kind], distPx: d });
        }
    };

    for (const s of scene.lightSwitches ?? []) pushPoint(s.id, 'switch', s.x, s.y, tol);
    for (const d of scene.electricalDevices ?? []) pushPoint(d.id, 'electrical-device', d.x, d.y, deviceTol);
    for (const f of scene.fixtures ?? []) pushPoint(f.id, 'fixture', f.x, f.y, tol);

    const walls = scene.walls ?? [];
    for (const w of scene.windows ?? []) {
        const wall = walls.find((candidate) => candidate.id === w.wallId);
        if (!wall) continue;
        const pos = resolveOffsetOnWall(wall, w.offsetAlongWall);
        if (pos) pushPoint(w.id, 'window', pos.x, pos.y, tol);
    }
    for (const d of scene.doors ?? []) {
        const wall = walls.find((candidate) => candidate.id === d.wallId);
        if (!wall) continue;
        const pos = resolveOffsetOnWall(wall, d.offsetAlongWall + d.width / 2);
        if (pos) pushPoint(d.id, 'door', pos.x, pos.y, doorTol);
    }

    // Conductores: polilínea nodo origen → waypoints → nodo destino
    const nodeById = new Map<string, { x: number; y: number }>();
    for (const f of scene.fixtures ?? []) nodeById.set(f.id, { x: f.x, y: f.y });
    for (const s of scene.lightSwitches ?? []) nodeById.set(s.id, { x: s.x, y: s.y });
    for (const d of scene.electricalDevices ?? []) nodeById.set(d.id, { x: d.x, y: d.y });
    for (const c of scene.conductors ?? []) {
        if (!isSelectable(c.id, 'conductor')) continue;
        const src = nodeById.get(c.sourceId);
        const dst = nodeById.get(c.targetId);
        if (!src || !dst) continue;
        const path = conductorPathCanvasPx(c, [src, ...(c.waypoints ?? []), dst], sceneToCanvas);
        const d = distToPolylinePx(canvasPt, path, (x, y) => ({ x, y }));
        if (d <= tol) {
            candidates.push({ id: c.id, kind: 'conductor', priority: PRIORITY.conductor, distPx: d });
        }
    }

    for (const c of scene.canopies ?? []) {
        if (!isSelectable(c.id, 'canopy')) continue;
        const d = distToPolylinePx(canvasPt, [{ x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }], sceneToCanvas);
        if (d <= tol) candidates.push({ id: c.id, kind: 'canopy', priority: PRIORITY.canopy, distPx: d });
    }

    for (const w of walls) {
        if (!isSelectable(w.id, 'wall')) continue;
        const d = distToPolylinePx(canvasPt, w.vertices, sceneToCanvas);
        if (d <= tol) candidates.push({ id: w.id, kind: 'wall', priority: PRIORITY.wall, distPx: d });
    }
    for (const p of scene.partitions ?? []) {
        if (!isSelectable(p.id, 'partition')) continue;
        const d = distToPolylinePx(canvasPt, p.vertices, sceneToCanvas);
        if (d <= tol) candidates.push({ id: p.id, kind: 'partition', priority: PRIORITY.partition, distPx: d });
    }

    // Rooms: el puntero dentro del polígono cuenta como acierto (dist 0);
    // cerca del borde también, para poder agarrarlos desde el contorno.
    for (const r of scene.rooms ?? []) {
        if (!isSelectable(r.id, 'room')) continue;
        if (r.vertices.length < 3) continue;
        const inside = pointInPolygon(scenePt, r.vertices);
        const edgePx = distToPolylinePx(canvasPt, r.vertices, sceneToCanvas, true);
        if (!inside && edgePx > tol) continue;
        const isEnclosure = !r.roomType || r.roomType === 'room';
        candidates.push({
            id: r.id,
            kind: 'room',
            priority: isEnclosure ? PRIORITY.room + 1 : PRIORITY.room,
            distPx: inside ? 0 : edgePx,
            areaM2: polygonAreaM2(r.vertices),
            roomType: r.roomType ?? 'room',
        });
    }

    return rankCandidates(candidates);
}

/** Orden estable: prioridad → área (contenedores, menor primero) → distancia → id. */
export function rankCandidates(candidates: HitCandidate[]): HitCandidate[] {
    return [...candidates].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const aArea = a.areaM2 ?? -1;
        const bArea = b.areaM2 ?? -1;
        if (aArea >= 0 && bArea >= 0 && aArea !== bArea) return aArea - bArea;
        if (a.distPx !== b.distPx) return a.distPx - b.distPx;
        return a.id.localeCompare(b.id);
    });
}

/**
 * Selección cíclica: si el usuario vuelve a clicar en el mismo sitio con los
 * mismos candidatos, avanza al siguiente de la lista en lugar de repetir el
 * primero. Así los tres objetos superpuestos son alcanzables (AC "Prueba E").
 */
export function cycleCandidate(
    ranked: HitCandidate[],
    currentSelectedId: string | null,
): HitCandidate | null {
    if (ranked.length === 0) return null;
    if (!currentSelectedId) return ranked[0];
    const idx = ranked.findIndex((c) => c.id === currentSelectedId);
    if (idx === -1) return ranked[0];
    return ranked[(idx + 1) % ranked.length];
}
