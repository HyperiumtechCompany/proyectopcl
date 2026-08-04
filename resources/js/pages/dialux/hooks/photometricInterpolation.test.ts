import { describe, expect, it } from 'vitest';
import { candela } from './photometricInterpolation';
import type { Fixture } from './types';

/**
 * Regresión de la auditoría de Fase 7 (`dialux-calc-reviewer`): el modelo
 * Lambertiano de respaldo (`candela` sin `photometricWeb`) usaba
 * `intensity * Math.cos(gammaRad)` sin recortar a cero — para `gamma > 90°`
 * (ej. un parche de techo justo encima de una luminaria orientada hacia
 * abajo, `hooks/firstBounceReflection.ts`) esto devolvía intensidad
 * NEGATIVA, físicamente imposible. Antes de la Fase 7 nunca se detectó
 * porque `illuminanceFromFixture` solo se evaluaba con puntos de malla por
 * debajo/alrededor de la luminaria (`gamma` típicamente ≤ 90°).
 */
function buildFixtureWithoutPhotometricWeb(): Fixture {
    return {
        id: 'candela-fallback-fixture',
        name: 'Luminaria sin fotometría real',
        x: 0,
        y: 0,
        z: 3,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('candela — modelo Lambertiano de respaldo (sin photometricWeb)', () => {
    it('en el hemisferio hacia adelante (gamma <= 90°) devuelve un valor positivo, máximo en nadir', () => {
        const fixture = buildFixtureWithoutPhotometricWeb();
        const nadir = candela(fixture, 0);
        const oblique = candela(fixture, 60);
        const grazing = candela(fixture, 90);

        expect(nadir).toBeGreaterThan(0);
        expect(oblique).toBeGreaterThan(0);
        expect(oblique).toBeLessThan(nadir);
        expect(grazing).toBeCloseTo(0, 6);
    });

    it('detrás de la luminaria (gamma > 90°) nunca devuelve intensidad negativa', () => {
        const fixture = buildFixtureWithoutPhotometricWeb();
        expect(candela(fixture, 91)).toBe(0);
        expect(candela(fixture, 135)).toBe(0);
        expect(candela(fixture, 180)).toBe(0);
    });
});

describe('candela — fotometría importada editable', () => {
    it('escala las candelas cuando cambian los lúmenes de la luminaria', () => {
        const fixture: Fixture = {
            ...buildFixtureWithoutPhotometricWeb(),
            lumens: 4000,
            photometricWeb: {
                c_angles: [0],
                gamma_angles: [0, 90],
                candela: [[1000, 0]],
                reference_lumens: 2000,
                provenance: 'manufacturer',
            },
        };

        expect(candela(fixture, 0)).toBe(2000);
    });

    it('descarta snapshots LDT legacy desplazados y calcula desde el flujo editado', () => {
        const fixture: Fixture = {
            ...buildFixtureWithoutPhotometricWeb(),
            photometricWeb: {
                c_angles: [0.592],
                gamma_angles: [0, 90, 180],
                candela: [[1, 5, 900]],
                provenance: 'manufacturer',
            },
        };

        expect(candela(fixture, 0)).toBeCloseTo(3000 / Math.PI, 6);
    });
});
