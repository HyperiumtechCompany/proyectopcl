import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAllPolygonShapeFixtures, type PolygonShapeFixture } from './polygonShapeFixtures';
import { runRadianceOracleForPolygon } from './runRadianceOracle';

/**
 * Ronda 14 (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-14): a
 * pedido explícito del usuario ("no siempre son rectangulares, cuadrados,
 * sino diferentes formas"), extiende la investigación de la Causa B a
 * ambientes de forma ARBITRARIA (polígono de N lados) — hasta ahora todos
 * los fixtures de `fixtures.ts`/`shapeVariationFixtures.ts` eran
 * rectángulos/cuadrados. Usa `runRadianceOracleForPolygon()` (no
 * `runRadianceOracle()`, que solo soporta cajas rectangulares).
 *
 * Igual que `radianceOracleShapeVariation.test.ts`: se salta automáticamente
 * sin `RADIANCE_BIN_DIR`, y ninguna aserción decide "qué modo es mejor".
 */
const hasRadiance = Boolean(process.env.RADIANCE_BIN_DIR);
const TEST_TIMEOUT_MS = 720_000;
const ORACLE_TIMEOUT_MS = 600_000;

function buildProjectForFixture(fixture: PolygonShapeFixture): Project {
    const room: Room = {
        id: fixture.id,
        name: fixture.label,
        roomType: 'ambient',
        vertices: fixture.vertices,
        height: fixture.height,
        color: '#000000',
        illuminanceLux: 100,
        usefulPlaneHeight: fixture.workingPlaneHeight,
        marginalZone: fixture.marginalZone,
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

async function computeEngineAvgLux(fixture: PolygonShapeFixture, interreflection: 'none' | 'first-bounce' | 'iterative'): Promise<number> {
    const project = buildProjectForFixture(fixture);
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

describe.skipIf(!hasRadiance)('Oráculo Radiance — ambientes de forma NO rectangular (§-14)', () => {
    it.each(buildAllPolygonShapeFixtures())(
        '$id ($label): first-bounce vs. iterative vs. Radiance (informativo)',
        async (fixture) => {
            const [engineDirect, engineFirstBounce, engineIterative] = await Promise.all([
                computeEngineAvgLux(fixture, 'none'),
                computeEngineAvgLux(fixture, 'first-bounce'),
                computeEngineAvgLux(fixture, 'iterative'),
            ]);

            const oracle = await runRadianceOracleForPolygon({
                room: {
                    vertices: fixture.vertices,
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
                    provenanceNote: `oráculo Radiance — forma no rectangular, ${fixture.variesFrom_rectangular}`,
                })),
                spacing: fixture.spacing,
                timeoutMs: ORACLE_TIMEOUT_MS,
            });

            const directRelativeError = relativeError(oracle.directLux, engineDirect);
            const errorFirstBounce = relativeError(engineFirstBounce, oracle.fullReflectionLux);
            const errorIterative = relativeError(engineIterative, oracle.fullReflectionLux);

            // eslint-disable-next-line no-console
            console.log(
                `[radiance-polygon] ${fixture.id} (${fixture.variesFrom_rectangular}): ` +
                    `directo motor=${engineDirect.toFixed(1)} lx · directo Radiance=${oracle.directLux.toFixed(1)} lx (error ${(directRelativeError * 100).toFixed(1)}%) · ` +
                    `Radiance con reflexión completa=${oracle.fullReflectionLux.toFixed(1)} lx (referencia física) · ` +
                    `first-bounce=${engineFirstBounce.toFixed(1)} lx (error ${(errorFirstBounce * 100).toFixed(1)}%) · ` +
                    `iterative=${engineIterative.toFixed(1)} lx (error ${(errorIterative * 100).toFixed(1)}%) · ` +
                    `gana=${errorFirstBounce < errorIterative ? 'first-bounce' : 'iterative'}`,
            );

            // Validación del montaje (mismo criterio que los demás tests de
            // este oráculo): confirma que geometría poligonal/IES/malla están
            // razonablemente bien armados para esta forma no rectangular.
            expect(directRelativeError).toBeLessThan(0.15);

            expect(Number.isFinite(errorFirstBounce)).toBe(true);
            expect(Number.isFinite(errorIterative)).toBe(true);
        },
        TEST_TIMEOUT_MS,
    );
});
