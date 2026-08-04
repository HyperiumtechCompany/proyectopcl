import { describe, expect, it } from 'vitest';
import { measureDistance } from './OverlayMeasureDistance';

describe('measureDistance', () => {
    it('calcula la distancia en metros de escena', () => {
        expect(measureDistance({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(5);
    });

    it('no depende del sentido de medición', () => {
        expect(measureDistance({ x: 4, y: 6 }, { x: 1, y: 2 })).toBe(5);
    });
});
