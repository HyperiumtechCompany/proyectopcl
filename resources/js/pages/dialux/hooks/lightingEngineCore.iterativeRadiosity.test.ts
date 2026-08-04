import { describe, expect, it } from 'vitest';
import { calculateLightingResult, GRID_SPACING } from './lightingEngineCore';
import type { Fixture, Room } from './useEditorStore';

/**
 * Suite de la Fase 8 ("Interreflexión iterativa", plan maestro §11) al nivel
 * de la API pública `calculateLightingResult` — la suite de más bajo nivel
 * (`solveRadiosity`/`gatherRadiosityIlluminance`) vive en
 * `iterativeRadiosity.test.ts`.
 */

function buildRoom(side = 4, height = 3): Room {
    return {
        id: 'iterative-radiosity-room',
        name: 'Recinto de referencia — radiosidad iterativa',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: side, y: 0 },
            { x: side, y: side },
            { x: 0, y: side },
        ],
        height,
        color: '#000000',
        usefulPlaneHeight: 0.8,
    };
}

function buildCentralFixture(z = 2.8): Fixture {
    return {
        id: 'iterative-radiosity-fixture',
        name: 'Luminaria de referencia',
        x: 2,
        y: 2,
        z,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

const REFLECTANCES = { ceiling: 0.7, wall: 0.5, floor: 0.3 };

describe('Fase 8 — compatibilidad hacia atrás', () => {
    it('sin iterativeConfig (default null), el resultado es idéntico al de la Fase 7 (un único rebote)', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const firstBounce = calculateLightingResult(room, [fixture], GRID_SPACING, [], REFLECTANCES);
        const withoutIterativeParam = calculateLightingResult(room, [fixture], GRID_SPACING, [], REFLECTANCES, null);

        expect(withoutIterativeParam.avg_lux).toBe(firstBounce.avg_lux);
        expect(withoutIterativeParam.grid_values).toEqual(firstBounce.grid_values);
        expect(withoutIterativeParam.interreflection_iterations).toBeUndefined();
    });

    it('maxBounces=1 produce exactamente el mismo resultado que la Fase 7 (un único rebote)', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const firstBounce = calculateLightingResult(room, [fixture], GRID_SPACING, [], REFLECTANCES);
        const oneBounceIterative = calculateLightingResult(room, [fixture], GRID_SPACING, [], REFLECTANCES, {
            maxBounces: 1,
            convergenceTolerance: 1e-6,
        });

        expect(oneBounceIterative.avg_lux).toBeCloseTo(firstBounce.avg_lux, 9);
        expect(oneBounceIterative.interreflection_iterations).toBe(1);
        expect(oneBounceIterative.interreflection_converged).toBe(true);
    });

    it('sin surfaceReflectances, iterativeConfig no tiene ningún efecto (sin parches no hay nada que iterar)', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const direct = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const withIterativeButNoReflectances = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, {
            maxBounces: 20,
            convergenceTolerance: 1e-4,
        });

        expect(withIterativeButNoReflectances.avg_lux).toBe(direct.avg_lux);
        expect(withIterativeButNoReflectances.interreflection_iterations).toBeUndefined();
    });
});

describe('Fase 8 — múltiples rebotes aportan más luz que uno solo', () => {
    it('con maxBounces > 1, el avg_lux es mayor que con un único rebote (Fase 7)', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const firstBounce = calculateLightingResult(room, [fixture], GRID_SPACING, [], REFLECTANCES);
        const iterative = calculateLightingResult(room, [fixture], GRID_SPACING, [], REFLECTANCES, {
            maxBounces: 30,
            convergenceTolerance: 1e-5,
        });

        expect(iterative.avg_lux).toBeGreaterThan(firstBounce.avg_lux);
        expect(iterative.interreflection_converged).toBe(true);
        expect(iterative.interreflection_iterations!).toBeGreaterThan(1);
        expect(iterative.interreflection_residual!).toBeLessThanOrEqual(1e-5);
    });

    it('con reflectancia 0 en todo, la radiosidad iterativa reproduce el cálculo directo EXACTO (converge trivialmente)', () => {
        const room = buildRoom();
        const fixture = buildCentralFixture();
        const direct = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const iterative = calculateLightingResult(room, [fixture], GRID_SPACING, [], { ceiling: 0, wall: 0, floor: 0 }, {
            maxBounces: 30,
            convergenceTolerance: 1e-6,
        });

        expect(iterative.avg_lux).toBe(direct.avg_lux);
        expect(iterative.interreflection_iterations).toBe(1);
        expect(iterative.interreflection_converged).toBe(true);
    });
});
