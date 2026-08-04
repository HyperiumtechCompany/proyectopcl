import { describe, expect, it } from 'vitest';
import { buildConductor3DPath } from './conductor3DPath';

describe('buildConductor3DPath', () => {
    it('mantiene los waypoints en el techo sin bajadas intermedias', () => {
        expect(buildConductor3DPath([
            { x: 0, y: 1.4, z: 0 },
            { x: 2, y: 2.7, z: 1 },
            { x: 4, y: 2.7, z: 2 },
            { x: 6, y: 4.5, z: 3 },
        ], 4.67)).toEqual([
            { x: 0, y: 1.4, z: 0 },
            { x: 0, y: 4.67, z: 0 },
            { x: 2, y: 4.67, z: 1 },
            { x: 4, y: 4.67, z: 2 },
            { x: 6, y: 4.67, z: 3 },
            { x: 6, y: 4.5, z: 3 },
        ]);
    });

    it('elimina transiciones de longitud cero', () => {
        expect(buildConductor3DPath([
            { x: 0, y: 2.7, z: 0 },
            { x: 3, y: 2.7, z: 0 },
        ], 2.7)).toEqual([
            { x: 0, y: 2.7, z: 0 },
            { x: 3, y: 2.7, z: 0 },
        ]);
    });
});
