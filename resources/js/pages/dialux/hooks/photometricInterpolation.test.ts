import { describe, expect, it } from 'vitest';
import { candela, candelaFromPhotometricWeb, tiltMultiplier } from './photometricInterpolation';
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

describe('tiltMultiplier — LM-63 TILT=INCLUDE (Fase auditoría dialux-calc-reviewer)', () => {
    function buildFixtureWithTilt(
        geometry: number,
        installationTiltDeg?: number | null,
    ): Fixture {
        return {
            ...buildFixtureWithoutPhotometricWeb(),
            installationTiltDeg,
            photometricWeb: {
                c_angles: [0],
                gamma_angles: [0, 90],
                candela: [[1000, 0]],
                provenance: 'manufacturer',
                tilt: {
                    lamp_to_luminaire_geometry: geometry,
                    angles: [0, 45, 90],
                    multipliers: [1, 0.8, 0.6],
                },
            },
        };
    }

    it('geometría 1/2 (lámpara fija): siempre 1, sin importar installationTiltDeg — el archivo no declara orientación física', () => {
        expect(tiltMultiplier(buildFixtureWithTilt(1, 45))).toBe(1);
        expect(tiltMultiplier(buildFixtureWithTilt(2, 90))).toBe(1);
    });

    it('geometría 3 (orientable) sin installationTiltDeg declarado por el usuario: 1 (sin corrección, nunca asume un ángulo)', () => {
        expect(tiltMultiplier(buildFixtureWithTilt(3, undefined))).toBe(1);
        expect(tiltMultiplier(buildFixtureWithTilt(3, null))).toBe(1);
    });

    it('geometría 3 con installationTiltDeg declarado: interpola la tabla real', () => {
        expect(tiltMultiplier(buildFixtureWithTilt(3, 45))).toBeCloseTo(0.8, 6);
        expect(tiltMultiplier(buildFixtureWithTilt(3, 22.5))).toBeCloseTo(0.9, 6);
    });

    it('sin tabla de tilt en absoluto: siempre 1', () => {
        expect(tiltMultiplier(buildFixtureWithoutPhotometricWeb())).toBe(1);
    });

    it('candela() aplica el multiplicador de tilt solo cuando corresponde (geometría 3 + ángulo declarado)', () => {
        const fixed = buildFixtureWithTilt(1, 45);
        const aimableWithAngle = buildFixtureWithTilt(3, 45);
        const aimableWithoutAngle = buildFixtureWithTilt(3, undefined);

        expect(candela(fixed, 0)).toBeCloseTo(1000, 6);
        expect(candela(aimableWithoutAngle, 0)).toBeCloseTo(1000, 6);
        expect(candela(aimableWithAngle, 0)).toBeCloseTo(800, 6);
    });
});

describe('candelaFromPhotometricWeb — c_angles y candela con longitudes distintas (fotometría legacy)', () => {
    /**
     * Bug real reproducido en producción (crash en runtime, no solo
     * hipotético): el binario Rust `dialux-photometry` no truncaba
     * `c_angles` a la cantidad de planos que la luminaria realmente
     * publica cuando es simétrica y declara más planos C de los que trae
     * (mismo bug que el parser PHP de respaldo ya tenía corregido, ver
     * `ProductImportService::parseLdt`). El resultado quedaba guardado en
     * `photometric_web` con `c_angles.length > candela.length`, y para
     * cualquier azimut que cayera en un plano C sin fila de `candela` (ni
     * en `loIdx` ni en `hiIdx`), `interpolate1D` recibía `values`
     * `undefined` y lanzaba `TypeError: Cannot read properties of
     * undefined`. El fix real es en el binario Rust (ya corregido) más
     * `dialux:repair-photometry` para los datos legacy ya guardados; este
     * test cubre el fallback defensivo mientras esos datos no se reparan.
     */
    it('no lanza y cae a un plano existente cuando el azimut cae en un plano C sin fila de candela', () => {
        const web = {
            c_angles: [0, 90, 180, 270],
            gamma_angles: [0, 90],
            candela: [[100, 50]], // solo 1 fila real; declara 4 planos C
            provenance: 'manufacturer' as const,
        };

        expect(() => candelaFromPhotometricWeb(web, 180, 0)).not.toThrow();
        expect(candelaFromPhotometricWeb(web, 180, 0)).toBe(100);
    });
});
