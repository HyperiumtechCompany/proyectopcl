import { describe, expect, it } from 'vitest';
import { computeConeDiagram } from './computeConeDiagram';

describe('computeConeDiagram', () => {
    const gamma_angles = [0, 15, 30, 45, 60, 75, 90];
    const candela = [1000, 950, 800, 550, 300, 100, 0];

    it('E0 sigue la ley del inverso del cuadrado (I(0)/d²)', () => {
        const rows = computeConeDiagram({ gamma_angles, candela: [candela] }, 30);
        expect(rows).not.toBeNull();
        const [d1, d2] = rows!;
        expect(d1.e0Lux).toBeCloseTo(1000, 5); // d=1m: 1000/1²
        expect(d2.e0Lux).toBeCloseTo(250, 5); // d=2m: 1000/2²
    });

    it('el diámetro del haz crece linealmente con la distancia', () => {
        const rows = computeConeDiagram({ gamma_angles, candela: [candela] }, 30)!;
        const ratio2to1 = rows[1].beamDiameterM / rows[0].beamDiameterM;
        const ratio3to1 = rows[2].beamDiameterM / rows[0].beamDiameterM;
        expect(ratio2to1).toBeCloseTo(2, 5);
        expect(ratio3to1).toBeCloseTo(3, 5);
    });

    it('Eavg es siempre menor o igual que E0 (la intensidad decae hacia el borde del haz)', () => {
        const rows = computeConeDiagram({ gamma_angles, candela: [candela] }, 30)!;
        for (const row of rows) {
            expect(row.eAvgLux).toBeLessThanOrEqual(row.e0Lux);
        }
    });

    it('devuelve null sin matriz fotométrica o sin ángulo de haz', () => {
        expect(computeConeDiagram(null, 30)).toBeNull();
        expect(computeConeDiagram({ gamma_angles, candela: [candela] }, null)).toBeNull();
        expect(computeConeDiagram({ gamma_angles, candela: [candela] }, 0)).toBeNull();
    });
});
