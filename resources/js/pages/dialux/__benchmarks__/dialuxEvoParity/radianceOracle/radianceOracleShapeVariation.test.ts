import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAllShapeVariationFixtures, type ShapeVariationFixture } from './shapeVariationFixtures';
import { runRadianceOracle } from './runRadianceOracle';

/**
 * Ronda 6 → siguiente paso concreto (`planes/plan_cierre_brecha_paridad_dialux_evo.md`
 * §-6): correr el oráculo de Radiance sobre 3-5 formas de ambiente más
 * (aspecto, tamaño, reflectancia) para ver si existe un patrón predecible de
 * cuándo `first-bounce` se acerca más a la realidad física que `iterative`,
 * o viceversa — los dos casos de `fixtures.ts` dieron resultados opuestos
 * (uno favorecía cada modo) y no alcanzan para generalizar.
 *
 * Igual que `radianceOracle.test.ts`: se salta automáticamente si
 * `RADIANCE_BIN_DIR` no está configurada. Ninguna aserción decide "qué modo
 * es mejor" — eso es exactamente la pregunta abierta que este test alimenta
 * con más datos, no algo que un test deba fijar de antemano.
 */
const hasRadiance = Boolean(process.env.RADIANCE_BIN_DIR);
// Mayor que `radianceOracle.test.ts` (420_000): el caso "large-square" (16 m²,
// grilla 6x6) mide más superficie/sensores que los fixtures de `fixtures.ts`
// (~2-4 m²) — la corrida con reflexión completa (`-ab 8`) tardó más de 360s
// (el timeout interno anterior) en una medición real, sin siquiera terminar.
const TEST_TIMEOUT_MS = 720_000;
const ORACLE_TIMEOUT_MS = 600_000;

function buildProjectForShape(fixture: ShapeVariationFixture): Project {
    const room: Room = {
        ...fixture.room,
        ceilingReflectance: fixture.reflectance.ceiling,
        wallReflectance: fixture.reflectance.wall,
        floorReflectance: fixture.reflectance.floor,
    };
    const scene: Scene = {
        id: `${fixture.id}-scene`,
        name: 'n',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: room.height,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'm', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: fixture.fixtures,
        lightSwitches: [],
        partitions: [],
    };
    return { id: `${fixture.id}-project`, name: fixture.label, created_at: '', updated_at: '', scenes: [scene] };
}

async function computeEngineAvgLux(fixture: ShapeVariationFixture, interreflection: 'none' | 'first-bounce' | 'iterative'): Promise<number> {
    const project = buildProjectForShape(fixture);
    const base = buildProductionCalculationConfig(project);
    const config = interreflection === 'iterative'
        ? { ...base, interreflection, maxBounces: 30, convergenceTolerance: 1e-6 }
        : { ...base, interreflection, maintenanceFactor: interreflection === 'none' ? 1 : base.maintenanceFactor };
    const { resultsByRoom } = await runProjectLightingCalculation(project, config);
    return Object.values(resultsByRoom)[0]!.avg_lux;
}

function relativeError(computed: number, reference: number): number {
    return Math.abs(computed - reference) / reference;
}

describe.skipIf(!hasRadiance)('Oráculo Radiance — variación de forma/tamaño/reflectancia (§-6 siguiente paso)', () => {
    it.each(buildAllShapeVariationFixtures())(
        '$id ($label): first-bounce vs. iterative vs. Radiance (informativo)',
        async (fixture) => {
            const [engineDirect, engineFirstBounce, engineIterative] = await Promise.all([
                computeEngineAvgLux(fixture, 'none'),
                computeEngineAvgLux(fixture, 'first-bounce'),
                computeEngineAvgLux(fixture, 'iterative'),
            ]);

            const oracle = await runRadianceOracle({
                room: {
                    width: fixture.width,
                    depth: fixture.depth,
                    height: fixture.height,
                    workingPlaneHeight: fixture.workingPlaneHeight,
                    marginalZone: fixture.marginalZone,
                    reflectance: fixture.reflectance,
                },
                fixtures: fixture.fixtures.map((f) => ({
                    fixture: f,
                    label: f.name,
                    manufacturer: f.brand ?? 'desconocido',
                    articleNumber: f.articleNumber ?? 'desconocido',
                    provenanceNote: `oráculo Radiance — variación de forma, ${fixture.variesFrom_sshhVsBano}`,
                })),
                grid: fixture.grid,
                timeoutMs: ORACLE_TIMEOUT_MS,
            });

            const directRelativeError = relativeError(oracle.directLux, engineDirect);
            const errorFirstBounce = relativeError(engineFirstBounce, oracle.fullReflectionLux);
            const errorIterative = relativeError(engineIterative, oracle.fullReflectionLux);

            // eslint-disable-next-line no-console
            console.log(
                `[radiance-shape] ${fixture.id} (${fixture.variesFrom_sshhVsBano}): ` +
                    `directo motor=${engineDirect.toFixed(1)} lx · directo Radiance=${oracle.directLux.toFixed(1)} lx (error ${(directRelativeError * 100).toFixed(1)}%) · ` +
                    `Radiance con reflexión completa=${oracle.fullReflectionLux.toFixed(1)} lx (referencia física) · ` +
                    `first-bounce=${engineFirstBounce.toFixed(1)} lx (error ${(errorFirstBounce * 100).toFixed(1)}%) · ` +
                    `iterative=${engineIterative.toFixed(1)} lx (error ${(errorIterative * 100).toFixed(1)}%) · ` +
                    `gana=${errorFirstBounce < errorIterative ? 'first-bounce' : 'iterative'}`,
            );

            // Validación del montaje (igual criterio que `radianceOracle.test.ts`,
            // Ronda 6: 1.9%/4.7% medidos) — confirma que geometría/IES/malla
            // están razonablemente bien armados para esta forma nueva, no que
            // ambos motores usen la misma malla exacta.
            expect(directRelativeError).toBeLessThan(0.15);

            // Sin aserción sobre cuál modo gana a propósito (ver doc-comment
            // del archivo) — solo se registra el resultado.
            expect(Number.isFinite(errorFirstBounce)).toBe(true);
            expect(Number.isFinite(errorIterative)).toBe(true);
        },
        TEST_TIMEOUT_MS,
    );
});
