import { describe, expect, it } from 'vitest';
import type { Fixture } from '@/pages/dialux/hooks/types';
import { generateIesFromFixture } from './generateIes';

function buildLambertianFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'f1',
        name: 'Test',
        x: 0,
        y: 0,
        z: 0,
        lumens: 2580,
        power: 26,
        efficiency: 1,
        fixtureType: 'recessed',
        lightColor: '#ffffff',
        ...overrides,
    };
}

describe('generateIesFromFixture', () => {
    it('produce un IES LM-63-2002 con 37 ángulos verticales y 1 horizontal (simetría rotacional)', () => {
        const ies = generateIesFromFixture(buildLambertianFixture(), {
            label: 'Test luminaire',
            manufacturer: 'Test Mfr',
            articleNumber: 'TEST-1',
            provenanceNote: 'unit test',
        });

        expect(ies).toMatch(/^IESNA:LM-63-2002/);
        expect(ies).toContain('TILT=NONE');
        const lines = ies.split('\n');
        const line1Index = lines.findIndex((line) => /^1 2580 1 37 1 1 2 0 0 0$/.test(line));
        expect(line1Index).toBeGreaterThanOrEqual(0);

        const verticalAnglesLine = lines[line1Index + 2]!;
        expect(verticalAnglesLine.split(' ')).toHaveLength(37);
        expect(verticalAnglesLine.startsWith('0 5 10')).toBe(true);
        expect(verticalAnglesLine.endsWith('180')).toBe(true);

        const horizontalAnglesLine = lines[line1Index + 3]!;
        expect(horizontalAnglesLine).toBe('0');

        const candelaLine = lines[line1Index + 4]!;
        expect(candelaLine.split(' ')).toHaveLength(37);
    });

    it('sin photometricWeb: la candela en nadir (gamma=0) coincide con el fallback Lambertiano I0=lumens*efficiencia/pi', () => {
        const fixture = buildLambertianFixture({ lumens: 2580, efficiency: 1 });
        const ies = generateIesFromFixture(fixture, {
            label: 'x',
            manufacturer: 'x',
            articleNumber: 'x',
            provenanceNote: 'x',
        });
        const candelaLine = ies.split('\n').find((line) => line.split(' ').length === 37 && /^\d/.test(line) && line.includes('.'))!;
        const firstValue = Number(candelaLine.split(' ')[0]);
        expect(firstValue).toBeCloseTo(2580 / Math.PI, 2);
    });

    it('con photometricWeb real: usa candela() (misma función que el motor), no un valor sintético distinto', () => {
        const fixture = buildLambertianFixture({
            lumens: 1508,
            photometricWeb: {
                c_angles: [0],
                gamma_angles: [0, 90, 180],
                candela: [[1000, 0, 0]],
                reference_lumens: 1000,
                provenance: 'manufacturer',
            },
        });
        const ies = generateIesFromFixture(fixture, {
            label: 'x',
            manufacturer: 'x',
            articleNumber: 'x',
            provenanceNote: 'x',
        });
        // fluxScale = 1508/1000 = 1.508 -> candela en gamma=0 (el más cercano a 0 en la grilla estándar) debe reflejar el reescalado real.
        const candelaLine = ies.split('\n').find((line) => line.split(' ').length === 37 && line.includes('.'))!;
        const firstValue = Number(candelaLine.split(' ')[0]);
        expect(firstValue).toBeCloseTo(1000 * 1.508, 1);
    });

    it('incluye la nota de procedencia en el encabezado, para trazabilidad', () => {
        const ies = generateIesFromFixture(buildLambertianFixture(), {
            label: 'x',
            manufacturer: 'Thorlux Lighting',
            articleNumber: 'TEG18046',
            provenanceNote: 'descargado de luminaires.dialux.com el 2026-08-09',
        });
        expect(ies).toContain('[MANUFAC] Thorlux Lighting');
        expect(ies).toContain('[LUMCAT] TEG18046');
        expect(ies).toContain('descargado de luminaires.dialux.com el 2026-08-09');
    });
});
