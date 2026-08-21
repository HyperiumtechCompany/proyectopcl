import type { OcclusionBox } from './occlusionBoxes';

/**
 * Test de visibilidad punto↔luminaria (Fase 6, plan maestro §11: "ray-cast
 * punto↔superficie emisora... tolerancia de auto-intersección"). Método de
 * slabs (Kay–Kajiya) contra el segmento `p0→p1` transformado al marco local
 * de cada caja — funciona para cualquier orientación de muro en XY sin
 * necesitar una biblioteca de colisión de terceros.
 */
interface Point3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Sesgo paramétrico (fracción de la longitud del segmento, no metros) que se
 * recorta en ambos extremos antes de probar intersección — evita que el
 * propio punto de cálculo o la propia luminaria (que pueden estar
 * exactamente sobre la cara de una caja, ej. un punto de malla justo al lado
 * de un muro) se autoocluyan por redondeo de punto flotante. Un sesgo
 * paramétrico es preferible a uno en metros: se adapta automáticamente a
 * segmentos largos o cortos sin necesitar recalibrar una distancia fija.
 */
const PARAMETRIC_BIAS = 1e-6;

interface PreparedBox {
    box: OcclusionBox;
    cos: number;
    sin: number;
    // AABB mundial de la caja — filtro barato antes del test de slabs completo.
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * `cos`/`sin` de `box.angleRad` y el AABB mundial de cada caja, cacheados
 * por identidad del array `obstacles` (Ronda "rendimiento del muestreo de
 * área", 2026-08-21): con el muestreo de área de `directIlluminance.ts`/
 * `radiosityTransfer.ts`/`glareCalculation.ts` (5 rayos en vez de 1 por
 * fuente), el mismo `obstacles` se prueba contra MUCHOS más segmentos dentro
 * de un solo cálculo — recalcular trigonometría y reconstruir el AABB de
 * cada caja en cada llamada (antes: una vez por caja por llamada; con 5x
 * rayos, 5 veces más) fue el costo dominante medido (proyecto real
 * "Vinchos": ~5s por cálculo). El cache no cambia ningún resultado (`cos`/
 * `sin` son funciones puras de `box.angleRad`, que no cambia entre llamadas
 * dentro de un mismo cálculo) — es una optimización pura, verificada contra
 * los mismos tests de `segmentOcclusion.test.ts` sin tocar ninguno.
 */
const preparedCache = new WeakMap<OcclusionBox[], PreparedBox[]>();

function prepareObstacles(obstacles: OcclusionBox[]): PreparedBox[] {
    const cached = preparedCache.get(obstacles);
    if (cached) {
        return cached;
    }
    const prepared = obstacles.map((box): PreparedBox => {
        const cos = Math.cos(box.angleRad);
        const sin = Math.sin(box.angleRad);
        const halfThickness = box.thickness / 2;
        const localCorners = [
            { x: 0, y: -halfThickness },
            { x: box.length, y: -halfThickness },
            { x: 0, y: halfThickness },
            { x: box.length, y: halfThickness },
        ];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const corner of localCorners) {
            const worldX = box.originX + corner.x * cos - corner.y * sin;
            const worldY = box.originY + corner.x * sin + corner.y * cos;
            minX = Math.min(minX, worldX);
            maxX = Math.max(maxX, worldX);
            minY = Math.min(minY, worldY);
            maxY = Math.max(maxY, worldY);
        }
        return { box, cos, sin, minX, maxX, minY, maxY };
    });
    preparedCache.set(obstacles, prepared);
    return prepared;
}

function toLocalFrame(prepared: PreparedBox, p: Point3): Point3 {
    const dx = p.x - prepared.box.originX;
    const dy = p.y - prepared.box.originY;
    return {
        x: dx * prepared.cos + dy * prepared.sin,
        y: -dx * prepared.sin + dy * prepared.cos,
        z: p.z,
    };
}

function segmentIntersectsBox(p0: Point3, p1: Point3, prepared: PreparedBox): boolean {
    const box = prepared.box;
    const a = toLocalFrame(prepared, p0);
    const b = toLocalFrame(prepared, p1);
    const dir = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };

    const mins = [0, -box.thickness / 2, box.zMin];
    const maxs = [box.length, box.thickness / 2, box.zMax];
    const origins = [a.x, a.y, a.z];
    const dirs = [dir.x, dir.y, dir.z];

    let tMin = PARAMETRIC_BIAS;
    let tMax = 1 - PARAMETRIC_BIAS;

    for (let axis = 0; axis < 3; axis++) {
        const d = dirs[axis]!;
        const o = origins[axis]!;
        if (Math.abs(d) < 1e-12) {
            if (o < mins[axis]! || o > maxs[axis]!) {
                return false;
            }
            continue;
        }
        let t1 = (mins[axis]! - o) / d;
        let t2 = (maxs[axis]! - o) / d;
        if (t1 > t2) {
            [t1, t2] = [t2, t1];
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) {
            return false;
        }
    }

    return true;
}

/** `true` si algún obstáculo bloquea la línea de vista directa entre `p0` y `p1`. */
export function isSegmentOccluded(p0: Point3, p1: Point3, obstacles: OcclusionBox[]): boolean {
    if (obstacles.length === 0) {
        return false;
    }

    const segMinX = Math.min(p0.x, p1.x);
    const segMaxX = Math.max(p0.x, p1.x);
    const segMinY = Math.min(p0.y, p1.y);
    const segMaxY = Math.max(p0.y, p1.y);
    const segMinZ = Math.min(p0.z, p1.z);
    const segMaxZ = Math.max(p0.z, p1.z);

    for (const prepared of prepareObstacles(obstacles)) {
        // Rechazo barato por AABB antes del test de slabs completo — nunca
        // descarta una intersección real (el AABB de la caja rotada SIEMPRE
        // contiene la caja), solo evita el trabajo trigonométrico para pares
        // rayo↔caja que claramente no se tocan (la mayoría, en una escena
        // real con varios obstáculos).
        if (
            segMaxX < prepared.minX ||
            segMinX > prepared.maxX ||
            segMaxY < prepared.minY ||
            segMinY > prepared.maxY ||
            segMaxZ < prepared.box.zMin ||
            segMinZ > prepared.box.zMax
        ) {
            continue;
        }
        if (segmentIntersectsBox(p0, p1, prepared)) {
            return true;
        }
    }
    return false;
}
