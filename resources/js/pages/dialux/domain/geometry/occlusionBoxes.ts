import type { Door, Partition, Vertex, Wall, Window } from '@/pages/dialux/hooks/types';

/**
 * Fase 6 del plan maestro ("Visibilidad, oclusión y sombras", §11). Genera,
 * de forma PURA (sin Babylon, ver plan §4.1), una lista plana de prismas
 * opacos ("cajas") a partir de `Wall`/`Window`/`Door`/`Partition` — la misma
 * geometría que hoy solo existe como lógica de render acoplada a Babylon en
 * `engine/House3DBuilder.ts` (descomposición muro→cajas sólidas + antepecho +
 * vidrio + dintel, sin CSG). Se REIMPLEMENTA aquí de forma independiente en
 * vez de compartir código con `House3DBuilder.ts`: ese archivo sigue
 * congelado (Fase 2, sin tests, acoplamiento legacy con `Conductor`) y no es
 * seguro extraerle lógica todavía.
 *
 * Cada caja se representa en su propio marco local (origen = inicio del
 * segmento, eje X a lo largo del muro/partición, eje Z vertical) porque los
 * muros pueden tener cualquier orientación en el plano XY — `segmentOcclusion.ts`
 * hace el test de intersección transformando el rayo a ese marco.
 */
export interface OcclusionBox {
    originX: number;
    originY: number;
    /** Ángulo del eje X local (dirección del segmento de muro/partición), radianes. */
    angleRad: number;
    /** Extensión a lo largo del eje X local, metros. */
    length: number;
    /** Extensión a lo largo del eje Y local (espesor del muro/partición), metros. */
    thickness: number;
    zMin: number;
    zMax: number;
}

interface LinearOpening {
    /** Offset acumulado desde `vertices[0]`, a lo largo de toda la polilínea. */
    offset: number;
    width: number;
    zFrom: number;
    zTo: number;
}

const MIN_BOX_LENGTH = 1e-4; // metros — evita cajas degeneradas por errores de redondeo.
const CLOSED_RING_EPSILON = 1e-3; // metros — margen para "primer vértice == último vértice".
const AXIS_TOLERANCE = 1e-3; // metros — cuánto puede desviarse un tramo de ser horizontal/vertical puro.

function segmentLength(a: Vertex, b: Vertex): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Ronda 21l/22 — el editor, al dibujar un muro con una jamba/receso de
 * puerta (o cualquier muro con más de un tramo recto), guarda
 * `wall.vertices` como el CONTORNO CERRADO completo del muro (primer punto
 * == último punto, el grosor ya incluido en la geometría — verificado
 * contra los 2 muros reales del proyecto "Vinchos": 25-27 vértices cada
 * uno, forma de U con 2 giros de 90° y una muesca de jamba, NO un tramo
 * recto simple), no la polilínea de 2 puntos que `Wall.vertices` documenta
 * ("≥ 2 puntos", `hooks/types.ts`). Un primer intento (Ronda 22, revertido)
 * intentó reducir el contorno a sus 2 vértices más distantes — funcionaba
 * en un caso sintético de un solo tramo, pero contra los muros reales (con
 * giros) colapsaba la forma en U a una diagonal sin sentido físico y
 * producía puntos en 0 lx. La corrección real (esta) descompone el
 * contorno GEOMÉTRICAMENTE en rectángulos exactos (`decomposeClosedRing`),
 * sin asumir ninguna forma particular — vale para un tramo recto, una L,
 * una U, o cualquier combinación de giros de 90°, siempre que el muro sea
 * ortogonal (todos los giros exactamente 90°, verificado con
 * `isRectilinearInFrame`; si no lo es, se usa el comportamiento anterior —
 * una caja por segmento del contorno — como respaldo seguro conocido, no
 * una geometría nueva sin probar).
 */
function isClosedRing(vertices: Vertex[]): boolean {
    if (vertices.length < 4) {
        return false;
    }
    const first = vertices[0]!;
    const last = vertices[vertices.length - 1]!;
    return segmentLength(first, last) < CLOSED_RING_EPSILON;
}

