/**
 * Geometría pura de puertas, portones y cercos del constructor 3D del editor
 * de módulo (sin Babylon, para poder probarla).
 *
 * Convención de `House3DBuilder`: un muro/puerta sobre un tramo con
 * `angle = atan2(dy, dx)` (plano 2D) se coloca en (x, z) = (x2D, y2D) con
 * `mesh.rotation.y = -angle`; su eje local X queda a lo largo de la tangente
 * (cos a, sin a) del plano y su eje local Z a lo largo de la normal (−sin a, cos a).
 */

export interface PlanPointAngle {
    x: number;
    y: number;
    angle: number;
}

/** Posición (x, z de mundo) de un punto a `along` m sobre la tangente y `across` m sobre la normal del punto dado. */
export function pointOnDoorFrame(
    pt: PlanPointAngle,
    along: number,
    across: number,
): { x: number; z: number } {
    const c = Math.cos(pt.angle);
    const s = Math.sin(pt.angle);
    return {
        x: pt.x + c * along - s * across,
        z: pt.y + s * along + c * across,
    };
}

/**
 * Pomo de la hoja: `hSide` m hacia el extremo del vano y `hDepth` m fuera del
 * plano de la hoja. Antes se calculaba con `z − sin·hSide`, que lo dejaba en el
 * extremo opuesto en cualquier muro que no fuera horizontal.
 */
export function doorHandlePosition(
    pt: PlanPointAngle,
    hSide: number,
    hDepth: number,
): { x: number; z: number } {
    return pointOnDoorFrame(pt, hSide, hDepth);
}

/** Distancias (m) desde el inicio de un tramo donde van las columnas de un cerco: extremos + separación `spacing`, sin duplicados. */
export function cercoPostOffsets(segLen: number, spacing: number): number[] {
    if (!(segLen > 0)) return [];
    const step = Math.max(0.5, spacing);
    const count = Math.max(1, Math.round(segLen / step));
    const offsets: number[] = [];
    for (let i = 0; i <= count; i++) {
        offsets.push((segLen * i) / count);
    }
    return offsets;
}

/** Hojas de un portón: 1 (corredizo/simple) o 2 (doble), con su centro (m desde el centro del vano) y ancho. */
export function gateLeafLayout(
    width: number,
    doorType: string | undefined,
): Array<{ center: number; width: number }> {
    const usable = Math.max(0.2, width - 0.06);
    if (doorType === 'gate' || doorType === 'double') {
        const leaf = usable / 2 - 0.01;
        return [
            { center: -usable / 4, width: leaf },
            { center: usable / 4, width: leaf },
        ];
    }
    return [{ center: 0, width: usable }];
}
