import { describe, expect, it } from 'vitest';
import { openFenceEnds } from './fenceGaps';
import type { SiteElement } from './types';

const fence = (id: string, vertices: SiteElement['vertices'], closed = false): SiteElement => ({
    id,
    type: 'fence',
    label: id,
    vertices,
    config: { kind: 'fence', slope: 'flat', endElevationM: 0, closed },
    style: { fillColor: '#000', strokeColor: '#000' },
});

describe('site/domain/fenceGaps', () => {
    it('un cerco cerrado no tiene extremos', () => {
        const closed = fence('c', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true);
        expect(openFenceEnds(closed, [closed], 1)).toEqual([]);
    });

    it('dos cercos que se tocan cierran sus extremos', () => {
        const a = fence('a', [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
        const b = fence('b', [{ x: 10, y: 0 }, { x: 10, y: 10 }]);
        const issues = openFenceEnds(a, [a, b], 1);
        // el extremo final de `a` toca a `b`; el inicial queda libre
        expect(issues.map((i) => i.end)).toEqual([0]);
    });

    it('detecta una rendija entre dos cercos que casi se tocan', () => {
        const a = fence('a', [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
        const b = fence('b', [{ x: 11.5, y: 0 }, { x: 11.5, y: 10 }]);
        const issues = openFenceEnds(a, [a, b], 1);
        const gap = issues.find((i) => i.end === 1)!;
        expect(gap.kind).toBe('gap');
        expect(gap.gapM).toBeCloseTo(1.5, 1);
    });

    it('un extremo lejos de todo es un extremo libre', () => {
        const a = fence('a', [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
        expect(openFenceEnds(a, [a], 1).every((i) => i.kind === 'free')).toBe(true);
    });

    it('un portón trazado cierra el extremo donde termina el cerco', () => {
        const a = fence('a', [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
        const gate: SiteElement = {
            id: 'g',
            type: 'gate',
            label: 'Portón',
            vertices: [{ x: 10, y: 0 }, { x: 14, y: 0 }],
            style: { fillColor: '#000', strokeColor: '#000' },
        };
        expect(openFenceEnds(a, [a, gate], 1).map((i) => i.end)).toEqual([0]);
    });
});
