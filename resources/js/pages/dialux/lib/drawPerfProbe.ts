import { ddbg, isDialuxDebugEnabled } from './dialuxDebug';

/**
 * drawPerfProbe.ts — sonda temporal para localizar el coste del `mousemove`
 * mientras se dibuja sobre un plano pesado.
 *
 * Sin efecto salvo que el diagnóstico esté activo (`?dialuxdebug=1` o
 * `localStorage['dialux:debug']`). Parte el evento en tres tramos:
 *   rect  — `getBoundingClientRect` (reflow sincrónico forzado)
 *   snap  — resolveSnap + ángulos guía + applyAngleSnap
 *   resto — lo que queda del handler: el `setXxxPreview` y, con él, el
 *           re-render sincrónico de React que dispara.
 */

interface Stage {
    rectMs: number;
    snapMs: number;
}

const stage: Stage = { rectMs: 0, snapMs: 0 };

export const drawPerfEnabled = (): boolean => isDialuxDebugEnabled();

export function markRect(ms: number): void {
    stage.rectMs = ms;
}

export function markSnap(ms: number): void {
    stage.snapMs = ms;
}

/** Reporta el evento completo si superó `thresholdMs`. */
export function reportMove(totalMs: number, thresholdMs = 30): void {
    if (totalMs <= thresholdMs) return;
    const rest = totalMs - stage.rectMs - stage.snapMs;
    ddbg(
        'move',
        `total=${totalMs.toFixed(0)}ms | rect=${stage.rectMs.toFixed(1)} snap=${stage.snapMs.toFixed(1)} resto(render)=${rest.toFixed(0)}`,
    );
    stage.rectMs = 0;
    stage.snapMs = 0;
}
