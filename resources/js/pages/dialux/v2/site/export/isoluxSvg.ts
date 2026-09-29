import type { LightingResult } from '@/pages/dialux/hooks/types';
import { areaIsolines, formatIsoluxLevel, labelPoint } from '../domain/isoluxContours';
import type { Point2D } from '../domain/types';

let clipSequence = 0;

/**
 * Recorte SVG al contorno de un espacio (metros): devuelve la definición y el
 * atributo para envolver lo del espacio (falsos colores y curvas), así nada
 * se dibuja fuera del espacio calculado.
 */
export function svgClipToPolygons(polygonsM: Point2D[][]): { def: string; attr: string } {
    const polygons = polygonsM.filter((polygon) => polygon.length >= 3);
    if (polygons.length === 0) return { def: '', attr: '' };
    const id = `space-clip-${++clipSequence}`;
    const shapes = polygons
        .map((polygon) => `<polygon points="${polygon.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')}"/>`)
        .join('');
    return { def: `<clipPath id="${id}">${shapes}</clipPath>`, attr: ` clip-path="url(#${id})"` };
}

/**
 * Curvas isolux como fragmentos SVG (coordenadas en METROS, las mismas del
 * plano del informe): polilínea oscura + valor en lx con halo blanco.
 */
export function isoluxSvgFragments(
    results: LightingResult[],
    strokeWidth: number,
    fontSize: number,
    /** Ē exigido del espacio: curva roja discontinua "lx norma". */
    requiredLux: number | null = null,
    /** Contorno(s) de lo calculado (m): curvas sobre su malla continua y recortadas a él. */
    polygonsM?: Point2D[][],
): string {
    const parts: string[] = [];
    const clip = polygonsM ? svgClipToPolygons(polygonsM) : { def: '', attr: '' };
    if (clip.def) parts.push(clip.def);
    // Niveles PROPIOS del espacio (todas sus mallas) + la curva de la norma.
    for (const line of areaIsolines(results, requiredLux, polygonsM).lines) {
        const color = line.required ? '#dc2626' : '#0f172a';
        parts.push(
            `<polyline${clip.attr} points="${line.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')}" fill="none" stroke="${color}" stroke-opacity="${line.required ? 0.95 : 0.8}" stroke-width="${(strokeWidth * (line.required ? 2 : 1)).toFixed(4)}"${line.required ? ` stroke-dasharray="${(strokeWidth * 5).toFixed(3)} ${(strokeWidth * 2.5).toFixed(3)}"` : ''}/>`,
        );
        if (line.points.length >= 6 || line.required) {
            const p = labelPoint(line);
            parts.push(
                `<text x="${p.x.toFixed(3)}" y="${p.y.toFixed(3)}" font-size="${fontSize.toFixed(3)}" font-weight="bold" text-anchor="middle" font-family="Arial, sans-serif" fill="${line.required ? '#b91c1c' : '#0f172a'}" stroke="#ffffff" stroke-width="${(fontSize * 0.25).toFixed(3)}" paint-order="stroke">${formatIsoluxLevel(line.level)}${line.required ? ' lx norma' : ''}</text>`,
            );
        }
    }
    return parts.join('');
}
