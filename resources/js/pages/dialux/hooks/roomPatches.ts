import { polygonAreaM2, polygonCentroid, polygonSignedArea, sanitizePolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Room, Vertex } from './types';

/** Entrada mínima para `buildPartitionEnclosurePatches` — un subconjunto de `Partition` (ver `hooks/types.ts`) para no acoplar `roomPatches.ts` a la capa de snapshot de cálculo. */
export interface PartitionPatchInput {
    vertices: Vertex[];
    thickness: number;
    height: number;
    bottomGap: number;
}

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
    /**
     * Semiancho REAL del parche en su plano tangente, en la misma base
     * `(tu, tv)` que `patchTangents` (`radiosityTransfer.ts`) deriva de
     * `normal` — SOLO para parches de PARED/PARTICIÓN (a lo largo de la
     * arista y vertical), Ronda 32 (2026-08-25). Antes de esto,
     * `patchVisibilityFraction` adivinaba un footprint CUADRADO isotrópico
     * `√área/2` para muestrear la sombra dura del propio parche — para un
     * tramo de pared subdividido (`wallVerticalSegments`/`horizontalSegments`)
     * el semiancho real (`segmentLength/2`, `segmentHeight/2`) es exacto por
     * construcción, más preciso que la aproximación cuadrada. Piso/techo
     * NUNCA definen estos campos (quedan `undefined` a propósito) — ver el
     * caso especial correspondiente en `patchVisibilityFraction`, que NO
     * usa footprint alguno para esos dos parches (el porqué está documentado
     * ahí: un solo parche sin subdividir cubriendo TODO el ambiente no tiene
     * ningún semiancho seguro que asignarle en un polígono cóncavo).
     * Opcional: sin definir, `radiosityTransfer.ts` cae al comportamiento
     * isotrópico `√área/2` de siempre (no disruptivo para cualquier
     * `EnclosurePatch` construido a mano, ej. en tests).
     */
    halfExtentU?: number;
    halfExtentV?: number;
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

    // Piso/techo: un solo parche cubre TODO el ambiente (no se subdividen,
    // límite conocido documentado más abajo) — NO se le asigna
    // `halfExtentU/V` a propósito. `radiosityTransfer.ts` (`patchVisibilityFraction`)
    // trata piso/techo como un caso especial (un único rayo al centroide, sin
    // muestreo de footprint) precisamente porque no hay ningún semiancho
    // seguro que asignarles: para un polígono cóncavo (muesca de jamba de
    // puerta, caso real "Caseta de Control", Módulo 22) incluso el bbox
    // recortado por `inset` deja esquinas de muestreo fuera del ambiente, ver
    // ese archivo para el porqué completo.
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
                    // Semiancho REAL del propio tramo subdividido (Ronda 32)
                    // — exacto por construcción, no una aproximación
                    // `√área/2`, ver doc de `EnclosurePatch.halfExtentU/V`.
                    halfExtentU: segmentLength / 2,
                    halfExtentV: segmentHeight / 2,
                });
            }
        }
    }

    return patches;
}

/**
 * Parches de las DOS caras de cada partición (Tabique/separador) como
 * superficies reflectantes de la interreflexión.
 *
 * Antes de esto, `buildRoomEnclosurePatches` solo generaba parches para el
 * PERÍMETRO del ambiente (piso/techo/pared por arista del polígono) —
 * las particiones interiores (divisores de cubículo de ducha/SS.HH) solo
 * existían como cajas opacas en `obstacles` (`buildPartitionOcclusionBoxes`),
 * es decir, absorbían el 100% de la luz que las tocaba en vez de reflejar
 * como el material real (melamina/drywall/mampostería, reflectancia
 * comparable a una pared). En un ambiente subdividido en cubículos por
 * particiones, el lado de cada cubículo más lejano de las luminarias pierde
 * tanto la luz DIRECTA (correctamente, la bloquea la partición) como
 * cualquier rebote de relleno de la propia partición (incorrectamente —
 * hallazgo real verificado contra "Módulo VII", proyecto con 3 particiones:
 * Uo=0.089/Emin=22 lx propio vs Uo≈0.41/Emin≈102 lx de DIALux evo para el
 * mismo ambiente y disposición de luminarias).
 *
 * Una partición no tiene "adentro"/"afuera" como una pared perimetral (no
 * encierra nada) — ambas caras son superficies reales, así que se genera un
 * parche por cada cara con normales opuestas. La reflectancia reutiliza la
 * misma `reflectances.wall` del ambiente (no existe un campo de reflectancia
 * propio en `Partition` todavía — el material declarado, melamina/drywall/
 * mampostería, es ópticamente comparable a una pared; el vidrio ya se
 * excluye antes de llamar aquí, igual que en `buildPartitionOcclusionBoxes`).
 *
 * `surfaceInsetM` es EL MISMO parámetro que ya usa `buildRoomEnclosurePatches`
 * para las paredes perimetrales (Ronda 25): la caja opaca de
 * `buildPartitionOcclusionBoxes` también centra el espesor en la línea de
 * `vertices`, así que muestrear justo en esa línea cae DENTRO de la caja y
 * ese parche nunca recibe luz directa ni transfiere nada. Se desplaza
 * `espesor partición/2 + ε` hacia cada lado, igual que una pared.
 */
export function buildPartitionEnclosurePatches(
    partitions: PartitionPatchInput[],
    reflectance: number,
    surfaceInsetM = 0,
): EnclosurePatch[] {
    const patches: EnclosurePatch[] = [];
    const clampedReflectance = clampReflectance(reflectance);

    for (const partition of partitions) {
        const vertices = partition.vertices;
        if (vertices.length < 2 || !(partition.height > partition.bottomGap)) {
            continue;
        }

        const cap = NEAR_FIELD_PATCH_CAP_M;
        const inset = Math.max(0, surfaceInsetM);
        const zFrom = Math.max(0, partition.bottomGap);
        const zTo = partition.height;
        const verticalSegments = wallVerticalSegments(zTo - zFrom, cap);
        const segmentHeight = (zTo - zFrom) / verticalSegments;

        for (let i = 0; i < vertices.length - 1; i++) {
            const a = vertices[i]!;
            const b = vertices[i + 1]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const length = Math.hypot(dx, dy);
            if (length < 1e-6) {
                continue;
            }
            // Dos normales opuestas (perpendiculares a la arista) — una por cada cara.
            const normals: Vector3[] = [
                { x: -dy / length, y: dx / length, z: 0 },
                { x: dy / length, y: -dx / length, z: 0 },
            ];

            const horizontalSegments = cap > 1e-6 ? Math.max(1, Math.ceil(length / cap)) : 1;
            const segmentLength = length / horizontalSegments;

            for (const normal of normals) {
                for (let h = 0; h < horizontalSegments; h++) {
                    const t = (h + 0.5) / horizontalSegments;
                    const px = a.x + dx * t + normal.x * inset;
                    const py = a.y + dy * t + normal.y * inset;
                    for (let k = 0; k < verticalSegments; k++) {
                        patches.push({
                            x: px,
                            y: py,
                            z: zFrom + segmentHeight * (k + 0.5),
                            normal,
                            area: segmentLength * segmentHeight,
                            reflectance: clampedReflectance,
                            // Ver doc de `EnclosurePatch.halfExtentU/V` (Ronda 32).
                            halfExtentU: segmentLength / 2,
                            halfExtentV: segmentHeight / 2,
                        });
                    }
                }
            }
        }
    }

    return patches;
}
