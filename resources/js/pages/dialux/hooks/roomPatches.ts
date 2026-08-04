import { polygonAreaM2, polygonCentroid, polygonSignedArea, sanitizePolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Room, Vertex } from './types';

/**
 * Fase 7 del plan maestro ("Materiales e interreflexión inicial", §11).
 * Discretiza la envolvente de un `Room` (piso, techo y un tramo de pared por
 * cada arista del polígono) en `EnclosurePatch` — parches ÚNICOS por
 * superficie (sin subdividir cada pared/techo en una malla más fina): el
 * plan reserva el refinamiento adaptativo de parches para la Fase 8
 * ("Interreflexión iterativa" — "Refinar superficies adaptativamente"), no
 * para esta. Cada parche sirve como emisor Lambertiano de la primera
 * reflexión difusa en `lightingEngineCore.ts`.
 */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface EnclosurePatch {
    x: number;
    y: number;
    z: number;
    normal: Vector3;
    /** Área de la superficie completa (m²) — piso/techo usan el área del polígono, cada pared usa longitud de arista × altura. */
    area: number;
    /** Reflectancia difusa (0-1), ya recortada a rango válido — ver `clampReflectance`. */
    reflectance: number;
}

export interface EnclosureReflectances {
    ceiling: number;
    wall: number;
    floor: number;
}

/** Recorta a [0,1] y descarta valores no finitos (NaN/Infinity → 0) — "limitar valores inválidos" (plan §11 Fase 7). */
export function clampReflectance(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}

/** Punto medio de una arista, en el marco XY del mundo. */
function edgeMidpoint(a: Vertex, b: Vertex): Vertex {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Normal horizontal unitaria de una arista, apuntando HACIA DENTRO del
 * recinto — una pared solo puede reflejar luz hacia el interior que la
 * ilumina, nunca hacia afuera.
 *
 * NO se determina comparando contra el centroide global del polígono: en un
 * recinto cóncavo (L/U/T) el centroide puede caer fuera del polígono o del
 * lado "equivocado" de una arista específica, invirtiendo la normal de esa
 * pared en silencio (subestima su iluminancia sin ningún aviso). En cambio,
 * se deriva del sentido de recorrido del anillo (`polygonSignedArea`), que
 * es una propiedad puramente local a cada arista y válida para cualquier
 * polígono simple, convexo o no: en un anillo antihorario (área con signo
 * positiva, convención de `polygonGeometry.ts`) el interior queda siempre a
 * la IZQUIERDA de cada arista dirigida — rotar el vector de la arista 90°
 * antihorario da la normal hacia dentro. En un anillo horario, es al revés.
 */
function inwardWallNormal(a: Vertex, b: Vertex, isCounterClockwise: boolean): Vector3 {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
        return { x: 0, y: 0, z: 0 };
    }
    return isCounterClockwise ? { x: -dy / len, y: dx / len, z: 0 } : { x: dy / len, y: -dx / len, z: 0 };
}

/**
 * Construye los parches de la envolvente de `room` (piso, techo, una pared
 * por arista) con su reflectancia difusa ya asignada. Devuelve `[]` cuando
 * el recinto no tiene polígono válido o altura no positiva — sin parches no
 * hay primera reflexión, comportamiento seguro por defecto.
 */
export function buildRoomEnclosurePatches(room: Room, reflectances: EnclosureReflectances): EnclosurePatch[] {
    const ring = sanitizePolygon(room.vertices);
    if (ring.length < 3 || !(room.height > 0)) {
        return [];
    }

    const floorArea = polygonAreaM2(ring);
    const centroid = polygonCentroid(ring);
    if (floorArea < 1e-6 || !centroid) {
        return [];
    }
    const isCounterClockwise = polygonSignedArea(ring) >= 0;

    const ceilingReflectance = clampReflectance(reflectances.ceiling);
    const wallReflectance = clampReflectance(reflectances.wall);
    const floorReflectance = clampReflectance(reflectances.floor);

    const patches: EnclosurePatch[] = [
        {
            x: centroid.x,
            y: centroid.y,
            z: 0,
            normal: { x: 0, y: 0, z: 1 },
            area: floorArea,
            reflectance: floorReflectance,
        },
        {
            x: centroid.x,
            y: centroid.y,
            z: room.height,
            normal: { x: 0, y: 0, z: -1 },
            area: floorArea,
            reflectance: ceilingReflectance,
        },
    ];

    for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 1e-6) {
            continue;
        }

        const mid = edgeMidpoint(a, b);
        const normal = inwardWallNormal(a, b, isCounterClockwise);
        patches.push({
            x: mid.x,
            y: mid.y,
            z: room.height / 2,
            normal,
            area: length * room.height,
            reflectance: wallReflectance,
        });
    }

    return patches;
}
