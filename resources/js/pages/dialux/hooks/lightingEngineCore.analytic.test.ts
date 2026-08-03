import { describe, expect, it } from 'vitest';
import { calculateLightingResult } from './lightingEngineCore';
import type { Fixture, Room } from './useEditorStore';

/**
 * Suite de validación analítica (Fase 5 del plan maestro, §10.1/§10.3/§14.5:
 * "Comparar con suite analítica... tolerancia ≤0.5%"). El golden de Fase 0
 * (`lightingEngineCore.fase0Golden.test.ts`) congela el resultado ACTUAL del
 * motor pero explícitamente NO afirma que sea correcto contra una
 * referencia externa — esta suite es esa referencia: casos con solución
 * cerrada (ley del inverso del cuadrado, ley del coseno de Lambert),
 * verificables sin depender de ningún archivo IES/LDT.
 *
 * Truco de fixture: un recinto de exactamente `GRID_SPACING` x `GRID_SPACING`
 * metros produce, por construcción de `buildGrid`, una malla de 1x1 con un
 * único punto activo en su centro — eso da control total sobre la posición
 * exacta del punto de cálculo sin exportar ninguna función interna del
 * motor solo para poder probarla.
 */

const GRID_SPACING = 0.5; // debe coincidir con hooks/lightingEngineCore.ts
const ANALYTIC_TOLERANCE = 0.005; // ±0.5%, plan maestro §10.3

function buildSinglePointRoom(usefulPlaneHeight = 0): Room {
    return {
        id: 'analytic-room',
        name: 'Punto de referencia analítico',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: GRID_SPACING, y: 0 },
            { x: GRID_SPACING, y: GRID_SPACING },
            { x: 0, y: GRID_SPACING },
        ],
        height: 3,
        color: '#000000',
        usefulPlaneHeight,
    };
}

/** Luminaria sin `photometricWeb` → modelo Lambertiano puro, I(gamma) = I0*cos(gamma), I0 = lumens*efficiency/π. */
function buildLambertianFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'analytic-fixture',
        name: 'Fuente Lambertiana de referencia',
        x: GRID_SPACING / 2,
        y: GRID_SPACING / 2,
        z: 2,
        lumens: 4000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
        ...overrides,
    };
}

describe('Fase 5 — validación analítica del solver direct-preview-v1', () => {
    it('fuente puntual directamente sobre el punto: E = I0/h² (ley del inverso del cuadrado, incidencia normal)', () => {
        const h = 2;
        const room = buildSinglePointRoom(0);
        const fixture = buildLambertianFixture({ z: h });
        const intensity = (fixture.lumens * fixture.efficiency) / Math.PI;
        const expectedLux = intensity / (h * h);

        const result = calculateLightingResult(room, [fixture]);

        expect(result.grid_rows * result.grid_cols).toBe(1);
        expect(result.avg_lux).toBeCloseTo(expectedLux, 0);
        expect(Math.abs(result.avg_lux - expectedLux) / expectedLux).toBeLessThan(ANALYTIC_TOLERANCE);
    });

    it('fuente puntual fuera de eje: E = I0 · (h/d)² / d² (ley del coseno de Lambert + inverso del cuadrado combinadas)', () => {
        const h = 2;
        const offsetX = 1.5;
        const room = buildSinglePointRoom(0);
        const fixture = buildLambertianFixture({
            x: GRID_SPACING / 2 + offsetX,
            y: GRID_SPACING / 2,
            z: h,
        });
        const intensity = (fixture.lumens * fixture.efficiency) / Math.PI;
        const dist = Math.hypot(offsetX, h);
        // Mismo ángulo gamma (fixture→punto) hace de ángulo de emisión Y de
        // incidencia (el eje del proyector apunta al nadir, la superficie
        // receptora es horizontal): E = I0·cos(gamma)² / d².
        const cosGamma = h / dist;
        const expectedLux = (intensity * cosGamma * cosGamma) / (dist * dist);

        const result = calculateLightingResult(room, [fixture]);

        expect(Math.abs(result.avg_lux - expectedLux) / expectedLux).toBeLessThan(ANALYTIC_TOLERANCE);
    });

    it('duplicar la distancia (misma vertical) reduce la iluminancia a un cuarto', () => {
        const room = buildSinglePointRoom(0);
        const near = calculateLightingResult(room, [buildLambertianFixture({ z: 2 })]);
        const far = calculateLightingResult(room, [buildLambertianFixture({ z: 4 })]);

        expect(Math.abs(far.avg_lux - near.avg_lux / 4) / (near.avg_lux / 4)).toBeLessThan(ANALYTIC_TOLERANCE);
    });

    it('duplicar luminarias idénticas duplica la contribución directa (superposición lineal)', () => {
        const room = buildSinglePointRoom(0);
        const one = calculateLightingResult(room, [buildLambertianFixture({ id: 'f1' })]);
        const two = calculateLightingResult(room, [
            buildLambertianFixture({ id: 'f1' }),
            buildLambertianFixture({ id: 'f2' }),
        ]);

        expect(two.avg_lux).toBeCloseTo(one.avg_lux * 2, 9);
    });

    it('rotar una luminaria Lambertiana (sin matriz fotométrica real) no cambia el resultado — el modelo no depende de azimut', () => {
        const room = buildSinglePointRoom(0);
        const unrotated = calculateLightingResult(room, [buildLambertianFixture({ rotation: 0 })]);
        const rotated = calculateLightingResult(room, [buildLambertianFixture({ rotation: 137 })]);

        expect(rotated.avg_lux).toBeCloseTo(unrotated.avg_lux, 9);
    });
});
