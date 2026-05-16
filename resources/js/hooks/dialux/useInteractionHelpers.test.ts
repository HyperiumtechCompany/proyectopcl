import { describe, expect, it } from 'vitest';

import type { Wall } from './types';
import {
    clampOpeningOffsetToWallSegment,
    projectPointToWallProjection,
    wallLength,
} from './useInteractionHelpers';

const angledWall = {
    id: 'wall-1',
    vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
    ],
    thickness: 0.15,
    height: 2.7,
} satisfies Wall;

describe('useInteractionHelpers wall projection', () => {
    it('projects a point to the selected wall segment with metric offsets', () => {
        const projection = projectPointToWallProjection(
            { x: 4.05, y: 1.2 },
            angledWall,
        );

        expect(projection).not.toBeNull();
        expect(projection?.segmentIndex).toBe(1);
        expect(projection?.segmentStartOffset).toBeCloseTo(4, 6);
        expect(projection?.segmentEndOffset).toBeCloseTo(7, 6);
        expect(projection?.offsetAlongWall).toBeCloseTo(5.2, 6);
    });

    it('centers a door on the picked point without crossing a wall corner', () => {
        const projection = projectPointToWallProjection(
            { x: 4, y: 0.2 },
            angledWall,
        );

        expect(projection).not.toBeNull();

        const offset = clampOpeningOffsetToWallSegment(
            projection!,
            0.9,
            wallLength(angledWall.vertices),
            'center',
        );

        expect(offset).toBeCloseTo(4, 6);
    });
});