/** Ángulo (radianes) del tramo más largo del contorno — marco local candidato para volverlo ortogonal. */
function dominantAngle(vertices: Vertex[]): number {
    let bestLen = -1;
    let angle = 0;
    for (let i = 0; i < vertices.length - 1; i++) {
        const a = vertices[i]!;
        const b = vertices[i + 1]!;
        const len = segmentLength(a, b);
        if (len > bestLen) {
            bestLen = len;
            angle = Math.atan2(b.y - a.y, b.x - a.x);
        }
    }
    return angle;
}

function rotate(v: Vertex, angleRad: number): Vertex {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return { x: v.x * cos + v.y * sin, y: -v.x * sin + v.y * cos };
}

/** `true` si, en el marco rotado por `-angle`, cada tramo del contorno es horizontal o vertical puro (dentro de `AXIS_TOLERANCE`). */
function isRectilinearInFrame(vertices: Vertex[], angle: number): boolean {
    for (let i = 0; i < vertices.length - 1; i++) {
        const a = rotate(vertices[i]!, angle);
        const b = rotate(vertices[i + 1]!, angle);
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dx > AXIS_TOLERANCE && dy > AXIS_TOLERANCE) {
            return false;
        }
    }
    return true;
}

interface AxisRect {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}

/**
 * Para un contorno YA axis-aligned (todo tramo horizontal o vertical),
 * encuentra los intervalos Y dentro del polígono en `x = xMid` (regla par-
 * impar estándar: cada tramo HORIZONTAL cuyo rango en X contiene `xMid`
 * aporta un cruce; los tramos verticales nunca cruzan un `xMid` estrictamente
 * entre dos coordenadas X distintas del contorno, así que no hace falta
 * tratarlos aparte).
 */
function verticalCrossingsAt(vertices: Vertex[], xMid: number): number[] {
    const ys: number[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
        const a = vertices[i]!;
        const b = vertices[i + 1]!;
        const lo = Math.min(a.x, b.x);
        const hi = Math.max(a.x, b.x);
        if (xMid > lo && xMid < hi) {
            ys.push(a.y); // horizontal: a.y === b.y dentro de AXIS_TOLERANCE
        }
    }
    return ys.sort((p, q) => p - q);
}

/**
 * Descompone un contorno rectilíneo simple (ya en su marco axis-aligned) en
 * rectángulos EXACTOS que cubren la misma área — algoritmo de barrido
 * estándar: una franja vertical por cada par de coordenadas X consecutivas
 * del contorno, y dentro de cada franja, un rectángulo por cada par de
 * cruces Y (regla par-impar). Correcto para cualquier forma ortogonal (recta,
 * L, T, U, con o sin muescas) — no asume ninguna forma particular.
 */
function decomposeClosedRing(vertices: Vertex[]): AxisRect[] {
    const xsRaw = vertices.map((v) => v.x).sort((a, b) => a - b);
    const xs: number[] = [];
    for (const x of xsRaw) {
        if (xs.length === 0 || x - xs[xs.length - 1]! > AXIS_TOLERANCE) {
            xs.push(x);
        }
    }

    const rects: AxisRect[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
        const x1 = xs[i]!;
        const x2 = xs[i + 1]!;
        if (x2 - x1 < MIN_BOX_LENGTH) {
            continue;
        }
        const xMid = (x1 + x2) / 2;
        const crossings = verticalCrossingsAt(vertices, xMid);
        for (let k = 0; k + 1 < crossings.length; k += 2) {
            const y1 = crossings[k]!;
            const y2 = crossings[k + 1]!;
            if (y2 - y1 >= MIN_BOX_LENGTH) {
                rects.push({ x1, x2, y1, y2 });
            }
        }
    }
    return rects;
}

