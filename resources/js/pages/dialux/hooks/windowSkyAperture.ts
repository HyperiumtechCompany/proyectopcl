import { polygonCentroid } from '@/pages/dialux/geometry/polygonGeometry';
import type { Room, Vertex, Wall, Window } from './types';

/**
 * Fase 17 del plan maestro ("Luz natural" — Daylight Factor, primer ciclo).
 * Ubica una `Window` en coordenadas del mundo y la subdivide en una grilla
 * fina de sub-aberturas hacia el cielo — necesario porque la aproximación de
 * campo lejano usada en `radiosityTransfer.ts::computeFormFactor`
 * (`dist² >> área`) se rompe cerca de una ventana grande, justo donde el
 * Daylight Factor es más alto. Subdividir reduce el área de cada sub-parche
 * hasta que la aproximación vuelve a ser válida — mismo principio que ya usa
 * la malla general de cálculo (`buildGrid`), aplicado aquí a la apertura.
 */
export interface SkyAperturePatch {
    x: number;
    y: number;
    z: number;
    /** Normal HACIA ADENTRO del recinto, unitaria — misma convención que `EnclosurePatch` (ver `resolveInwardNormal`). */
    normal: { x: number; y: number; z: number };
    /** Área de este sub-parche (m²). */
    area: number;
}

const DEFAULT_SUBDIVISION_COLS = 4;
const DEFAULT_SUBDIVISION_ROWS = 3;

function segmentLength(a: Vertex, b: Vertex): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Encuentra el segmento del muro (polilínea) que contiene el inicio de la
 * ventana y el offset local dentro de ese segmento.
 *
 * Limitación documentada: si una ventana cruza el vértice entre dos
 * segmentos de un muro no recto, esta función la trata como si perteneciera
 * ENTERA al primer segmento que la contiene (mismo criterio simplificado en
 * todo este módulo) — caso raro en la práctica (las ventanas casi siempre
 * están en tramos rectos de muro exterior); no se subdivide la ventana entre
 * segmentos como sí hace `domain/geometry/occlusionBoxes.ts` con las cajas
 * de oclusión.
 */
function resolveWindowSegment(wall: Wall, offsetAlongWall: number): { a: Vertex; b: Vertex; localOffset: number } | null {
    let cumulative = 0;
    for (let i = 0; i < wall.vertices.length - 1; i++) {
        const a = wall.vertices[i]!;
        const b = wall.vertices[i + 1]!;
        const segLen = segmentLength(a, b);
        if (segLen < 1e-6) {
            continue;
        }
        if (offsetAlongWall <= cumulative + segLen || i === wall.vertices.length - 2) {
            return { a, b, localOffset: offsetAlongWall - cumulative };
        }
        cumulative += segLen;
    }
    return null;
}

/**
 * Punto medio de `window` en coordenadas del mundo, sobre `wall` — expuesto
 * para que `daylightFactorEngine.ts` pueda verificar si una ventana realmente
 * está en el límite de un `Room` dado (una ventana en un muro de OTRO
 * recinto de la misma escena no debe aportarle luz natural). Devuelve `null`
 * si el muro no tiene un segmento válido para el offset de la ventana.
 */
export function resolveWindowMidpointWorld(window: Window, wall: Wall): Vertex | null {
    const segment = resolveWindowSegment(wall, window.offsetAlongWall);
    if (!segment) {
        return null;
    }
    const dirX = (segment.b.x - segment.a.x) / segmentLength(segment.a, segment.b);
    const dirY = (segment.b.y - segment.a.y) / segmentLength(segment.a, segment.b);
    const midAlong = segment.localOffset + window.width / 2;
    return { x: segment.a.x + dirX * midAlong, y: segment.a.y + dirY * midAlong };
}

/**
 * Normal HACIA ADENTRO del recinto (misma convención que
 * `roomPatches.ts::inwardWallNormal` — un `EnclosurePatch` siempre "emite"
 * hacia donde apunta su normal, y `skyIlluminance.ts` reutiliza esa misma
 * convención para el factor de forma: la luz de cielo entra por la ventana
 * HACIA DENTRO, así que el parche debe "mirar" hacia el interior, no hacia
 * el cielo). Se determina comparando contra el centroide del recinto: el
 * lado que SÍ mira hacia el centroide es el interior.
 *
 * Limitación documentada (igual que advierte `roomPatches.ts::inwardWallNormal`
 * para su propio caso): en un recinto cóncavo (L/U/T) el centroide puede caer
 * del lado "equivocado" para alguna arista específica e invertir la normal en
 * silencio. Resolverlo con precisión requeriría emparejar el muro de la
 * ventana con la arista real del polígono del recinto (como sí hace
 * `buildRoomEnclosurePatches`) — diferido: los recintos con ventanas de este
 * primer ciclo son mayormente rectangulares/convexos.
 */
function resolveInwardNormal(room: Room, midPoint: Vertex, dirX: number, dirY: number): { x: number; y: number; z: number } {
    // La normal SIEMPRE es perpendicular al muro (una ventana no "mira" en
    // diagonal) — solo el SIGNO (cuál de las dos perpendiculares) se decide
    // comparando contra el centroide del recinto.
    const perpA = { x: -dirY, y: dirX };
    const perpB = { x: dirY, y: -dirX };

    const centroid = polygonCentroid(room.vertices) ?? midPoint;
    const toCentroidX = centroid.x - midPoint.x;
    const toCentroidY = centroid.y - midPoint.y;

    const dotA = perpA.x * toCentroidX + perpA.y * toCentroidY;
    const inward = dotA > 0 ? perpA : perpB;
    return { x: inward.x, y: inward.y, z: 0 };
}

/**
 * Construye las sub-aberturas hacia el cielo de `window`, montada sobre
 * `wall`, para el cálculo de Daylight Factor de `room`. Devuelve `[]` si el
 * muro no tiene un segmento válido para el offset de la ventana.
 */
export function buildWindowSkyPatches(
    window: Window,
    wall: Wall,
    room: Room,
    subdivisionCols: number = DEFAULT_SUBDIVISION_COLS,
    subdivisionRows: number = DEFAULT_SUBDIVISION_ROWS,
): SkyAperturePatch[] {
    const segment = resolveWindowSegment(wall, window.offsetAlongWall);
    if (!segment) {
        return [];
    }

    const { a, localOffset } = segment;
    const dirX = (segment.b.x - segment.a.x) / segmentLength(segment.a, segment.b);
    const dirY = (segment.b.y - segment.a.y) / segmentLength(segment.a, segment.b);

    const midAlong = localOffset + window.width / 2;
    const midPoint: Vertex = { x: a.x + dirX * midAlong, y: a.y + dirY * midAlong };
    const normal = resolveInwardNormal(room, midPoint, dirX, dirY);

    const cols = Math.max(1, Math.floor(subdivisionCols));
    const rows = Math.max(1, Math.floor(subdivisionRows));
    const cellWidth = window.width / cols;
    const cellHeight = window.height / rows;
    const cellArea = cellWidth * cellHeight;
    if (cellArea < 1e-9) {
        return [];
    }

    const patches: SkyAperturePatch[] = [];
    for (let row = 0; row < rows; row++) {
        const z = window.sillHeight + (row + 0.5) * cellHeight;
        for (let col = 0; col < cols; col++) {
            const along = localOffset + (col + 0.5) * cellWidth;
            patches.push({
                x: a.x + dirX * along,
                y: a.y + dirY * along,
                z,
                normal,
                area: cellArea,
            });
        }
    }

    return patches;
}
