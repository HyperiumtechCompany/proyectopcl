/**
 * vertexAlignmentSnap.ts — Ronda 30 (2026-08-21), a pedido explícito del
 * usuario: al MODIFICAR un ambiente/recinto/muro arrastrando un vértice, el
 * sistema no ayudaba a mantenerlo alineado con el resto de la forma — mover
 * una esquina de un rectángulo lo convierte en trapecio, y no había ninguna
 * asistencia para volver a alinear el vértice vecino. Mismo patrón "smart
 * guides" que Figma/Sketch/AutoCAD: mientras se arrastra un vértice, si su
 * posición queda cerca (en píxeles de pantalla) de la misma X o la misma Y
 * que OTRO vértice de la MISMA forma, se ajusta (snap) exacto a esa
 * coordenada y se reporta qué vértice originó la guía, para dibujar una
 * línea de referencia — funciona para cualquier forma/tamaño porque compara
 * contra TODOS los demás vértices del polígono, no contra una forma
 * hardcodeada (rectángulo, L, etc.).
 */

export interface ScreenPoint {
    x: number;
    y: number;
}

export interface AlignmentSnapResult {
    /** Punto ajustado (idéntico al de entrada si no hubo snap en ningún eje). */
    point: ScreenPoint;
    /** X de referencia (línea de guía VERTICAL) si se alineó por columna con algún vértice — `null` si no. */
    guideX: number | null;
    /** Y de referencia (línea de guía HORIZONTAL) si se alineó por fila con algún vértice — `null` si no. */
    guideY: number | null;
}

/**
 * Busca, entre `candidates` (los demás vértices de la MISMA forma, en
 * píxeles de pantalla), el más cercano en X y el más cercano en Y al punto
 * que se está arrastrando — si alguno cae dentro de `toleranceScreenPx`, se
 * ajusta esa coordenada exacta. X e Y se resuelven de forma independiente:
 * un vértice puede aportar la guía X y OTRO distinto la guía Y a la vez
 * (esquina alineada con dos lados distintos de la forma).
 */
export function resolveVertexAlignmentSnap(
    dragPoint: ScreenPoint,
    candidates: ScreenPoint[],
    toleranceScreenPx: number,
): AlignmentSnapResult {
    let bestXCandidate: ScreenPoint | null = null;
    let bestXDist = toleranceScreenPx;
    let bestYCandidate: ScreenPoint | null = null;
    let bestYDist = toleranceScreenPx;

    for (const candidate of candidates) {
        const dx = Math.abs(candidate.x - dragPoint.x);
        if (dx < bestXDist) {
            bestXDist = dx;
            bestXCandidate = candidate;
        }
        const dy = Math.abs(candidate.y - dragPoint.y);
        if (dy < bestYDist) {
            bestYDist = dy;
            bestYCandidate = candidate;
        }
    }

    return {
        point: {
            x: bestXCandidate ? bestXCandidate.x : dragPoint.x,
            y: bestYCandidate ? bestYCandidate.y : dragPoint.y,
        },
        guideX: bestXCandidate ? bestXCandidate.x : null,
        guideY: bestYCandidate ? bestYCandidate.y : null,
    };
}
