import { describe, expect, it } from 'vitest';
import { siteQuantityCheck } from './siteQuantityCheck';

describe('siteQuantityCheck (tabla de cantidad de la V1 en exteriores)', () => {
    it('cancha 600 m², 100 lx, 4 postes de 20 000 lm (Fm 0,8 → 16 000 lm mantenidos)', () => {
        const check = siteQuantityCheck(
            { areaM2: 600, ownLuminaires: 4, ownMaintainedFluxLm: 64000 },
            100,
        )!;
        // Fórmula literal V1 con flujo mantenido: 600·100·0,8 = 48 000 lm → 3 luminarias.
        expect(check.lumensRequired).toBeCloseTo(48000, 9);
        expect(check.exactQuantity).toBeCloseTo(3, 9);
        // 4 / 3 = 133 % → óptimo (90–150 %).
        expect(check.coverage).toBe('optimal');
    });

    it('equivale a la fórmula de la V1 con flujo nominal y Fm 0,8', () => {
        const check = siteQuantityCheck({ areaM2: 600, ownLuminaires: 4, ownMaintainedFluxLm: 64000 }, 100)!;
        const v1 = (((600 * 100) / 0.8) * 0.8) / 20000;
        // Flujo nominal = 64 000 / 4 / 0,8 = 20 000 lm c/u.
        expect(check.exactQuantity).toBeCloseTo(v1, 9);
    });

    it('sin luminarias propias: insuficiente; sin actividad: sin verificación', () => {
        expect(siteQuantityCheck({ areaM2: 100, ownLuminaires: 0, ownMaintainedFluxLm: 0 }, 20)!.coverage).toBe('insufficient');
        expect(siteQuantityCheck({ areaM2: 100, ownLuminaires: 2, ownMaintainedFluxLm: 1000 }, undefined)).toBeNull();
    });

    it('excesivo por encima de 150 %', () => {
        expect(siteQuantityCheck({ areaM2: 100, ownLuminaires: 10, ownMaintainedFluxLm: 30000 }, 10)!.coverage).toBe('excessive');
    });
});
