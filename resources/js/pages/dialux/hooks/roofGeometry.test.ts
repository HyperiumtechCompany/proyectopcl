import { describe, expect, it } from 'vitest';
import type { StructuralObstacle } from './types';
import { structuralSurfaceUndersideAt } from './roofGeometry';

const roof = (roofType: StructuralObstacle['roofType'], orientationDeg = 0): StructuralObstacle => ({
    id: 'roof', name: 'Cubierta', obstacleType: 'roof',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }],
    height: 1, elevation: 3, eaveHeight: 3, ridgeHeight: 5,
    slopePercent: 40, thickness: 0.2, roofType, orientationDeg,
});

describe('structuralSurfaceUndersideAt', () => {
    it('sigue ambas caidas de un techo a dos aguas', () => {
        const surface = roof('gable');
        const ridge = structuralSurfaceUndersideAt(surface, { x: 5, y: 3 })!;
        expect(ridge).toBeGreaterThan(structuralSurfaceUndersideAt(surface, { x: 1, y: 3 })!);
        expect(structuralSurfaceUndersideAt(surface, { x: 1, y: 3 }))
            .toBeCloseTo(structuralSurfaceUndersideAt(surface, { x: 9, y: 3 })!);
    });

    it('invierte las caidas para un techo mariposa', () => {
        const surface = roof('butterfly');
        expect(structuralSurfaceUndersideAt(surface, { x: 1, y: 3 })!)
            .toBeGreaterThan(structuralSurfaceUndersideAt(surface, { x: 5, y: 3 })!);
    });

    it('respeta la orientacion del techo', () => {
        const surface = roof('shed', 90);
        expect(structuralSurfaceUndersideAt(surface, { x: 5, y: 1 })!)
            .not.toBeCloseTo(structuralSurfaceUndersideAt(surface, { x: 5, y: 5 })!);
    });

    it('mantiene plana una cubierta plana aunque exista una pendiente legacy', () => {
        const surface = roof('flat');
        expect(structuralSurfaceUndersideAt(surface, { x: 1, y: 3 }))
            .toBeCloseTo(structuralSurfaceUndersideAt(surface, { x: 9, y: 3 })!);
    });
});
