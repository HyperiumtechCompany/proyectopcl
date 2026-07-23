import { describe, expect, it } from 'vitest';
import type { DxfBounds } from '../domain/types';
import { layoutDxfSheets, type DxfSheetLayoutRowInput } from './sheetLayout';

/**
 * Fase 8 del plan maestro DXF: composición multinivel. Criterio de cierre —
 * todos los marcos son disjuntos, cada par corresponde al mismo nivel y la
 * unión de sus límites cubre el paquete completo.
 */

function frame(width: number, height: number): DxfBounds {
    return { minX: 0, minY: 0, maxX: width, maxY: height };
}

function bothSheets(sceneId: string, width: number, height: number): DxfSheetLayoutRowInput {
    return {
        sceneId,
        sheets: [
            { discipline: 'lighting', frame: frame(width, height) },
            { discipline: 'outlets', frame: frame(width, height) },
        ],
    };
}

function boundsIntersect(a: DxfBounds, b: DxfBounds): boolean {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function assertNoOverlaps(bounds: DxfBounds[]): void {
    for (let i = 0; i < bounds.length; i++) {
        for (let j = i + 1; j < bounds.length; j++) {
            expect(boundsIntersect(bounds[i]!, bounds[j]!)).toBe(false);
        }
    }
}

describe('layoutDxfSheets — uno, dos, tres y diez niveles', () => {
    it.each([1, 2, 3, 10])('%i nivel(es): produce 2 láminas por nivel, todas disjuntas', (levelCount) => {
        const rows = Array.from({ length: levelCount }, (_, i) => bothSheets(`level-${i}`, 40, 30));
        const result = layoutDxfSheets(rows, 5);

        expect(result.placements).toHaveLength(levelCount * 2);
        assertNoOverlaps(result.placements.map((p) => p.frameBoundsGlobal));

        // Cada par de láminas corresponde al mismo nivel.
        for (let i = 0; i < levelCount; i++) {
            const pair = result.placements.filter((p) => p.sceneId === `level-${i}`);
            expect(pair).toHaveLength(2);
            expect(pair.map((p) => p.discipline).sort()).toEqual(['lighting', 'outlets']);
        }
    });
});

describe('layoutDxfSheets — escalas distintas por nivel', () => {
    it('cada fila usa el tamaño de sus propias láminas, sin solaparse con filas de otro tamaño', () => {
        const rows = [
            bothSheets('small', 20, 15),
            bothSheets('big', 60, 45),
        ];
        const result = layoutDxfSheets(rows, 5);

        assertNoOverlaps(result.placements.map((p) => p.frameBoundsGlobal));
        const smallFrame = result.placements.find((p) => p.sceneId === 'small' && p.discipline === 'lighting')!.frameBoundsGlobal;
        const bigFrame = result.placements.find((p) => p.sceneId === 'big' && p.discipline === 'lighting')!.frameBoundsGlobal;
        expect(bigFrame.maxX - bigFrame.minX).toBeGreaterThan(smallFrame.maxX - smallFrame.minX);
    });
});

describe('layoutDxfSheets — nivel vacío entre niveles con contenido', () => {
    it('un nivel sin ninguna lámina no deja un hueco: la fila siguiente sube y ocupa su lugar', () => {
        const withGap: DxfSheetLayoutRowInput[] = [
            bothSheets('level-0', 40, 30),
            { sceneId: 'level-1-empty', sheets: [] },
            bothSheets('level-2', 40, 30),
        ];
        const withoutGap: DxfSheetLayoutRowInput[] = [
            bothSheets('level-0', 40, 30),
            bothSheets('level-2', 40, 30),
        ];

        const resultWithGap = layoutDxfSheets(withGap, 5);
        const resultWithoutGap = layoutDxfSheets(withoutGap, 5);

        expect(resultWithGap.placements).toHaveLength(4);
        assertNoOverlaps(resultWithGap.placements.map((p) => p.frameBoundsGlobal));

        // La posición de level-2 es la misma con o sin el nivel vacío intermedio.
        const level2WithGap = resultWithGap.placements.find((p) => p.sceneId === 'level-2' && p.discipline === 'lighting')!;
        const level2WithoutGap = resultWithoutGap.placements.find((p) => p.sceneId === 'level-2' && p.discipline === 'lighting')!;
        expect(level2WithGap.placementOffset).toEqual(level2WithoutGap.placementOffset);
    });

    it('un nivel con solo una especialidad (la otra vacía) aporta una sola lámina, no dos', () => {
        const rows: DxfSheetLayoutRowInput[] = [
            { sceneId: 'lighting-only', sheets: [{ discipline: 'lighting', frame: frame(40, 30) }] },
        ];
        const result = layoutDxfSheets(rows, 5);
        expect(result.placements).toHaveLength(1);
        expect(result.placements[0]!.discipline).toBe('lighting');
    });
});

describe('layoutDxfSheets — coordenadas negativas en el frame de entrada', () => {
    it('no falla y sigue sin solapes cuando el frame llega con minX/minY negativos', () => {
        const negativeFrame: DxfBounds = { minX: -5, minY: -3, maxX: 35, maxY: 27 };
        const rows: DxfSheetLayoutRowInput[] = [
            { sceneId: 'a', sheets: [{ discipline: 'lighting', frame: negativeFrame }, { discipline: 'outlets', frame: negativeFrame }] },
            bothSheets('b', 40, 30),
        ];
        const result = layoutDxfSheets(rows, 5);
        assertNoOverlaps(result.placements.map((p) => p.frameBoundsGlobal));
        expect(result.globalBounds).not.toBeNull();
    });
});

describe('layoutDxfSheets — extensión global', () => {
    it('globalBounds es la unión exacta de todos los frameBoundsGlobal', () => {
        const rows = [bothSheets('a', 40, 30), bothSheets('b', 20, 50)];
        const result = layoutDxfSheets(rows, 5);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const placement of result.placements) {
            minX = Math.min(minX, placement.frameBoundsGlobal.minX);
            minY = Math.min(minY, placement.frameBoundsGlobal.minY);
            maxX = Math.max(maxX, placement.frameBoundsGlobal.maxX);
            maxY = Math.max(maxY, placement.frameBoundsGlobal.maxY);
        }
        expect(result.globalBounds).toEqual({ minX, minY, maxX, maxY });
    });

    it('sin láminas, globalBounds es null', () => {
        expect(layoutDxfSheets([], 5).globalBounds).toBeNull();
    });
});
