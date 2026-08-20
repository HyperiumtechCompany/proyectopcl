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

function segmentLength(a: Vertex, b: Vertex): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Historia de los contornos cerrados (Rondas 21l→25, no repetir el ciclo):
 * el editor, al dibujar un muro interior alrededor de un ambiente (o con
 * jamba/receso), guarda `wall.vertices` como un CONTORNO CERRADO (primer
 * punto == último punto), no la polilínea de 2 puntos que `Wall.vertices`
 * documenta. Interpretaciones probadas contra datos reales:
 *
 *   - (21l) contorno como polilínea de centro con `wall.thickness` por
 *     segmento — en Vinchos (bandas anómalas anchas) caía ~19% el promedio.
 *   - (22) reducirlo a sus 2 vértices más distantes — colapsaba muros con
 *     giros a una diagonal sin sentido físico (0 lx). Revertido.
 *   - (23/24) descomposición por barrido del ÁREA ENCERRADA en rectángulos
 *     ("el anillo es la huella rellena de un muro grueso") — matemáticamente
 *     exacta, pero la premisa era FALSA para los datos reales: en Módulo 22
 *     el anillo del muro `31efa5ea` encierra 2.18 m², exactamente el
 *     INTERIOR del ambiente SS.HH (perímetro ~0.97×2.32 m con muescas de
 *     jamba de ~0.13 m) — el anillo es el RECORRIDO PERIMETRAL del muro
 *     alrededor del ambiente, no su huella rellena. Rellenarlo ponía cajas
 *     DENTRO del ambiente, ocluyendo la luz de sus propias luminarias
 *     (Ē caía de 203 a 72 lx; con el parche de espesor declarado seguía
 *     comiendo 10-25% de luz interior, verificado con la matriz de
 *     diagnóstico occl×interreflexión del 2026-08-19).
 *   - (25, vigente) el anillo se trata como el CAMINO del muro: una caja
 *     por arista del contorno, espesor SIEMPRE el `wall.thickness` declarado
 *     centrado en la arista (el mismo comportamiento por-segmento del resto
 *     de este archivo — `segmentOcclusion.ts` centra el espesor en la línea
 *     del segmento). Para un anillo perimetral esto bloquea exactamente los
 *     cruces entre ambientes sin tocar la luz interior; para un contorno de
 *     banda delgada real, traza ambas caras (la oclusión es binaria — dos
 *     cajas paralelas no "bloquean doble", solo ensanchan la banda efectiva
 *     ±medio espesor, tolerable); las muescas de jamba generan cajas cortas
 *     inofensivas. Con esto la rama especial de anillos desapareció — todo
 *     contorno pasa por el mismo camino por-segmento.
 *
 * LÍMITE CONOCIDO: las aberturas (`openings`) sobre un contorno cerrado no
 * tienen un mapeo definido de `offsetAlongWall` (se definió para polilíneas
 * simples de 2 puntos) — un vano sobre un muro-anillo hoy queda opaco (más
 * conservador que dejarlo sin oclusión, pero no modela el vano).
 *
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
