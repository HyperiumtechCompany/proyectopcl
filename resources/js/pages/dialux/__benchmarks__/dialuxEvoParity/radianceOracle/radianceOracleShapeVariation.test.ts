import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAllShapeVariationFixtures, type ShapeVariationFixture } from './shapeVariationFixtures';
import { isRadianceAvailable, runRadianceOracle } from './runRadianceOracle';

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
const hasRadiance = isRadianceAvailable();
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

/**
 * `maintenanceFactor: 1` en LAS TRES ramas (no solo 'none') — corregido
 * 2026-08-22 (`planes/plan_precision_fisica_motor_dialux_vs_evo.md` §2,
 * mismo bug y mismo fix que `radianceOraclePolygonShapes.test.ts`): el
 * oráculo Radiance reporta valores "como nuevo", pero antes de este fix
 * 'first-bounce'/'iterative' se dejaban con el 0.8 de
 * `DEFAULT_DIRECT_PREVIEW_CONFIG` (ningún fixture de este archivo declara
 * `siteSettings`) — sub-reportaba esos dos modos ~20% de forma sistemática
 * contra el oráculo en TODAS las filas de este archivo. Verificado con el
 * caso real "SS.HH" de Módulo 22 (`modulo22RealCase.test.ts`) que el fix
 * invierte cuál modo queda más cerca de qué referencia. Los porcentajes
 * `first-bounce`/`iterative` registrados en este archivo ANTES de esta fecha
 * (Rondas 6-22) deben tratarse con cautela hasta remedirse.
 */
async function computeEngineAvgLux(fixture: ShapeVariationFixture, interreflection: 'none' | 'first-bounce' | 'iterative'): Promise<number> {
    const project = buildProjectForShape(fixture);
    const base = buildProductionCalculationConfig(project);
    const config =
        interreflection === 'iterative'
            ? { ...base, interreflection, maxBounces: 30, convergenceTolerance: 1e-6, maintenanceFactor: 1 }
            : { ...base, interreflection, maintenanceFactor: 1 };
    const { resultsByRoom } = await runProjectLightingCalculation(project, config);
    return Object.values(resultsByRoom)[0]!.avg_lux;
}

function relativeError(computed: number, reference: number): number {
    return Math.abs(computed - reference) / reference;
}

/**
 * Ronda 21b: espaciado/zona marginal REALES (adaptativos), no el `spacing`
 * declarado del fixture — bajo `meshPolicy.adaptive: true` (el que
 * `buildProductionCalculationConfig()` activa siempre) producción nunca usa
 * un espaciado fijo ni `room.marginalZone` tal cual, ver
 * `hooks/adaptiveGridSpacing.ts::resolveMeshSpacing`.
 */
function resolveRealMesh(fixture: ShapeVariationFixture): { spacingM: number; marginalZone: number } {
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(fixture.room);
    const { spacingM, marginalZoneOverride } = resolveMeshSpacing(fixture.room, fixture.fixtures, usefulPlaneHeight, [], {
        gridSpacingM: GRID_SPACING,
        adaptive: true,
    });
    return { spacingM, marginalZone: marginalZoneOverride ?? fixture.marginalZone };
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

            const realMesh = resolveRealMesh(fixture);
            const oracle = await runRadianceOracle({
                room: {
                    width: fixture.width,
                    depth: fixture.depth,
                    height: fixture.height,
                    workingPlaneHeight: fixture.workingPlaneHeight,
                    marginalZone: realMesh.marginalZone,
                    reflectance: fixture.reflectance,
                },
                fixtures: fixture.fixtures.map((f) => ({
                    fixture: f,
                    label: f.name,
                    manufacturer: f.brand ?? 'desconocido',
                    articleNumber: f.articleNumber ?? 'desconocido',
                    provenanceNote: `oráculo Radiance — variación de forma, ${fixture.variesFrom_sshhVsBano}`,
                })),
                spacing: realMesh.spacingM,
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

            // Validación del montaje — confirma que geometría/IES/malla están
            // razonablemente bien armados para esta forma nueva. Desde la
            // Ronda 21 el oráculo usa exactamente la misma malla que el motor
            // real (ver `generateSensorGrid.ts`), así que un residual dentro
            // de esta cota ya no puede explicarse por mallas distintas.
            expect(directRelativeError).toBeLessThan(0.15);

            // Sin aserción sobre cuál modo gana a propósito (ver doc-comment
            // del archivo) — solo se registra el resultado.
            expect(Number.isFinite(errorFirstBounce)).toBe(true);
            expect(Number.isFinite(errorIterative)).toBe(true);
        },
        TEST_TIMEOUT_MS,
    );
});
