/**
 * Diagrama cartesiano (ángulo γ en X, candela en Y) — Ronda 21 del plan
 * `plan_ldt_ies_lector_editor.md`, tab "Cartesian diagram" del LDT Editor de
 * DIALux. Complementa `buildPolarSvgFromMatrix.ts` (mismo dato, otra
 * proyección) — útil para leer picos/valles exactos que el diagrama polar
 * comprime visualmente cerca del centro.
 */

interface CartesianMatrixInput {
    gamma_angles?: number[] | null;
    candela?: number[][] | null;
    reference_lumens?: number | null;
}

function escapeXml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const WIDTH = 420;
const HEIGHT = 260;
const MARGIN_LEFT = 46;
const MARGIN_RIGHT = 16;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 30;
const PLOT_W = WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PLOT_H = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

/** Hasta 4 planos C superpuestos (C0/C90/C180/C270), igual criterio de color que el resto del export. */
const PLANE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea'];

export function buildCartesianSvgFromMatrix(web: CartesianMatrixInput | null | undefined, title: string): string | null {
    const angles = web?.gamma_angles;
    const rawPlanes = web?.candela;
    if (!Array.isArray(angles) || !Array.isArray(rawPlanes) || rawPlanes.length === 0 || angles.length === 0) {
        return null;
    }

    // Ronda 21m: cd/1000 lm, mismo convenio que `buildPolarSvgFromMatrix.ts`
    // — ver su doc-comment para el porqué (antes mostraba cd absoluta al
    // flujo del producto, distinto de lo que muestra DIALux evo/el LDT
    // Editor, aunque la matriz almacenada fuera idéntica).
    const klmScale = web?.reference_lumens && web.reference_lumens > 0 ? 1000 / web.reference_lumens : 1;
    const planes = rawPlanes.map((plane) => plane.map((v) => v * klmScale));

    const maxAngle = Math.max(...angles, 1);
    const maxCandela = Math.max(0, ...planes.flat());
    if (maxCandela <= 0) {
        return null;
    }

    const toX = (angleDeg: number) => MARGIN_LEFT + (angleDeg / maxAngle) * PLOT_W;
    const toY = (candelaValue: number) => MARGIN_TOP + PLOT_H - (candelaValue / maxCandela) * PLOT_H;

    const planePaths = planes.slice(0, 4).map((plane, planeIndex) => {
        const points = plane.map((value, index) => `${toX(angles[index] ?? 0).toFixed(1)},${toY(value).toFixed(1)}`);
        return `<path d="M ${points.join(' L ')}" stroke="${PLANE_COLORS[planeIndex]}" stroke-width="1.8" fill="none"/>`;
    });

    // Grilla + ejes con las mismas marcas que el resto de diagramas del
    // export (solo <path>/<rect>/<text>, dompdf no rasteriza <line>/<circle>
    // de forma confiable — ver `buildPolarSvgFromMatrix.ts`).
    const gridLines: string[] = [];
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const y = MARGIN_TOP + (PLOT_H * i) / yTicks;
        const value = Math.round(maxCandela * (1 - i / yTicks));
        gridLines.push(`<path d="M ${MARGIN_LEFT} ${y} L ${WIDTH - MARGIN_RIGHT} ${y}" stroke="#e2e8f0" stroke-width="0.6"/>`);
        gridLines.push(`<text x="${MARGIN_LEFT - 6}" y="${y + 3}" font-family="Arial, sans-serif" font-size="7" fill="#64748b" text-anchor="end">${value}</text>`);
    }
    const xTicks = [0, 0.25, 0.5, 0.75, 1];
    for (const fraction of xTicks) {
        const x = MARGIN_LEFT + PLOT_W * fraction;
        const value = Math.round(maxAngle * fraction);
        gridLines.push(`<text x="${x}" y="${HEIGHT - MARGIN_BOTTOM + 12}" font-family="Arial, sans-serif" font-size="7" fill="#64748b" text-anchor="middle">${value}°</text>`);
    }

    const safeTitle = escapeXml(title);
    const fluxSuffix =
        typeof web?.reference_lumens === 'number' && web.reference_lumens > 0
            ? ` · Φ ${Math.round(web.reference_lumens).toLocaleString('en-US')} lm`
            : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * 1.4}" height="${HEIGHT * 1.4}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
    <text x="10" y="16" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">Diagrama cartesiano</text>
    <text x="10" y="${HEIGHT - 6}" font-family="Arial, sans-serif" font-size="7" fill="#64748b">${safeTitle} — γ (°) vs. cd/klm${fluxSuffix}</text>
    ${gridLines.join('\n    ')}
    <path d="M ${MARGIN_LEFT} ${MARGIN_TOP} L ${MARGIN_LEFT} ${HEIGHT - MARGIN_BOTTOM} L ${WIDTH - MARGIN_RIGHT} ${HEIGHT - MARGIN_BOTTOM}" stroke="#94a3b8" stroke-width="1"/>
    ${planePaths.join('\n    ')}
</svg>`;
}
