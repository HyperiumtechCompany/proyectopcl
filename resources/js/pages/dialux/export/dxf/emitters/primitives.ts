/**
 * Primitivas de emisión DXF AC1009 (AutoCAD R12), reutilizables por
 * `buildDialuxDxfExport.ts` y por los emitters de láminas del plan maestro
 * (marco, cajetín, leyendas, símbolos). Extraídas en la Fase 4 sin cambiar su
 * comportamiento — el test de caracterización de la Fase 0
 * (`buildDialuxDxfExport.baseline.test.ts`) congela la salida exacta y
 * detecta cualquier regresión de esta extracción.
 */

import type { DxfBounds } from '../domain/types';

export type Pt = { x: number; y: number };
export type DxfLines = string[];

/** Las 4 esquinas de un `DxfBounds`, sentido antihorario desde la esquina inferior izquierda. */
export function rectCorners(bounds: DxfBounds): Pt[] {
    return [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
    ];
}

/** Rota un punto LOCAL (relativo al origen del símbolo) `rotationDeg` grados sentido horario. */
export function rotatePoint(local: Pt, rotationDeg: number): Pt {
    if (rotationDeg === 0) return local;
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: local.x * cos - local.y * sin, y: local.x * sin + local.y * cos };
}

/** Punto LOCAL de un símbolo (centrado en el origen) → coordenada real del plano, rotado y trasladado. */
export function localToGlobal(origin: Pt, local: Pt, rotationDeg: number): Pt {
    const rotated = rotatePoint(local, rotationDeg);
    return { x: origin.x + rotated.x, y: origin.y + rotated.y };
}

/** Format a float for DXF output — no scientific notation, 6 decimal places. */
export function f(v: number): string {
    return v.toFixed(6);
}

/** Transliterate common Spanish/Latin characters to plain ASCII for AC1009. */
export function ascii(s: string): string {
    return s
        .replace(/[áàäâã]/gi, (m) => (m === m.toUpperCase() ? 'A' : 'a'))
        .replace(/[éèëê]/gi, (m) => (m === m.toUpperCase() ? 'E' : 'e'))
        .replace(/[íìïî]/gi, (m) => (m === m.toUpperCase() ? 'I' : 'i'))
        .replace(/[óòöôõ]/gi, (m) => (m === m.toUpperCase() ? 'O' : 'o'))
        .replace(/[úùüû]/gi, (m) => (m === m.toUpperCase() ? 'U' : 'u'))
        .replace(/[ñ]/g, 'n')
        .replace(/[Ñ]/g, 'N')
        .replace(/[^\x20-\x7E]/g, '?')
        .slice(0, 255);
}

/** Push one group-code / value pair. */
export function p(out: DxfLines, code: number, value: string | number): void {
    out.push(`${code}\n${value}`);
}

/** `color` es un índice ACI opcional que sobreescribe el color por capa (BYLAYER) de esta entidad. */
export function dxfLine(
    out: DxfLines, layer: string,
    x1: number, y1: number, x2: number, y2: number,
    color?: number,
): void {
    p(out, 0, 'LINE');
    p(out, 8, layer);
    if (color !== undefined) p(out, 62, color);
    p(out, 10, f(x1)); p(out, 20, f(y1)); p(out, 30, '0.0');
    p(out, 11, f(x2)); p(out, 21, f(y2)); p(out, 31, '0.0');
}