/**
 * Punto de entrada para un muro/partición guardado como contorno cerrado:
 * rota al marco del tramo más largo, verifica que sea ortogonal ahí, y
 * descompone en rectángulos exactos — cada uno se vuelve una `OcclusionBox`
 * extruida en `[zFrom, zTo]`. Si el contorno NO es ortogonal (algún giro
 * que no es de 90°, caso no visto todavía en datos reales), no se arriesga
 * una geometría nueva sin probar: se devuelve `null` y el llamador cae al
 * comportamiento anterior (una caja por segmento del contorno, conocido).
 *
 * LÍMITE CONOCIDO, documentado (no hallado en los proyectos reales de hoy —
 * Vinchos no tiene ningún `Door`/`Window` con `wallId` apuntando a un muro
 * de contorno cerrado): las aberturas (`openings`, puertas/ventanas) NO se
 * recortan aquí — `offsetAlongWall` se definió para una polilínea simple de
 * 2 puntos y no tiene un mapeo directo a las coordenadas de un contorno con
 * giros. Si un proyecto real llega a necesitar una puerta/ventana sobre un
 * muro de contorno cerrado, hace falta extender esto — por ahora ese muro
 * queda completamente opaco (más conservador que dejarlo sin oclusión, pero
 * no modela el vano).
 *
 * Ronda 24 (2026-08-19) — hallazgo real contra un SEGUNDO proyecto
 * (Módulo 22, no solo Vinchos): el contorno reconstruye matemáticamente
 * bien (el área del `decomposeClosedRing` coincide exacta con el área del
 * polígono por la fórmula estándar — el algoritmo en sí no tiene bug), pero
 * el propio contorno de ese muro real describe un área ~7 veces mayor que
 * un muro delgado de 0.13 m debería tener para su longitud — el patrón de
 * "el contorno guardado no representa un muro delgado real" no es un caso
 * único de Vinchos, es recurrente en datos reales de este editor. Por eso
 * el ESPESOR de cada caja NUNCA se toma del contorno (`r.y2-r.y1`, que
 * hereda ese error) — se usa siempre `declaredThicknessM`, el escalar que
 * el propio muro declara (`wall.thickness`), mucho menos propenso a estar
 * corrupto que un polígono de 10+ vértices. El contorno solo aporta la
 * LONGITUD/posición de cada tramo (giros, muescas) — ahí sí es información
 * real que el `wall.thickness` por sí solo no puede dar.
 */
function buildClosedRingOcclusionBoxes(
    vertices: Vertex[],
    declaredThicknessM: number,
    zFrom: number,
    zTo: number,
): OcclusionBox[] | null {
    const angle = dominantAngle(vertices);
    if (!isRectilinearInFrame(vertices, angle)) {
        return null;
    }

    const rotated = vertices.map((v) => rotate(v, angle));
    const rects = decomposeClosedRing(rotated);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return rects.map((r): OcclusionBox => {
        // (x1, y1) del marco rotado, de vuelta al mundo: rotate() usa el
        // ángulo -angle (mundo→local); la inversa es +angle (local→mundo).
        const originX = r.x1 * cos - r.y1 * sin;
        const originY = r.x1 * sin + r.y1 * cos;
        return { originX, originY, angleRad: angle, length: r.x2 - r.x1, thickness: declaredThicknessM, zMin: zFrom, zMax: zTo };
    });
}

/**
 * Descompone una polilínea (muro o partición) en cajas opacas, respetando
 * aberturas (`openings`) que dejan un hueco transparente en el rango
 * `[zFrom, zTo]` de esa franja — replica la idea de "antepecho + vidrio +
 * dintel" de `House3DBuilder.ts` sin generar el vidrio como mesh (el vidrio
 * de una ventana es, para el solver de oclusión, sencillamente NO opaco).
 *
 * `baseZFrom`/`baseZTo` son el rango vertical opaco de la polilínea SIN
 * ninguna abertura (muros: `[0, wall.height]`; particiones: `[bottomGap, height]`
 * — el "bottomGap" de una partición aplica a TODA la partición, no solo a
 * sus puertas).
 */
