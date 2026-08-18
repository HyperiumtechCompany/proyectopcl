/**
 * Grilla de sensores horizontales (mirando hacia +Z) para `rtrace -I`, sobre
 * el plano útil de un ambiente rectangular — excluye la zona marginal
 * declarada en todo el contorno, igual criterio que
 * `export/document/ambientDossier.ts` usa para el plano útil real.
 *
 * Ronda 21 (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-21):
 * un rectángulo es solo un polígono de 4 vértices — esta función ahora es
 * un envoltorio delgado sobre `generatePolygonSensorGrid()` en vez de tener
 * su PROPIO esquema de grilla independiente. La versión anterior recibía
 * `columns`/`rows` EXPLÍCITOS elegidos a mano por cada fixture ("densidad
 * ~1 sensor cada 0.3-0.4 m", ver `shapeVariationFixtures.ts`), endpoint-
 * inclusive entre `marginalZone` y `width - marginalZone` — un esquema que
 * NUNCA coincidía con la grilla real que arma el motor de producción
 * (`hooks/lightingEngineCore.ts::buildGrid`, celdas `floor(width/spacing)`
 * centradas). Para "sshh-vs-bano" (2.209x0.950 m) esto significaba que el
 * oráculo medía sobre una grilla de 7x3=21 puntos cubriendo casi todo el
 * ambiente, mientras el motor real promedia solo 4 puntos en una única
 * fila central (`floor(0.95/0.5)=1` fila) — dos resultados sobre conjuntos
 * de sensores completamente distintos, comparados entre sí como si fueran
 * la misma medición. Unificar en un solo generador (el poligonal) elimina
 * la posibilidad de que ambos esquemas vuelvan a divergir en el futuro.
 */

import { distanceToPolygonEdge, pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Vertex } from '@/pages/dialux/hooks/types';

export interface SensorGridOptions {
    width: number;
    depth: number;
    /** Altura del plano de trabajo (Z) donde se miden los sensores. */
    workingPlaneHeight: number;
    /** Excluida en todo el contorno, igual que `Room.marginalZone`. */
    marginalZone: number;
    /** Pequeño desplazamiento vertical sobre el plano de trabajo para evitar que el sensor coincida exactamente con una superficie (piso). Default 0.01 m. */
    verticalOffset?: number;
    /** Espaciado objetivo entre sensores, en metros — igual convención que `PolygonSensorGridOptions.spacing` / `GRID_SPACING` de producción (0.5 m por defecto en el motor real). */
    spacing: number;
}

export interface SensorPoint {
    x: number;
    y: number;
    z: number;
    dx: number;
    dy: number;
    dz: number;
}

export function generateSensorGrid(options: SensorGridOptions): SensorPoint[] {
    const { width, depth, workingPlaneHeight, marginalZone, spacing, verticalOffset } = options;
    const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: depth },
        { x: 0, y: depth },
    ];
    return generatePolygonSensorGrid({ vertices, workingPlaneHeight, marginalZone, spacing, verticalOffset });
}

/** Formato de entrada de `rtrace`: una línea "x y z dx dy dz" por punto. */
export function formatSensorGridForRtrace(points: SensorPoint[]): string {
    return points.map((p) => `${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)} ${p.dx} ${p.dy} ${p.dz}`).join('\n') + '\n';
}

/**
 * Generalización de `generateSensorGrid()` a un piso de forma ARBITRARIA
 * (mismo motivo que `generatePolygonRoomScene()` en `generateRoomScene.ts`
 * — terrenos reales no siempre son rectangulares).
 *
 * Ronda 21 (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-21):
 * este generador reproduce el esquema de anclaje EXACTO de
 * `hooks/lightingEngineCore.ts::buildGrid` — celdas de tamaño
 * `bbox / floor(bbox / spacing)`, sensor en el CENTRO de cada celda
 * (`min + (i + 0.5) * cell`) — y no un anclaje distinto propio. La
 * exclusión de zona marginal reutiliza el mismo criterio que
 * `marginalZoneFilter.ts::filterPointsOutsideMarginalZone` (punto activo
 * dentro del polígono Y a distancia ≥ `marginalZone` de cualquier borde).
 *
 * La versión anterior anclaba la grilla en la ESQUINA del bounding box
 * (`columns = floor(bbox/spacing) + 1`, punto en `min + col*spacing`) — un
 * esquema DISTINTO al de producción, aunque el valor nominal de `spacing`
 * fuera el mismo (0.5 m = `GRID_SPACING`). Para una sola luminaria
 * concentrada, esto hacía que el oráculo y el motor promediaran sobre
 * conjuntos de puntos de muestreo distintos — en formas no rectangulares
 * (L, pentágono achaflanado, trapezoide) esto bastó para producir 13-26%
 * de divergencia de "montaje" sin ningún error real de geometría/física
 * (Ronda 14/19: alinear el NÚMERO de espaciado no lo arregló, porque el
 * espaciado nominal ya coincidía — el esquema de anclaje era la causa real,
 * nunca antes comparado). Ver `generatePolygonSensorGrid.test.ts` para la
 * prueba de paridad exacta contra `buildGrid()`.
 */
export interface PolygonSensorGridOptions {
    vertices: Vertex[];
    workingPlaneHeight: number;
    marginalZone: number;
    /** Espaciado objetivo entre sensores, en metros (celdas floor(bbox/spacing), igual que `buildGrid`). */
    spacing: number;
    verticalOffset?: number;
}

export function generatePolygonSensorGrid(options: PolygonSensorGridOptions): SensorPoint[] {
    const { vertices, workingPlaneHeight, marginalZone, spacing } = options;
    const verticalOffset = options.verticalOffset ?? 0.01;
    if (vertices.length < 3) {
        throw new Error('generatePolygonSensorGrid: se necesitan al menos 3 vértices para definir un piso.');
    }
    if (spacing <= 0) {
        throw new Error('generatePolygonSensorGrid: el espaciado debe ser positivo.');
    }

    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const length = maxY - minY;

    const cols = Math.max(1, Math.floor(width / spacing));
    const rows = Math.max(1, Math.floor(length / spacing));
    const cellW = width / cols;
    const cellH = length / rows;

    const points: SensorPoint[] = [];
    for (let row = 0; row < rows; row++) {
        const y = minY + (row + 0.5) * cellH;
        for (let col = 0; col < cols; col++) {
            const x = minX + (col + 0.5) * cellW;
            const point = { x, y };
            if (pointInPolygon(point, vertices) && distanceToPolygonEdge(point, vertices) >= marginalZone) {
                points.push({ x, y, z: workingPlaneHeight + verticalOffset, dx: 0, dy: 0, dz: 1 });
            }
        }
    }

    if (points.length === 0) {
        throw new Error(
            `generatePolygonSensorGrid: la zona marginal (${marginalZone} m) y el espaciado (${spacing} m) no dejaron ningún sensor dentro del polígono.`,
        );
    }

    return points;
}
