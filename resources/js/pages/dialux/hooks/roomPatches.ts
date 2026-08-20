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
 * Cuántas bandas verticales necesita UNA pared para que la aproximación
 * punto-a-parche (usada en `firstBounceReflection.ts`/`iterativeRadiosity.ts`)
 * siga siendo válida — "razonable en campo lejano" según el propio
 * comentario de ese módulo, pero que colapsa en recintos angostos y altos:
 * verificado contra un caso real (SS.HH, piso 2.15 m², altura 4.67 m →
 * pared completa ≈28 m² como UN solo parche) donde la radiosidad iterativa
 * convergía a ~2x la contribución de interreflexión que reporta DIALux evo
 * para el mismo recinto/reflectancias — la relación total/directo empírica
 * (293.8/150.1≈1.96) coincidía con el límite asintótico teórico 1/(1-ρ̄) del
 * método de cavidad zonal, es decir: el solver converge bien, el problema es
 * que un parche de pared mucho más grande que la propia sección del
 * recinto ya no se comporta como una fuente lejana para los puntos de malla
 * cercanos a esa pared.
 *
 * Cota elegida: ningún parche de pared debe ser más alto que `cap` (la
 * dimensión horizontal más corta del recinto, acotada además por
 * `NEAR_FIELD_PATCH_CAP_M` — ver su doc).
 */
/**
 * Cota ABSOLUTA de campo cercano para el lado de un parche de pared (m) —
 * Ronda 25 (2026-08-19). Acotar solo por la dimensión más corta del recinto
 * no basta: en un aula real de 43 m² (Vinchos, 7.1×6.2 m) las paredes
 * quedaban como parches de ~3.5×3 m y la radiosidad punto-a-parche
 * sobre-transfería (+17%/+24% sobre DIALux evo), mientras que en recintos
 * chicos (Módulo 22, cap≈0.8 m) el mismo solver clavaba +1-5%. Barrido de
 * convergencia medido sobre AMBOS proyectos reales (promedio vs. evo):
 *
 *   cap→   ∞        2.0      1.5      1.0      0.6      0.5      0.4      0.3
 *   VIN:   +17/+24  -5/0     -3/+1    -1/+4    +1/+4    -2/+3    0/+4     -1/+3
 *   M22:   +13/+11  +13/+11  -7/+11   -4/+11   +1/+5    +3/+2    -3/+1    +1/+7
 *
 * De 0.6 hacia abajo solo oscila ±3% (ruido de muestreo, sin tendencia) —
 * 0.6 m es la meseta de convergencia, del orden del espaciado de la malla
 * de evaluación, con costo O(P²) todavía trivial. Los parches de piso/techo
 * siguen siendo únicos (límite conocido — los resultados medidos convergen
 * bien sin subdividirlos).
 */
const NEAR_FIELD_PATCH_CAP_M = 0.6;

function wallVerticalSegments(height: number, cap: number): number {
    if (!(cap > 1e-6)) {
        return 1;
    }
    return Math.max(1, Math.ceil(height / cap));
}

/**
 * Construye los parches de la envolvente de `room` (piso, techo, una pared
 * por arista — subdividida en bandas verticales cuando el recinto es
 * angosto/alto, ver `wallVerticalSegments`) con su reflectancia difusa ya
 * asignada. Devuelve `[]` cuando el recinto no tiene polígono válido o
 * altura no positiva — sin parches no hay primera reflexión, comportamiento
 * seguro por defecto.
 */
export function buildRoomEnclosurePatches(
    room: Room,
    reflectances: EnclosureReflectances,
    /**
     * Desplazamiento hacia el interior (m) del punto de muestreo de cada
     * parche de PARED — Ronda 25 (2026-08-19): las aristas del polígono del
     * ambiente coinciden con la línea central de los muros de oclusión, así
     * que un parche muestreado exactamente en `mid` queda DENTRO de la caja
     * opaca (`segmentOcclusion.ts` centra el espesor en esa línea) y recibe
     * 0 lx directo → la interreflexión entera colapsaba a 0 con oclusión
     * activa. El parche representa la CARA INTERIOR del muro, que
     * físicamente está a espesor/2 hacia adentro — el llamador pasa
     * `máx(espesor de obstáculo)/2 + ε` (0 sin oclusión → sin cambio de
     * comportamiento). Se recorta a un cuarto de la dimensión horizontal
     * más corta para no deformar recintos muy angostos.
     */
    surfaceInsetM = 0,
): EnclosurePatch[] {
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

    const xs = ring.map((vertex) => vertex.x);
    const ys = ring.map((vertex) => vertex.y);
    const cap = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), NEAR_FIELD_PATCH_CAP_M);
    const segments = wallVerticalSegments(room.height, cap);
    const segmentHeight = room.height / segments;
    const inset = Math.min(Math.max(0, surfaceInsetM), cap / 4);

    for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 1e-6) {
            continue;
        }

        const normal = inwardWallNormal(a, b, isCounterClockwise);
        // Ronda 25: misma cota de campo cercano que `wallVerticalSegments`,
        // aplicada A LO LARGO de la arista — en un recinto angosto (SS.HH
        // real: paredes de 2.21 m en un recinto de 0.83 m de ancho) un
        // parche de pared más largo que el propio ancho del recinto queda en
        // campo cercano de los puntos de malla y la radiosidad iterativa
        // sobre-transfiere (convergía al asíntota 1/(1-ρ̄) de cavidad zonal,
        // +38% sobre DIALux evo, verificado con la matriz de diagnóstico del
        // 2026-08-19). Para recintos normales (aristas ≤ dimensión más
        // corta) da 1 tramo — sin cambio de comportamiento.
        const horizontalSegments = cap > 1e-6 ? Math.max(1, Math.ceil(length / cap)) : 1;
        const segmentLength = length / horizontalSegments;
        for (let h = 0; h < horizontalSegments; h++) {
            const t = (h + 0.5) / horizontalSegments;
            const px = a.x + (b.x - a.x) * t + normal.x * inset;
            const py = a.y + (b.y - a.y) * t + normal.y * inset;
            for (let k = 0; k < segments; k++) {
                patches.push({
                    x: px,
                    y: py,
                    z: segmentHeight * (k + 0.5),
                    normal,
                    area: segmentLength * segmentHeight,
                    reflectance: wallReflectance,
                });
            }
        }
    }

    return patches;
}
