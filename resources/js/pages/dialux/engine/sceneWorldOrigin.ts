/**
 * sceneWorldOrigin.ts — Recentrado de escenas georreferenciadas para el render 3D.
 *
 * Cuando el plano importado viene georreferenciado en UTM (coordenadas del
 * orden de cientos de miles / millones de metros), Babylon.js falla: por un
 * lado `House3DBuilder` descarta como "corruptos" los vértices más allá de
 * `MAX_ROOM_COORD_M`, y por otro las matrices de Babylon son `Float32Array`,
 * cuyo ULP a ~9·10⁶ es de ~1 m — la geometría se cuantiza y el modelo se
 * deforma (paredes torcidas, huecos, "picos").
 *
 * Solución: SOLO para alimentar el `House3DBuilder` se trabaja sobre una copia
 * de la escena trasladada `-origin`, con el origen calculado a partir de la
 * propia geometría. El store NUNCA se toca — el 3D es puramente visual y el
 * cálculo lumínico es invariante a la traslación (Em, Uo, UGR y cantidades no
 * cambian). El 2D, mlightcad, las exportaciones y el snapshot siguen usando
 * las coordenadas originales.
 *
 * Para proyectos que ya están cerca del origen (el caso normal), `computeWorldOrigin`
 * devuelve `null` y no se traslada nada: comportamiento idéntico al anterior.
 */

import type {
    LightingResult,
    Scene as EditorScene,
    Vertex,
} from '@/pages/dialux/hooks/useEditorStore';

/**
 * Más allá de este radio (m) desde el origen, la precisión `float32` de las
 * matrices de Babylon deja de ser suficiente (a 20 km el ULP ya ronda el cm).
 * Ninguna edificación real lo supera estando bien centrada, así que por debajo
 * de este valor no se traslada nada.
 */
const FAR_FROM_ORIGIN_THRESHOLD_M = 2_000;

export interface WorldOrigin {
    x: number;
    y: number;
}

function* iterAbsolutePoints(
    scenes: EditorScene[],
): Generator<{ x: number; y: number }> {
    for (const scene of scenes) {
        for (const room of scene.rooms ?? []) {
            for (const v of room.vertices ?? []) yield v;
        }
        for (const wall of scene.walls ?? []) {
            for (const v of wall.vertices ?? []) yield v;
        }
        for (const partition of scene.partitions ?? []) {
            for (const v of partition.vertices ?? []) yield v;
        }
        for (const obstacle of scene.structuralObstacles ?? []) {
            for (const v of obstacle.vertices ?? []) yield v;
        }
        for (const f of scene.fixtures ?? []) yield { x: f.x, y: f.y };
        for (const c of scene.canopies ?? []) {
            yield { x: c.x1, y: c.y1 };
            yield { x: c.x2, y: c.y2 };
        }
        for (const d of scene.electricalDevices ?? []) yield { x: d.x, y: d.y };
        for (const s of scene.lightSwitches ?? []) yield { x: s.x, y: s.y };
        for (const j of scene.junctionBoxes ?? []) yield { x: j.x, y: j.y };
    }
}

/**
 * Offset a restar para el render 3D, o `null` si la escena ya está cerca del
 * origen (no hace falta trasladar). Se redondea hacia abajo a 10 m para que
 * una edición pequeña de geometría no desplace el origen entre resyncs.
 */
export function computeWorldOrigin(scenes: EditorScene[]): WorldOrigin | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of iterAbsolutePoints(scenes)) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null; // sin geometría

    const farthest = Math.max(
        Math.abs(minX),
        Math.abs(minY),
        Math.abs(maxX),
        Math.abs(maxY),
    );
    if (farthest <= FAR_FROM_ORIGIN_THRESHOLD_M) return null;

    return { x: Math.floor(minX / 10) * 10, y: Math.floor(minY / 10) * 10 };
}

const shiftVerts = (
    verts: Vertex[] | undefined,
    dx: number,
    dy: number,
): Vertex[] => (verts ?? []).map((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));

/**
 * Copia de una escena con toda la geometría de coordenadas ABSOLUTAS trasladada
 * `-origin`. Campos relativos (offsetAlongWall de ventanas/puertas, guías de
 * grilla que son fracciones 0..1, alturas/elevaciones verticales) NO se tocan.
 */
export function translateSceneForRender(
    scene: EditorScene,
    origin: WorldOrigin,
): EditorScene {
    const { x: dx, y: dy } = origin;
    return {
        ...scene,
        rooms: (scene.rooms ?? []).map((r) => ({
            ...r,
            vertices: shiftVerts(r.vertices, dx, dy),
        })),
        walls: (scene.walls ?? []).map((w) => ({
            ...w,
            vertices: shiftVerts(w.vertices, dx, dy),
        })),
        partitions: (scene.partitions ?? []).map((p) => ({
            ...p,
            vertices: shiftVerts(p.vertices, dx, dy),
        })),
        structuralObstacles: (scene.structuralObstacles ?? []).map((o) => ({
            ...o,
            vertices: shiftVerts(o.vertices, dx, dy),
        })),
        fixtures: (scene.fixtures ?? []).map((f) => ({
            ...f,
            x: f.x - dx,
            y: f.y - dy,
        })),
        canopies: (scene.canopies ?? []).map((c) => ({
            ...c,
            x1: c.x1 - dx,
            y1: c.y1 - dy,
            x2: c.x2 - dx,
            y2: c.y2 - dy,
        })),
        electricalDevices: (scene.electricalDevices ?? []).map((d) => ({
            ...d,
            x: d.x - dx,
            y: d.y - dy,
        })),
        lightSwitches: (scene.lightSwitches ?? []).map((s) => ({
            ...s,
            x: s.x - dx,
            y: s.y - dy,
        })),
        junctionBoxes: (scene.junctionBoxes ?? []).map((j) => ({
            ...j,
            x: j.x - dx,
            y: j.y - dy,
        })),
        conductors: (scene.conductors ?? []).map((c) =>
            c.curveMidpoint
                ? {
                      ...c,
                      curveMidpoint: {
                          x: c.curveMidpoint.x - dx,
                          y: c.curveMidpoint.y - dy,
                      },
                  }
                : c,
        ),
        fixtureArrangements: (scene.fixtureArrangements ?? []).map((a) =>
            a.config.ambientVertices
                ? {
                      ...a,
                      config: {
                          ...a.config,
                          ambientVertices: shiftVerts(
                              a.config.ambientVertices,
                              dx,
                              dy,
                          ),
                      },
                  }
                : a,
        ),
    };
}

/**
 * Copia de un `LightingResult` con sus campos de coordenadas absolutas (origen
 * de la grilla isolux, observador UGR, contorno del recinto) trasladados
 * `-origin`. Los valores de lux, tamaños de celda y contadores son relativos y
 * no se tocan.
 */
export function translateLightingResultForRender(
    result: LightingResult,
    origin: WorldOrigin,
): LightingResult {
    const { x: dx, y: dy } = origin;
    return {
        ...result,
        grid_origin_x:
            result.grid_origin_x != null ? result.grid_origin_x - dx : result.grid_origin_x,
        grid_origin_y:
            result.grid_origin_y != null ? result.grid_origin_y - dy : result.grid_origin_y,
        ugr_observer_x:
            result.ugr_observer_x != null ? result.ugr_observer_x - dx : result.ugr_observer_x,
        ugr_observer_y:
            result.ugr_observer_y != null ? result.ugr_observer_y - dy : result.ugr_observer_y,
        room_vertices: result.room_vertices
            ? shiftVerts(result.room_vertices, dx, dy)
            : result.room_vertices,
    };
}