function buildLinearOcclusionBoxes(
    rawVertices: Vertex[],
    thickness: number,
    baseZFrom: number,
    baseZTo: number,
    openings: LinearOpening[],
): OcclusionBox[] {
    if (rawVertices.length < 2 || baseZTo <= baseZFrom) {
        return [];
    }

    if (isClosedRing(rawVertices)) {
        const decomposed = buildClosedRingOcclusionBoxes(rawVertices, thickness, baseZFrom, baseZTo);
        if (decomposed) {
            return decomposed;
        }
        // No ortogonal — no arriesgar geometría nueva sin probar, cae al
        // comportamiento anterior (una caja por segmento del contorno).
    }

    const vertices = rawVertices;
    const boxes: OcclusionBox[] = [];
    let cumulative = 0;

    for (let i = 0; i < vertices.length - 1; i++) {
        const start = vertices[i]!;
        const end = vertices[i + 1]!;
        const segLen = segmentLength(start, end);
        if (segLen < MIN_BOX_LENGTH) {
            continue;
        }

        const segStart = cumulative;
        const segEnd = cumulative + segLen;
        cumulative = segEnd;
        const angleRad = Math.atan2(end.y - start.y, end.x - start.x);

        const emit = (localFrom: number, localTo: number, zFrom: number, zTo: number) => {
            const len = localTo - localFrom;
            if (len < MIN_BOX_LENGTH || zTo - zFrom < MIN_BOX_LENGTH) {
                return;
            }
            const originX = start.x + Math.cos(angleRad) * localFrom;
            const originY = start.y + Math.sin(angleRad) * localFrom;
            boxes.push({ originX, originY, angleRad, length: len, thickness, zMin: zFrom, zMax: zTo });
        };

        // Aberturas que caen (aunque sea parcialmente) dentro de este segmento,
        // recortadas a los límites locales del segmento.
        const segmentOpenings = openings
            .map((o) => ({
                localFrom: Math.max(0, o.offset - segStart),
                localTo: Math.min(segLen, o.offset + o.width - segStart),
                zFrom: Math.max(baseZFrom, o.zFrom),
                zTo: Math.min(baseZTo, o.zTo),
            }))
            .filter((o) => o.localTo > o.localFrom && o.zTo > o.zFrom)
            .sort((a, b) => a.localFrom - b.localFrom);

        let cursor = 0;
        for (const opening of segmentOpenings) {
            emit(cursor, opening.localFrom, baseZFrom, baseZTo);
            emit(opening.localFrom, opening.localTo, baseZFrom, opening.zFrom); // debajo (antepecho)
            emit(opening.localFrom, opening.localTo, opening.zTo, baseZTo); // encima (dintel)
            cursor = Math.max(cursor, opening.localTo);
        }
        emit(cursor, segLen, baseZFrom, baseZTo);
    }

    return boxes;
}

/**
 * Cajas opacas de todos los muros de una escena. `windows`/`doors` son
 * "recortes" (`wallId` + `offsetAlongWall`, ver `hooks/types.ts`) — el vidrio
 * de una ventana NO genera caja (es transparente para el solver); la puerta
 * tampoco en su tramo de paso libre. Solo se consideran `doors` con `wallId`
 * (las que tienen `partitionId` las procesa `buildPartitionOcclusionBoxes`).
 */
export function buildWallOcclusionBoxes(walls: Wall[], windows: Window[], doors: Door[]): OcclusionBox[] {
    const boxes: OcclusionBox[] = [];

    for (const wall of walls) {
        const openings: LinearOpening[] = [
            ...windows
                .filter((w) => w.wallId === wall.id)
                .map((w) => ({ offset: w.offsetAlongWall, width: w.width, zFrom: w.sillHeight, zTo: w.sillHeight + w.height })),
            ...doors
                .filter((d) => d.wallId === wall.id && !d.partitionId)
                .map((d) => ({ offset: d.offsetAlongWall, width: d.width, zFrom: d.bottomGap ?? 0, zTo: d.height })),
        ];

        boxes.push(...buildLinearOcclusionBoxes(wall.vertices, wall.thickness, 0, wall.height, openings));
    }

    return boxes;
}

/**
 * Cajas opacas de particiones. Las de vidrio (`partitionType === 'glass'`,
 * ej. mamparas) se tratan como completamente transparentes — no generan
 * ninguna caja — por la misma razón que el vidrio de una ventana: son
 * geométricamente sólidas pero ópticamente no opacas, y este solver de
 * oclusión Fase 6 no modela transmitancia parcial (documentado como
 * pendiente en `planes/fase6_progreso_dialux.md`).
 */
export function buildPartitionOcclusionBoxes(partitions: Partition[], doors: Door[]): OcclusionBox[] {
    const boxes: OcclusionBox[] = [];

    for (const partition of partitions) {
        if (partition.partitionType === 'glass') {
            continue;
        }

        const openings: LinearOpening[] = doors
            .filter((d) => d.partitionId === partition.id)
            .map((d) => ({ offset: d.offsetAlongWall, width: d.width, zFrom: 0, zTo: d.height }));

        boxes.push(
            ...buildLinearOcclusionBoxes(partition.vertices, partition.thickness, partition.bottomGap, partition.height, openings),
        );
    }

    return boxes;
}