/** Emit a closed or open polygon as individual LINE segments. */
export function dxfPolyLines(out: DxfLines, layer: string, pts: Pt[], closed: boolean): void {
    if (pts.length < 2) return;
    for (let i = 0; i < pts.length - 1; i++) {
        dxfLine(out, layer, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    if (closed && pts.length >= 3) {
        const last = pts[pts.length - 1];
        dxfLine(out, layer, last.x, last.y, pts[0].x, pts[0].y);
    }
}

export function dxfCircle(out: DxfLines, layer: string, cx: number, cy: number, r: number, color?: number): void {
    p(out, 0, 'CIRCLE');
    p(out, 8, layer);
    if (color !== undefined) p(out, 62, color);
    p(out, 10, f(cx)); p(out, 20, f(cy)); p(out, 30, '0.0');
    p(out, 40, f(r));
}

/**
 * Filled dot (DXF SOLID entity — a plain CIRCLE can't be filled in AC1009)
 * with an explicit ACI `color`, overriding the layer's default color.
 * Drawn as a small diamond; at marker scale it reads as a solid dot.
 */
export function dxfFilledDot(
    out: DxfLines, layer: string,
    cx: number, cy: number, r: number, color: number,
): void {
    p(out, 0, 'SOLID');
    p(out, 8, layer);
    p(out, 62, color);
    p(out, 10, f(cx));     p(out, 20, f(cy - r)); p(out, 30, '0.0');
    p(out, 11, f(cx + r)); p(out, 21, f(cy));     p(out, 31, '0.0');
    p(out, 12, f(cx - r)); p(out, 22, f(cy));     p(out, 32, '0.0');
    p(out, 13, f(cx));     p(out, 23, f(cy + r)); p(out, 33, '0.0');
}

export function dxfArc(
    out: DxfLines, layer: string,
    cx: number, cy: number, r: number,
    startDeg: number, endDeg: number,
    color?: number,
): void {
    p(out, 0, 'ARC');
    p(out, 8, layer);
    if (color !== undefined) p(out, 62, color);
    p(out, 10, f(cx)); p(out, 20, f(cy)); p(out, 30, '0.0');
    p(out, 40, f(r));
    p(out, 50, f(startDeg));
    p(out, 51, f(endDeg));
}

/** Simple left-aligned TEXT (no alignment codes — maximum R12 compatibility). */
export function dxfText(
    out: DxfLines, layer: string,
    x: number, y: number,
    height: number, content: string,
    color?: number,
): void {
    const safe = ascii(content);
    if (!safe) return;
    p(out, 0, 'TEXT');
    p(out, 8, layer);
    if (color !== undefined) p(out, 62, color);
    p(out, 10, f(x)); p(out, 20, f(y)); p(out, 30, '0.0');
    p(out, 40, f(height));
    p(out, 1, safe);
}

// ── Símbolos: dibujo en coordenadas LOCALES (centradas en el origen del
// símbolo), rotadas y trasladadas automáticamente (Fase 5). Usadas por
// `dxf/symbols/*` para que el mismo renderer sirva tanto para la entidad en
// planta como para la celda de símbolo de la leyenda. ─────────────────────────

export function drawLocalLine(out: DxfLines, layer: string, origin: Pt, rotationDeg: number, a: Pt, b: Pt, color?: number): void {
    const ga = localToGlobal(origin, a, rotationDeg);
    const gb = localToGlobal(origin, b, rotationDeg);
    dxfLine(out, layer, ga.x, ga.y, gb.x, gb.y, color);
}

export function drawLocalCircle(out: DxfLines, layer: string, origin: Pt, rotationDeg: number, center: Pt, r: number, color?: number): void {
    const gc = localToGlobal(origin, center, rotationDeg);
    dxfCircle(out, layer, gc.x, gc.y, r, color);
}

export function drawLocalText(
    out: DxfLines, layer: string, origin: Pt, rotationDeg: number,
    at: Pt, height: number, content: string, color?: number,
): void {
    const gp = localToGlobal(origin, at, rotationDeg);
    dxfText(out, layer, gp.x, gp.y, height, content, color);
}

/** Rectángulo LOCAL (centrado en el origen) como 4 `LINE` — mismo trazo que `dxfPolyLines` cerrado, pero rotable. */
export function drawLocalRectOutline(
    out: DxfLines, layer: string, origin: Pt, rotationDeg: number,
    halfWidth: number, halfHeight: number, color?: number,
): void {
    const corners: Pt[] = [
        { x: -halfWidth, y: -halfHeight }, { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight }, { x: -halfWidth, y: halfHeight },
    ];
    for (let i = 0; i < corners.length; i++) {
        drawLocalLine(out, layer, origin, rotationDeg, corners[i], corners[(i + 1) % corners.length], color);
    }
}
