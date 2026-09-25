import { describe, expect, it } from 'vitest';
import type { SiteData, SiteElement } from './types';
import { followMovedElements } from './wireFollow';

const box = (id: string, cx: number, cy: number): SiteElement => ({
    id,
    type: 'pull_box',
    label: 'Caja de pase',
    vertices: [
        { x: cx - 0.05, y: cy - 0.05 },
        { x: cx + 0.05, y: cy - 0.05 },
        { x: cx + 0.05, y: cy + 0.05 },
        { x: cx - 0.05, y: cy + 0.05 },
    ],
    style: { fillColor: '#22c55e', strokeColor: '#15803d' },
});

function site(elements: SiteElement[]): SiteData {
    return {
        schemaVersion: 1,
        terrainScaleM: 1,
        gridSizeM: 1,
        canvasWidth: 100,
        canvasHeight: 100,
        elements,
        feederPaths: [
            {
                id: 'f1',
                networkEdgeId: 'e1',
                waypoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
                calculatedLengthM: 14,
            },
        ],
        circuits: [
            {
                id: 'c1',
                sourceId: 'tg',
                targetId: 'pole',
                // Pasa por la caja (10,10) y sigue hasta el poste.
                waypoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                    { x: 5, y: 3 },
                    { x: 20, y: 10 },
                ],
                calculatedLengthM: 30,
                wireCount: 2,
            },
        ],
        layers: [],
    };
}

describe('followMovedElements', () => {
    it('el cable que pasa por la caja la sigue al moverla; los demás puntos no', () => {
        const before = site([box('b1', 10, 10)]);
        const moved = { ...before, elements: [box('b1', 13, 6)] };

        const result = followMovedElements(before.elements, moved, ['b1']);

        expect(result.circuits[0].waypoints).toEqual([
            { x: 0, y: 0 },
            { x: 13, y: 6 },
            { x: 5, y: 3 },
            { x: 20, y: 10 },
        ]);
        expect(result.feederPaths[0].waypoints[1]).toEqual({ x: 13, y: 6 });
    });

    it('sin movimiento devuelve el mismo documento', () => {
        const before = site([box('b1', 10, 10)]);
        expect(followMovedElements(before.elements, before, ['b1'])).toBe(before);
    });
});
