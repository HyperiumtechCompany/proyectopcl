import { describe, expect, it } from 'vitest';
import { cableWaypointElevations } from './cableElevation';
import type { SiteElement } from './types';

function platform(
    id: string,
    x0: number,
    x1: number,
    elevationM: number,
): SiteElement {
    return {
        id,
        type: 'terrace_platform',
        label: id,
        vertices: [
            { x: x0, y: 0 },
            { x: x1, y: 0 },
            { x: x1, y: 10 },
            { x: x0, y: 10 },
        ],
        baseElevationM: elevationM,
        visible: true,
        style: { fillColor: '#000', strokeColor: '#000' },
    } as SiteElement;
}

describe('cableWaypointElevations', () => {
    it('lee la cota de cada plataforma atravesada por el cable', () => {
        const elevations = cableWaypointElevations(
            [
                { x: 5, y: 5 },
                { x: 15, y: 5 },
                { x: 25, y: 5 },
            ],
            [
                platform('baja', 0, 10, 0),
                platform('alta', 10, 20, 3.5),
                platform('media', 20, 30, 1.2),
            ],
            1,
        );

        expect(elevations).toEqual([0, 3.5, 1.2]);
    });
});
