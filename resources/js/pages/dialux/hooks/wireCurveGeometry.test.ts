import { describe, expect, it } from 'vitest';
import {
    defaultWireCurveMidpoint,
    quadraticControlThroughMidpoint,
    quadraticPoint,
} from './wireCurveGeometry';

describe('wireCurveGeometry', () => {
    it('hace pasar la curva por el punto central editable', () => {
        const start = { x: 0, y: 0 };
        const midpoint = { x: 5, y: 3 };
        const end = { x: 10, y: 0 };
        const control = quadraticControlThroughMidpoint(start, midpoint, end);

        expect(quadraticPoint(start, control, end, 0.5)).toEqual(midpoint);
    });

    it('crea un arco predeterminado y no una recta', () => {
        const midpoint = defaultWireCurveMidpoint(
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            'wall_ceiling',
        );
        expect(midpoint.y).not.toBe(0);
    });
});
