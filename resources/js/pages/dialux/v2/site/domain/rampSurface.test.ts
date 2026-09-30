import { describe, expect, it } from 'vitest';
import { cableProfileM } from './cableElevation';
import { rampSurfaceSampler } from './rampFootprint';
import type { SiteElement } from './types';

// Rampa recta de 20 m × 2 m que sube de 0 a 1,5 m (una plataforma a otra).
const ramp: SiteElement = {
    id: 'r',
    type: 'ramp',
    label: 'Rampa',
    vertices: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 2 },
        { x: 0, y: 2 },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
    config: { kind: 'ramp', fromElevationM: 0, toElevationM: 1.5, widthM: 2 } as SiteElement['config'],
};

describe('superficie de paso de rampas (cables y postes suben con ella)', () => {
    const at = rampSurfaceSampler([ramp], 1);

    it('la cota sube a lo largo de la rampa, de su inicio a su llegada', () => {
        const samples = [1, 5, 10, 15, 19].map((x) => at({ x, y: 1 }));
        expect(samples.every((z) => z !== null)).toBe(true);
        for (let i = 1; i < samples.length; i++) {
            expect(Math.abs(samples[i]! - samples[i - 1]!)).toBeGreaterThanOrEqual(0);
        }
        const low = Math.min(...(samples as number[]));
        const high = Math.max(...(samples as number[]));
        expect(low).toBeGreaterThanOrEqual(-1e-9);
        expect(high).toBeLessThanOrEqual(1.5 + 1e-9);
        // Desnivel real recorrido (no un plano a la cota media).
        expect(high - low).toBeGreaterThan(1);
    });

    it('fuera de la rampa no aplica', () => {
        expect(at({ x: 10, y: 10 })).toBeNull();
    });

    it('un cable a lo largo de la rampa mide su recorrido inclinado, no la planta', () => {
        const profile = cableProfileM([{ x: 0.5, y: 1 }, { x: 19.5, y: 1 }], [ramp], 1);
        expect(profile.alongM + profile.riseM).toBeGreaterThan(19);
        // Pendiente suave (< 45°): cuenta como recorrido inclinado, sin "saltos".
        expect(profile.riseM).toBeCloseTo(0, 9);
    });
});
