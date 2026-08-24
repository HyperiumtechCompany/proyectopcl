import { describe, expect, it } from 'vitest';
import { buildModulo22Project } from '@/pages/dialux/domain/calculation/__fixtures__/modulo22ProjectFixture';
import { buildVinchosProject } from '@/pages/dialux/domain/calculation/__fixtures__/vinchosProjectFixture';
import { buildCalculationSnapshot } from '@/pages/dialux/domain/calculation/buildCalculationSnapshot';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runDirectPreviewEngine } from '@/pages/dialux/domain/calculation/runDirectPreviewEngine';
import type { CalculationConfig } from '@/pages/dialux/domain/calculation/types';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import { deriveSceneAmbientSpaces, type DerivedAmbientSpace } from '@/pages/dialux/hooks/ambientSpaces';
import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomMarginalZone, getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import type { Fixture, Project } from '@/pages/dialux/hooks/types';
import { isRadianceAvailable, runRadianceOracleForPolygon } from './runRadianceOracle';

/**
 * Continuación de `modulo22RealCase.test.ts` — el usuario pidió
 * explícitamente "confirmar el patrón primero" antes de tocar cualquier
 * default de producción: el caso "SS.HH" (N=1) mostró que DIALux evo puede
 * quedar más lejos de la física real (Radiance) que el propio motor en modo
 * `iterative`, invirtiendo la asunción de que "más parecido a DIALux evo" y
 * "físicamente correcto" son la misma dirección. Este archivo replica la
 * MISMA triangulación (motor propio / Radiance / DIALux evo real) sobre 3
 * casos reales más, con aspectos de recinto DISTINTOS al SS.HH angosto
 * (2.4:1): "Caseta de Control" (Módulo 22, ~1:1) y "Aula 1°"/"Aula 2°"
 * (Vinchos, ~1:1, ~43 m² — mucho más grande que cualquier caso previo con
 * fotometría real de este oráculo).
 *
 * Igual criterio que el resto de esta carpeta: se salta sin
 * `RADIANCE_BIN_DIR`, `maintenanceFactor: 1` en las tres ramas (ver bug
 * corregido en Ronda 23 de `plan_cierre_brecha_paridad_dialux_evo.md`),
 * ninguna aserción decide "qué modo gana".
 */
const hasRadiance = isRadianceAvailable();
const TEST_TIMEOUT_MS = 1_800_000;
const ORACLE_TIMEOUT_MS = 1_500_000;

interface RealCase {
    id: string;
    buildProject: () => Project;
    findAmbient: (ambients: DerivedAmbientSpace[]) => DerivedAmbientSpace;
    reference: { avgLux: number; uniformity: number };
    /** Espaciado de sensores del ORÁCULO (m) — desacoplado de la malla real de producción, ver `industrialScaleFixtures.ts::oracleSpacing`. */
    oracleSpacing: number;
}

const REAL_CASES: RealCase[] = [
    {
        id: 'caseta-de-control-modulo22',
        buildProject: buildModulo22Project,
        findAmbient: (ambients) => ambients.find((a) => a.name === 'Caseta de Control')!,
        // `modulo22GoldenCase.test.ts`: Ē=203 lx, Uo=0.87.
        reference: { avgLux: 203, uniformity: 0.87 },
        oracleSpacing: GRID_SPACING,
    },
    {
        id: 'aula-1-vinchos',
        buildProject: buildVinchosProject,
        // Ambos ambientes derivados se llaman "Guarderías" (ver doc-comment
        // de `vinchosProjectFixture.ts`) — se distinguen por área: Aula 1°
        // (43.80 m²) vs. Aula 2° (42.71 m²).
        findAmbient: (ambients) => {
            const guarderias = ambients.filter((a) => a.name === 'Guarderías');
            return guarderias.reduce((closest, current) =>
                Math.abs(polygonAreaM2(current.room.vertices) - 43.8) < Math.abs(polygonAreaM2(closest.room.vertices) - 43.8) ? current : closest,
            );
        },
        // `vinchosProjectFixture.ts`: Aula 1° (43.80 m²): Ē=544 lx, Uo(g1)=0.51.
        reference: { avgLux: 544, uniformity: 0.51 },
        oracleSpacing: 1.2,
    },
    {
        id: 'aula-2-vinchos',
        buildProject: buildVinchosProject,
        findAmbient: (ambients) => {
            const guarderias = ambients.filter((a) => a.name === 'Guarderías');
            return guarderias.reduce((closest, current) =>
                Math.abs(polygonAreaM2(current.room.vertices) - 42.71) < Math.abs(polygonAreaM2(closest.room.vertices) - 42.71) ? current : closest,
            );
        },
        // `vinchosProjectFixture.ts`: Aula 2° (42.71 m²): Ē=567 lx, Uo(g1)=0.53.
        reference: { avgLux: 567, uniformity: 0.53 },
        oracleSpacing: 1.2,
    },
];

function relativeError(computed: number, reference: number): number {
    return Math.abs(computed - reference) / reference;
}

