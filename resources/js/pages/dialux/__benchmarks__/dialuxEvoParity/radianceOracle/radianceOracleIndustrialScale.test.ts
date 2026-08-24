import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import type { CalculationConfig } from '@/pages/dialux/domain/calculation/types';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAllIndustrialScaleFixtures, type IndustrialScaleFixture } from './industrialScaleFixtures';
import { isRadianceAvailable, runRadianceOracle } from './runRadianceOracle';

/**
 * Matriz de escala (`planes/plan_precision_fisica_motor_dialux_vs_evo.md`
 * §7) — a pedido explícito del usuario ("distintos casos... desde una
 * caseta de baño hasta una sala industrial"), extiende la validación con
 * Radiance más allá del máximo previo de esta carpeta (4x4 m / 16 m², una
 * sola luminaria) a oficina/bodega/nave industrial con GRILLAS reales de
 * luminarias. Ver `industrialScaleFixtures.ts` para las limitaciones
 * declaradas de fotometría (ópticas escaladas, no un high-bay real) y de
 * costo computacional (`oracleSpacing` propio, más grueso que la malla real
 * de producción, solo para no convertir minutos en horas).
 *
 * Mismo criterio que el resto de esta carpeta: se salta sin
 * `RADIANCE_BIN_DIR`, ninguna aserción decide "qué modo gana",
 * `maintenanceFactor: 1` en las tres ramas de interreflexión (ver el bug
 * corregido en Ronda 23 de `plan_cierre_brecha_paridad_dialux_evo.md` —
 * comparar contra el oráculo "como nuevo" con el 0.8 de producción puesto
 * solo en `first-bounce`/`iterative` sub-reportaría esos dos modos ~20%).
 */
const hasRadiance = isRadianceAvailable();
const TEST_TIMEOUT_MS = 1_800_000;
const ORACLE_TIMEOUT_MS = 1_500_000;

function buildProjectForFixture(fixture: IndustrialScaleFixture): Project {
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

async function computeEngineAvgLux(fixture: IndustrialScaleFixture, interreflection: 'none' | 'first-bounce' | 'iterative'): Promise<{ avg: number; uo: number }> {
    const project = buildProjectForFixture(fixture);
    const base = buildProductionCalculationConfig(project);
    const config: CalculationConfig =
        interreflection === 'iterative'
            ? { ...base, interreflection, maxBounces: 30, convergenceTolerance: 1e-6, maintenanceFactor: 1 }
            : { ...base, interreflection, maintenanceFactor: 1 };
    const { resultsByRoom } = await runProjectLightingCalculation(project, config);
    const result = Object.values(resultsByRoom)[0]!;
    return { avg: result.avg_lux, uo: result.uniformity };
}

function relativeError(computed: number, reference: number): number {
    return Math.abs(computed - reference) / reference;
}

function resolveRealMesh(fixture: IndustrialScaleFixture): { spacingM: number; marginalZone: number } {
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(fixture.room);
    const { spacingM, marginalZoneOverride } = resolveMeshSpacing(fixture.room, fixture.fixtures, usefulPlaneHeight, [], {
        gridSpacingM: GRID_SPACING,
        adaptive: true,
    });
    return { spacingM, marginalZone: marginalZoneOverride ?? fixture.marginalZone };
}

describe.skipIf(!hasRadiance)('Oráculo Radiance — matriz de escala (oficina/bodega/nave industrial/ambiente libre, §7 del plan de precisión)', () => {
    it.each(buildAllIndustrialScaleFixtures())(
        '$id ($label): first-bounce vs. iterative vs. Radiance (informativo, validación de escala)',
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
                    provenanceNote: `oráculo Radiance — matriz de escala, ${fixture.variesFrom_previous}`,
                })),
                // Espaciado del ORÁCULO, propio del fixture (más grueso en
                // bodega/nave que la malla real de producción) — ver
                // doc-comment de `oracleSpacing` en `industrialScaleFixtures.ts`.
                spacing: fixture.oracleSpacing,
                timeoutMs: ORACLE_TIMEOUT_MS,
            });

            const errorEngineDirectVsRadiance = relativeError(engineDirect.avg, oracle.directLux);
            const errorFirstBounceVsRadiance = relativeError(engineFirstBounce.avg, oracle.fullReflectionLux);
            const errorIterativeVsRadiance = relativeError(engineIterative.avg, oracle.fullReflectionLux);

            // eslint-disable-next-line no-console
            console.log(
                `[radiance-scale] ${fixture.id} (${fixture.variesFrom_previous}): malla real=${realMesh.spacingM.toFixed(3)} m, oráculo=${fixture.oracleSpacing} m, sensores=${oracle.sensorCount}\n` +
                    `  directo motor=${engineDirect.avg.toFixed(1)} lx · directo Radiance=${oracle.directLux.toFixed(1)} lx (error ${(errorEngineDirectVsRadiance * 100).toFixed(1)}%)\n` +
                    `  first-bounce=${engineFirstBounce.avg.toFixed(1)} lx (Uo=${engineFirstBounce.uo.toFixed(2)}) · iterative=${engineIterative.avg.toFixed(1)} lx (Uo=${engineIterative.uo.toFixed(2)}) · Radiance radiosidad completa=${oracle.fullReflectionLux.toFixed(1)} lx\n` +
                    `  Δ(first-bounce, Radiance)=${(errorFirstBounceVsRadiance * 100).toFixed(1)}% · Δ(iterative, Radiance)=${(errorIterativeVsRadiance * 100).toFixed(1)}%`,
            );

            // Validación de montaje únicamente (geometría/IES/malla bien
            // armados a esta escala) — sin esto, un error de escala/unidades
            // en una nave de cientos de m² pasaría desapercibido durante
            // minutos de cómputo antes de fallar en otra parte.
            expect(errorEngineDirectVsRadiance).toBeLessThan(0.2);
            expect(Number.isFinite(errorFirstBounceVsRadiance)).toBe(true);
            expect(Number.isFinite(errorIterativeVsRadiance)).toBe(true);
        },
        TEST_TIMEOUT_MS,
    );
});
