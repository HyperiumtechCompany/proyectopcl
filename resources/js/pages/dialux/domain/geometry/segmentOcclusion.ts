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

function toLocalFrame(box: OcclusionBox, p: Point3): Point3 {
    const dx = p.x - box.originX;
    const dy = p.y - box.originY;
    const cos = Math.cos(box.angleRad);
    const sin = Math.sin(box.angleRad);
    return {
        x: dx * cos + dy * sin,
        y: -dx * sin + dy * cos,
        z: p.z,
    };
}

function segmentIntersectsBox(p0: Point3, p1: Point3, box: OcclusionBox): boolean {
    const a = toLocalFrame(box, p0);
    const b = toLocalFrame(box, p1);
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
    for (const box of obstacles) {
        if (segmentIntersectsBox(p0, p1, box)) {
            return true;
        }
    }
    return false;
}
