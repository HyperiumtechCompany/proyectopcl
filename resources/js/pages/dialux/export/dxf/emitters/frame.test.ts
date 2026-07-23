import { describe, expect, it } from 'vitest';
import { DEFAULT_RESERVED_ZONES_MM, resolvePaperSizeMm } from '../domain/constants';
import type { DxfBounds } from '../domain/types';
import { computeSheetGeometryAtScale } from '../geometry/sheetScale';
import { f } from './primitives';
import { renderSheetFrame } from './frame';

/**
 * Fase 4 del plan maestro DXF: marco y cajetín. Criterio de cierre parcial —
 * toda lámina tiene límites cerrados (marco exterior + interior).
 */

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe('renderSheetFrame', () => {
    it('dibuja marco exterior e interior cerrados en la capa MARCO, con las dimensiones de la geometría', () => {
        const modelBounds: DxfBounds = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
        const paper = resolvePaperSizeMm('A1', 'landscape');
        const geometry = computeSheetGeometryAtScale(modelBounds, paper, DEFAULT_RESERVED_ZONES_MM, 50);

        const out: string[] = [];
        renderSheetFrame(out, geometry);
        const dxf = out.join('\n');

        // 4 lados del marco exterior + 4 del interior = 8 LINE, todas en capa MARCO.
        expect(countOccurrences(dxf, '0\nLINE')).toBe(8);
        expect(countOccurrences(dxf, '8\nMARCO')).toBe(8);

        // Las esquinas del marco exterior aparecen literalmente en las coordenadas emitidas.
        expect(dxf).toContain(f(geometry.frameOuter.maxX));
        expect(dxf).toContain(f(geometry.frameOuter.maxY));
        expect(dxf).toContain(f(geometry.frameInner.minX));
        expect(dxf).toContain(f(geometry.frameInner.minY));
    });
});
