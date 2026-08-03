import { describe, expect, it } from 'vitest';
import {
    getCorridorRenderFlags,
    getFittedStairTreadDepth,
    getFloorToFloorStackHeight,
    getPostLandingCursorOffset,
    getStairLaneLayout,
} from './stairGeometry';

describe('stair geometry', () => {
    it('separates parallel stair flights with a configurable gap', () => {
        const lanes = getStairLaneLayout(3.2, 2, 1.2, 0.4);

        expect(lanes).toHaveLength(2);
        expect(lanes[0].width).toBeCloseTo(1.2);
        expect(lanes[1].width).toBeCloseTo(1.2);
        expect(lanes[1].center - lanes[0].center).toBeCloseTo(1.8);
    });

    it('keeps flights adjacent when the gap is zero', () => {
        const lanes = getStairLaneLayout(2.4, 2, 1.2, 0);

        expect(lanes[0].center).toBeCloseTo(0.6);
        expect(lanes[1].center).toBeCloseTo(1.8);
        expect(lanes[1].center - lanes[0].center).toBeCloseTo(1.2);
    });

    it('can fill the full stair box width while preserving the configured gap', () => {
        const lanes = getStairLaneLayout(3.5, 2, 1.2, 0.5, true);

        expect(lanes[0].width).toBeCloseTo(1.5);
        expect(lanes[1].width).toBeCloseTo(1.5);
        expect(lanes[1].center - lanes[0].center).toBeCloseTo(2);
    });

    it('fits ten steps plus landing to the available stair run', () => {
        expect(getFittedStairTreadDepth(4.2, 10, 0.28, 1.2)).toBeCloseTo(0.3);
    });

    it('keeps the second U-stair flight starting from the landing edge', () => {
        expect(getPostLandingCursorOffset(1.2, -1, true)).toBe(0);
        expect(getPostLandingCursorOffset(1.2, -1, false)).toBeCloseTo(-1.2);
    });

    it('keeps floors touching by stacking the next floor on top of the shared slab', () => {
        expect(getFloorToFloorStackHeight(2.7, 0.2)).toBeCloseTo(2.9);
        expect(getFloorToFloorStackHeight(2.7, -1)).toBeCloseTo(2.7);
    });

    it('resolves corridor variants without changing the legacy roof-only default', () => {
        expect(getCorridorRenderFlags()).toEqual({
            hasRoof: true,
            hasFloor: false,
            railingMaterial: null,
        });
        expect(getCorridorRenderFlags('normal')).toEqual({
            hasRoof: true,
            hasFloor: true,
            railingMaterial: null,
        });
        expect(getCorridorRenderFlags('concrete_railings')).toEqual({
            hasRoof: true,
            hasFloor: true,
            railingMaterial: 'concrete',
        });
        expect(getCorridorRenderFlags('metal_railings')).toEqual({
            hasRoof: true,
            hasFloor: true,
            railingMaterial: 'metal',   
        });
    });
});
