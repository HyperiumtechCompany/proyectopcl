import { describe, expect, it } from 'vitest';
import { buildModulo22Project } from '@/pages/dialux/domain/calculation/__fixtures__/modulo22ProjectFixture';
import { buildCalculationSnapshot } from '@/pages/dialux/domain/calculation/buildCalculationSnapshot';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runDirectPreviewEngine } from '@/pages/dialux/domain/calculation/runDirectPreviewEngine';
import type { CalculationConfig } from '@/pages/dialux/domain/calculation/types';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomMarginalZone, getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import { isRadianceAvailable, runRadianceOracleForPolygon } from './runRadianceOracle';

/**
 * Experimento decisivo §2 de `planes/plan_precision_fisica_motor_dialux_vs_evo.md`:
 * hasta ahora NINGÚN test de este repositorio había corrido el oráculo
 * Radiance sobre la geometría/fotometría/reflectancia REAL de un ambiente que
 * también tiene un PDF real de DIALux evo — `radianceOracle*.test.ts` usa
 * geometría real pero SIN referencia de DIALux evo (Rondas 6/13/21/22), y
 * `dialuxEvoParity.test.ts` usa referencia de DIALux evo pero geometría
 * rectangular reconstruida a mano desde el PDF, no la geometría real
 * derivada por `deriveSceneAmsbientSpaces` (paredes con muesca de jamba,
 * 10 vértices reales). Este test triangula los tres vértices —motor propio,
 * Radiance, DIALux evo real— sobre el MISMO problema físico exacto:
 * el ambiente "SS.HH" del proyecto real "Módulo 22"
 * (`modulo22ProjectFixture.ts`), aspecto angosto (2.18 m², altura 4.67 m),
 * exactamente el tipo de recinto donde Ronda 22 dejó abierta la contradicción
 * first-bounce/iterative sin poder resolverla (usó un proxy sintético, nunca
 * la geometría real de este ambiente).
 *
 * Referencia DIALux evo real para "SS.HH" (`modulo22GoldenCase.test.ts`):
 * Ē=206 lx, Uo=0.88, RUG,max=22.
 *
 * Se salta automáticamente sin `RADIANCE_BIN_DIR` (mismo criterio que el
 * resto de esta carpeta) — nunca falla por falta de instalación. Ninguna
 * aserción decide "qué modo gana": el objetivo es dejar el número
 * registrado, igual que el resto del oráculo.
 */
const hasRadiance = isRadianceAvailable();
const TEST_TIMEOUT_MS = 900_000;
const ORACLE_TIMEOUT_MS = 780_000;

const EVO_REFERENCE = { avgLux: 206, uniformity: 0.88 };

function findSsHhAmbient() {
    const project = buildModulo22Project();
    const scene = project.scenes[0]!;
    const ambients = deriveSceneAmbientSpaces(scene);
    const ambient = ambients.find((a) => a.name === 'SS.HH');
    if (!ambient) {
        throw new Error('No se encontró el ambiente "SS.HH" en el proyecto real Módulo 22 — la derivación de ambientes pudo cambiar.');
    }
    return { project, ambient };
}

/**
 * `maintenanceFactor: 1` en LAS TRES ramas — el oráculo Radiance reporta
 * valores "como nuevo" (no conoce el factor de mantenimiento), así que
 * comparar `first-bounce`/`iterative` con el 0.8 de
 * `DEFAULT_DIRECT_PREVIEW_CONFIG` (Módulo 22 no declara `siteSettings`)
 * contra el oráculo sub-reportaría esos dos modos ~20% de forma sistemática
 * — el mismo bug ya corregido en `radianceOracleShapeVariation.test.ts`/
 * `radianceOraclePolygonShapes.test.ts` (ver sus doc-comments). Con este
 * fix: `first-bounce`=215.4 lx, `iterative`=240.9 lx para "SS.HH" — SIN el
 * fix daban 172.4/192.7 lx, que invertía la conclusión sobre qué modo queda
 * más cerca de DIALux evo (ver interpretación en el `console.log` de abajo).
 */
async function computeEngineAvgLux(interreflection: 'none' | 'first-bounce' | 'iterative'): Promise<{ avg: number; uo: number }> {
    const { project } = findSsHhAmbient();
    const snapshot = buildCalculationSnapshot(project);
    const objectId = snapshot.calculationObjects.find((o) => o.name === 'SS.HH')!.id;
    const base = buildProductionCalculationConfig(project);
    const config: CalculationConfig =
        interreflection === 'iterative'
            ? { ...base, interreflection, maxBounces: 30, convergenceTolerance: 1e-6, maintenanceFactor: 1 }
            : { ...base, interreflection, maintenanceFactor: 1 };
    const run = await runDirectPreviewEngine(snapshot, config);
    const surface = run.surfaces.find((s) => s.objectId === objectId)!;
    return { avg: surface.result.avg_lux, uo: surface.result.uniformity };
}

function relativeError(computed: number, reference: number): number {
    return Math.abs(computed - reference) / reference;
}