describe.skipIf(!hasRadiance)('Oráculo Radiance — triangulación multi-caso real (confirmación del patrón de la Ronda 23)', () => {
    it.each(REAL_CASES)(
        '$id: motor propio vs. Radiance vs. DIALux evo real',
        async (testCase) => {
            const project = testCase.buildProject();
            const scene = project.scenes[0]!;
            const ambients = deriveSceneAmbientSpaces(scene);
            const ambient = testCase.findAmbient(ambients);
            const room = ambient.room;
            const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
            const { spacingM, marginalZoneOverride } = resolveMeshSpacing(room, ambient.fixtures, usefulPlaneHeight, [], {
                gridSpacingM: GRID_SPACING,
                adaptive: true,
            });
            const marginalZone = marginalZoneOverride ?? getRoomMarginalZone(room);

            const snapshot = buildCalculationSnapshot(project);
            const objectId = snapshot.calculationObjects.find((o) => o.id === ambient.id)!.id;
            const base = buildProductionCalculationConfig(project);

            async function computeEngine(interreflection: 'none' | 'first-bounce' | 'iterative') {
                const config: CalculationConfig =
                    interreflection === 'iterative'
                        ? { ...base, interreflection, maxBounces: 30, convergenceTolerance: 1e-6, maintenanceFactor: 1 }
                        : { ...base, interreflection, maintenanceFactor: 1 };
                const run = await runDirectPreviewEngine(snapshot, config);
                const surface = run.surfaces.find((s) => s.objectId === objectId)!;
                return { avg: surface.result.avg_lux, uo: surface.result.uniformity };
            }

            const [engineDirect, engineFirstBounce, engineIterative] = await Promise.all([
                computeEngine('none'),
                computeEngine('first-bounce'),
                computeEngine('iterative'),
            ]);

            const oracle = await runRadianceOracleForPolygon({
                room: {
                    vertices: room.vertices,
                    height: room.height,
                    workingPlaneHeight: usefulPlaneHeight,
                    marginalZone,
                    reflectance: {
                        ceiling: room.ceilingReflectance ?? 0,
                        wall: room.wallReflectance ?? 0,
                        floor: room.floorReflectance ?? 0,
                    },
                },
                fixtures: ambient.fixtures.map((f: Fixture) => ({
                    fixture: f,
                    label: f.name,
                    manufacturer: f.brand ?? 'desconocido',
                    articleNumber: f.articleNumber ?? 'desconocido',
                    provenanceNote: `triangulación multi-caso real — ${testCase.id}`,
                })),
                spacing: testCase.oracleSpacing,
                timeoutMs: ORACLE_TIMEOUT_MS,
            });

            const errorDirectVsRadiance = relativeError(engineDirect.avg, oracle.directLux);
            const errorEvoVsRadianceFull = relativeError(oracle.fullReflectionLux, testCase.reference.avgLux);
            const errorFirstBounceVsEvo = relativeError(engineFirstBounce.avg, testCase.reference.avgLux);
            const errorIterativeVsEvo = relativeError(engineIterative.avg, testCase.reference.avgLux);
            const errorFirstBounceVsRadiance = relativeError(engineFirstBounce.avg, oracle.fullReflectionLux);
            const errorIterativeVsRadiance = relativeError(engineIterative.avg, oracle.fullReflectionLux);

            // eslint-disable-next-line no-console
            console.log(
                `\n[triangulación multi-caso: ${testCase.id}] malla real=${spacingM.toFixed(3)} m (oráculo=${testCase.oracleSpacing} m), zona marginal=${marginalZone.toFixed(3)} m, sensores=${oracle.sensorCount}\n` +
                    `  DIALux evo real:        Ē=${testCase.reference.avgLux} lx, Uo=${testCase.reference.uniformity}\n` +
                    `  motor directo:           Ē=${engineDirect.avg.toFixed(1)} lx, Uo=${engineDirect.uo.toFixed(2)}\n` +
                    `  motor first-bounce:      Ē=${engineFirstBounce.avg.toFixed(1)} lx (Δevo ${(errorFirstBounceVsEvo * 100).toFixed(1)}%, Δradiance ${(errorFirstBounceVsRadiance * 100).toFixed(1)}%), Uo=${engineFirstBounce.uo.toFixed(2)}\n` +
                    `  motor iterative:         Ē=${engineIterative.avg.toFixed(1)} lx (Δevo ${(errorIterativeVsEvo * 100).toFixed(1)}%, Δradiance ${(errorIterativeVsRadiance * 100).toFixed(1)}%), Uo=${engineIterative.uo.toFixed(2)}\n` +
                    `  Radiance directo:        ${oracle.directLux.toFixed(1)} lx (Δmotor-directo ${(errorDirectVsRadiance * 100).toFixed(1)}%)\n` +
                    `  Radiance radiosidad completa: ${oracle.fullReflectionLux.toFixed(1)} lx (Δevo ${(errorEvoVsRadianceFull * 100).toFixed(1)}%)\n` +
                    `  ¿evo más cerca de Radiance que iterative? ${errorEvoVsRadianceFull < errorIterativeVsRadiance ? 'SÍ' : 'NO — evo queda más lejos de la física real que el motor'}`,
            );

            expect(errorDirectVsRadiance).toBeLessThan(0.2);
            expect(Number.isFinite(errorFirstBounceVsRadiance)).toBe(true);
            expect(Number.isFinite(errorIterativeVsRadiance)).toBe(true);
        },
        TEST_TIMEOUT_MS,
    );
});
