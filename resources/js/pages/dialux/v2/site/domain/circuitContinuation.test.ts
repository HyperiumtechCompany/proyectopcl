import { describe, expect, it } from 'vitest';
import {
    appendCircuitContinuation,
    continuationCandidates,
} from './circuitContinuation';
import type { SiteCircuit } from './types';

const circuit = (id: string, targetId: string, color: string): SiteCircuit => ({
    id,
    sourceId: 'tg-1',
    targetId,
    waypoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
    ],
    calculatedLengthM: 10,
    wireCount: 2,
    wastePct: 5,
    tgOutputId: `output-${id}`,
    route: { kind: 'underground', depthM: 0.4 },
    segmentModes: ['underground'],
    style: { color },
});

describe('circuit continuation', () => {
    it('offers only circuits ending at the same box', () => {
        const circuits = [
            circuit('a', 'box-2', '#ef4444'),
            circuit('b', 'box-2', '#22c55e'),
            circuit('c', 'box-1', '#3b82f6'),
        ];

        expect(
            continuationCandidates(circuits, 'a').map((item) => item.id),
        ).toEqual(['a', 'b']);
    });

    it('appends the new route and preserves circuit properties', () => {
        const original = circuit('a', 'box-2', '#ef4444');
        const patch = appendCircuitContinuation(
            original,
            [
                { x: 10.5, y: 0 },
                { x: 15, y: 3 },
                { x: 20, y: 3 },
            ],
            ['underground', 'aerial'],
            'box-4',
        );

        expect(patch).toMatchObject({
            targetId: 'box-4',
            waypoints: [
                { x: 0, y: 0 },
                { x: 10.5, y: 0 },
                { x: 15, y: 3 },
                { x: 20, y: 3 },
            ],
            segmentModes: ['underground', 'underground', 'aerial'],
            route: { kind: 'aerial', depthM: 0.4 },
        });
        expect(original.targetId).toBe('box-2');
        expect(original.style?.color).toBe('#ef4444');
        expect(original.tgOutputId).toBe('output-a');
    });
});
