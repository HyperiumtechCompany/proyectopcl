import type { LightingResult } from '@/pages/dialux/hooks/types';
import { areaIsolines, formatIsoluxLevel, labelPoint } from '../domain/isoluxContours';

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
): string {
    const parts: string[] = [];
    // Niveles PROPIOS del espacio (todas sus mallas) + la curva de la norma.
    for (const line of areaIsolines(results, requiredLux).lines) {
        const color = line.required ? '#dc2626' : '#0f172a';
        parts.push(
            `<polyline points="${line.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')}" fill="none" stroke="${color}" stroke-opacity="${line.required ? 0.95 : 0.8}" stroke-width="${(strokeWidth * (line.required ? 2 : 1)).toFixed(4)}"${line.required ? ` stroke-dasharray="${(strokeWidth * 5).toFixed(3)} ${(strokeWidth * 2.5).toFixed(3)}"` : ''}/>`,
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