describe.skipIf(!hasRadiance)('Oráculo Radiance — caso real "SS.HH" de Módulo 22, triangulado contra DIALux evo (§2 del plan de precisión)', () => {
    it(
        'motor propio (directo/first-bounce/iterative) vs. Radiance (radiosidad completa) vs. DIALux evo real',
        async () => {
            const { ambient } = findSsHhAmbient();
            const room = ambient.room;
            const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
            const { spacingM, marginalZoneOverride } = resolveMeshSpacing(room, ambient.fixtures, usefulPlaneHeight, [], {
                gridSpacingM: GRID_SPACING,
                adaptive: true,
            });
            const marginalZone = marginalZoneOverride ?? getRoomMarginalZone(room);

            const [engineDirect, engineFirstBounce, engineIterative] = await Promise.all([
                computeEngineAvgLux('none'),
                computeEngineAvgLux('first-bounce'),
                computeEngineAvgLux('iterative'),
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
                fixtures: ambient.fixtures.map((f) => ({
                    fixture: f,
                    label: f.name,
                    manufacturer: f.brand ?? 'desconocido',
                    articleNumber: f.articleNumber ?? 'desconocido',
                    provenanceNote: 'caso real Módulo 22 — ambiente "SS.HH", geometría derivada por deriveSceneAmbientSpaces (no reconstruida a mano)',
                })),
                spacing: spacingM,
                timeoutMs: ORACLE_TIMEOUT_MS,
            });

            const errorEvoVsRadianceDirect = relativeError(oracle.directLux, EVO_REFERENCE.avgLux);
            const errorEvoVsRadianceFull = relativeError(oracle.fullReflectionLux, EVO_REFERENCE.avgLux);
            const errorEngineDirectVsRadiance = relativeError(engineDirect.avg, oracle.directLux);
            const errorFirstBounceVsRadiance = relativeError(engineFirstBounce.avg, oracle.fullReflectionLux);
            const errorIterativeVsRadiance = relativeError(engineIterative.avg, oracle.fullReflectionLux);
            const errorFirstBounceVsEvo = relativeError(engineFirstBounce.avg, EVO_REFERENCE.avgLux);
            const errorIterativeVsEvo = relativeError(engineIterative.avg, EVO_REFERENCE.avgLux);

            // eslint-disable-next-line no-console
            console.log(
                `\n[triangulación SS.HH Módulo 22 — §2 plan_precision_fisica_motor_dialux_vs_evo.md]\n` +
                    `  malla real: spacing=${spacingM.toFixed(3)} m, zona marginal=${marginalZone.toFixed(3)} m\n` +
                    `  DIALux evo real:        Ē=${EVO_REFERENCE.avgLux} lx, Uo=${EVO_REFERENCE.uniformity}\n` +
                    `  motor directo:           Ē=${engineDirect.avg.toFixed(1)} lx, Uo=${engineDirect.uo.toFixed(2)}\n` +
                    `  motor first-bounce:      Ē=${engineFirstBounce.avg.toFixed(1)} lx (Δevo ${(errorFirstBounceVsEvo * 100).toFixed(1)}%), Uo=${engineFirstBounce.uo.toFixed(2)}\n` +
                    `  motor iterative:         Ē=${engineIterative.avg.toFixed(1)} lx (Δevo ${(errorIterativeVsEvo * 100).toFixed(1)}%), Uo=${engineIterative.uo.toFixed(2)}\n` +
                    `  Radiance directo:        ${oracle.directLux.toFixed(1)} lx (Δevo ${(errorEvoVsRadianceDirect * 100).toFixed(1)}%, Δmotor-directo ${(errorEngineDirectVsRadiance * 100).toFixed(1)}%)\n` +
                    `  Radiance radiosidad completa: ${oracle.fullReflectionLux.toFixed(1)} lx (Δevo ${(errorEvoVsRadianceFull * 100).toFixed(1)}%)\n` +
                    `  Δ(first-bounce, Radiance)=${(errorFirstBounceVsRadiance * 100).toFixed(1)}% · Δ(iterative, Radiance)=${(errorIterativeVsRadiance * 100).toFixed(1)}%\n` +
                    `  sensores=${oracle.sensorCount}\n` +
                    `  INTERPRETACIÓN (criterio de decisión §2 del plan):\n` +
                    `    - si Radiance≈evo (${(errorEvoVsRadianceFull * 100).toFixed(1)}% pequeño) → DIALux evo es físicamente correcto aquí; revisar el solver de radiosidad de parches de raíz.\n` +
                    `    - si Radiance≈motor propio (iterative/first-bounce cerca de Radiance) → DIALux evo subestima/sobreestima la interreflexión en este tipo de recinto angosto; no perseguir ese número.\n`,
            );

            // Validación de montaje: la luz DIRECTA (sin interreflexión, sin
            // ambigüedad de método) debe coincidir razonablemente entre el
            // motor propio y Radiance — si esto falla, la escena/geometría/IES
            // está mal armada, no es un hallazgo de interreflexión.
            expect(errorEngineDirectVsRadiance).toBeLessThan(0.15);
            expect(Number.isFinite(errorFirstBounceVsRadiance)).toBe(true);
            expect(Number.isFinite(errorIterativeVsRadiance)).toBe(true);
        },
        TEST_TIMEOUT_MS,
    );
});
