import { describe, expect, it } from 'vitest';
import { downstreamCircuitIds, splitCircuitAtAnchors, type CircuitDraft } from './circuitSplit';
import type { SiteCircuit, SiteElement } from './types';

const anchors: Record<string, { x: number; y: number }> = {
    P1: { x: 10, y: 0 },
    P2: { x: 20, y: 0 },
};
const anchorIdAt = (p: { x: number; y: number }) =>
    Object.entries(anchors).find(([, a]) => Math.hypot(a.x - p.x, a.y - p.y) < 1e-6)?.[0] ?? null;

const route: CircuitDraft = {
    sourceId: 'TG',
    targetId: 'P3',
    waypoints: [
        { x: 0, y: 0 },
        { x: 5, y: 2 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
    ],
    segmentModes: ['aerial', 'aerial', 'underground', 'aerial'],
    wireCount: 3,
    wireLabel: 'F+N+T',
    sectionMm2: 4,
    tgOutputId: 'out-2',
    phase: 'S',
    wastePct: 5,
};

describe('cableado por conexiones (objeto → objeto)', () => {
    it('corta el recorrido en cada objeto intermedio conservando salida, sección y tendido', () => {
        const pieces = splitCircuitAtAnchors(route, anchorIdAt)!;
        expect(pieces.map((p) => `${p.sourceId}→${p.targetId}`)).toEqual(['TG→P1', 'P1→P2', 'P2→P3']);
        expect(pieces[0].waypoints).toEqual([{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }]);
        expect(pieces[0].segmentModes).toEqual(['aerial', 'aerial']);
        expect(pieces[1].segmentModes).toEqual(['underground']);
        expect(pieces.every((p) => p.tgOutputId === 'out-2' && p.sectionMm2 === 4)).toBe(true);
        // La fase es de la salida (solo el primer tramo).
        expect(pieces.map((p) => p.phase)).toEqual(['S', undefined, undefined]);
    });

    it('sin objetos intermedios no cambia nada', () => {
        expect(splitCircuitAtAnchors({ ...route, waypoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 30, y: 0 }] }, anchorIdAt)).toBeNull();
    });

    it('"eliminar desde aquí": el tramo y lo que cuelga de él, sin tocar lo anterior ni cruzar tableros', () => {
        const c = (id: string, s: string, t: string) => ({ id, sourceId: s, targetId: t, waypoints: [], calculatedLengthM: 0, wireCount: 3 }) as SiteCircuit;
        const circuits = [c('a', 'TG', 'P1'), c('b', 'P1', 'P2'), c('c', 'P2', 'P3'), c('d', 'P2', 'P4'), c('e', 'P4', 'TD'), c('f', 'TD', 'P9')];
        const elements = [
            { id: 'TG', type: 'tg_location' },
            { id: 'TD', type: 'sub_panel' },
        ] as SiteElement[];
        expect(downstreamCircuitIds(circuits, elements, 'b').sort()).toEqual(['b', 'c', 'd', 'e']);
        expect(downstreamCircuitIds(circuits, elements, 'c')).toEqual(['c']);
    });
});

describe('cada conexión recalcula su largo', () => {
    it('no hereda el largo guardado del cable completo', () => {
        const pieces = splitCircuitAtAnchors({ ...route, calculatedLengthM: 999 }, anchorIdAt)!;
        expect(pieces.every((piece) => piece.calculatedLengthM === undefined)).toBe(true);
    });
});
