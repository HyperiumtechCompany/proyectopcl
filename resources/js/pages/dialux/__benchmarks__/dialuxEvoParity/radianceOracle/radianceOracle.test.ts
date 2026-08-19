import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildCasetaVsGuarderiasFixture, buildSsHhVsBanoFixture, type DialuxEvoParityFixture } from '../fixtures';
import { runRadianceOracle } from './runRadianceOracle';

/**
 * Integración con el oráculo de validación Radiance —
 * `planes/plan_cierre_brecha_paridad_dialux_evo.md` §-6. Requiere Radiance
 * instalado localmente (ver `README.md` de esta carpeta) — se SALTA
 * automáticamente si `RADIANCE_BIN_DIR` no está configurada, nunca falla
 * por eso. Correr con:
 *
 *   RADIANCE_BIN_DIR=/ruta/a/radiance/bin npx vitest run resources/js/pages/dialux/__benchmarks__/dialuxEvoParity/radianceOracle
 *
 * Cada caso puede tardar 1-3 minutos reales (la corrida con reflexión
 * completa de Radiance es deliberadamente más lenta que el motor propio,
 * que calcula en milisegundos) — `TEST_TIMEOUT_MS` está fijado holgado a
 * propósito, no es un valor a "optimizar".
 */
const hasRadiance = Boolean(process.env.RADIANCE_BIN_DIR);
// Debe ser mayor que `runRadianceOracle`'s `timeoutMs` interno (default
// 360000 ms) — si no, Vitest podría reportar timeout de test ANTES de que
// el propio oráculo tenga oportunidad de fallar con un mensaje más claro.
const TEST_TIMEOUT_MS = 420_000;

interface FixtureRadianceConfig {
    fixture: DialuxEvoParityFixture;
    width: number;
    depth: number;
    /**
     * Espaciado de sensores, en metros. Ronda 21b: NO es un valor fijo — se
     * deriva con `resolveMeshSpacing()`, la MISMA función que
     * `buildProductionCalculationConfig()` usa en producción
     * (`meshPolicy.adaptive: true`, ver `hooks/adaptiveGridSpacing.ts`).
     * Asumir `GRID_SPACING` (0.5 m) fijo — como hacía la primera versión de
     * esta ronda — subestimaba drásticamente cuánto refina la malla real
     * para un recinto con un solo foco concentrado (ej. "caseta-vs-
     * guarderias": 0.5 asumido vs. 0.382 real; "large-square": 0.5 asumido
     * vs. 0.1 real, el piso mínimo).
     */
    spacing: number;
    /**
     * Zona marginal real, en metros. Bajo `meshPolicy.adaptive`, producción
     * NUNCA usa `room.marginalZone` tal cual — la SOBRESCRIBE con
     * `spacingM / 2` (`resolveMeshSpacing`, salvo recintos tipo pasillo,
     * donde es 0). Usar el valor declarado del fixture aquí sería, de nuevo,
     * comparar el oráculo contra un conjunto de sensores que el motor real
     * nunca usó.
     */
    marginalZone: number;
    /** Ronda 21b: resultado de referencia re-medido con espaciado/zona marginal REALES (adaptativos) — reemplaza el valor de la Ronda 6 (160.5/170.9) y el de la Ronda 21a (espaciado fijo 0.5), ninguno de los dos coincidía con lo que el motor de producción realmente usa. */
    knownFullReflectionLux: number;
}

function bboxSize(room: Room): { width: number; depth: number } {
    const xs = room.vertices.map((v) => v.x);
    const ys = room.vertices.map((v) => v.y);
    return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

/** Misma resolución que usaría `runDirectPreviewEngine.ts` para este recinto — sin obstáculos (ningún fixture de este benchmark los declara). */
function resolveRealMesh(room: Room, fixture: DialuxEvoParityFixture): { spacingM: number; marginalZone: number } {
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const { spacingM, marginalZoneOverride } = resolveMeshSpacing(room, fixture.fixtures, usefulPlaneHeight, [], {
        gridSpacingM: GRID_SPACING,
        adaptive: true,
    });
    return { spacingM, marginalZone: marginalZoneOverride ?? room.marginalZone ?? 0.1 };
}

function fixtureConfigs(): FixtureRadianceConfig[] {
    const sshh = buildSsHhVsBanoFixture();
    const caseta = buildCasetaVsGuarderiasFixture();
    const sshhMesh = resolveRealMesh(sshh.room, sshh);
    const casetaMesh = resolveRealMesh(caseta.room, caseta);
    return [
        { fixture: sshh, ...bboxSize(sshh.room), spacing: sshhMesh.spacingM, marginalZone: sshhMesh.marginalZone, knownFullReflectionLux: 164.0 },
        // Re-medido 2026-08-19: el 163.9 de la Ronda 21b quedó obsoleto el
        // 2026-08-18, cuando `caseta-vs-guarderias` pasó a usar fotometría
        // real de fábrica (`GF19140_SUBSTITUTE_PHOTOMETRIC_WEB`, ver
        // `fixtures.ts`) en vez de la aproximación Lambertiana con la que se
        // midió 163.9 — el cambio de dato de entrada, no una inestabilidad
        // del oráculo, explica la diferencia (confirmado: el chequeo de luz
        // directa motor-vs-Radiance de ESTE mismo run coincidió al 0.5%).
        { fixture: caseta, ...bboxSize(caseta.room), spacing: casetaMesh.spacingM, marginalZone: casetaMesh.marginalZone, knownFullReflectionLux: 275.6 },
    ];
}

async function computeEngineDirectLux(fixture: DialuxEvoParityFixture): Promise<number> {
    const room: Room = {
        ...fixture.room,
        ceilingReflectance: fixture.reflectance.ceiling,
        wallReflectance: fixture.reflectance.wall,
        floorReflectance: fixture.reflectance.floor,
    };
    const scene: Scene = {
        id: `${fixture.id}-radiance-scene`,
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
    const project: Project = { id: `${fixture.id}-radiance-project`, name: fixture.label, created_at: '', updated_at: '', scenes: [scene] };
    const config = { ...buildProductionCalculationConfig(project), interreflection: 'none' as const, maintenanceFactor: 1 };
    const { resultsByRoom } = await runProjectLightingCalculation(project, config);
    return Object.values(resultsByRoom)[0]!.avg_lux;
}

describe.skipIf(!hasRadiance)('Oráculo de validación Radiance (requiere RADIANCE_BIN_DIR)', () => {
    it.each(fixtureConfigs())(
        '$fixture.id: valida el montaje (directo vs. motor propio) y reporta el resultado con reflexión completa',
        async (config) => {
            const engineDirect = await computeEngineDirectLux(config.fixture);
            const oracle = await runRadianceOracle({
                room: {
                    width: config.width,
                    depth: config.depth,
                    height: config.fixture.room.height,
                    workingPlaneHeight: config.fixture.room.usefulPlaneHeight ?? 0,
                    marginalZone: config.marginalZone,
                    reflectance: config.fixture.reflectance,
                },
                fixtures: config.fixture.fixtures.map((fixture) => ({
                    fixture,
                    label: fixture.name,
                    manufacturer: fixture.brand ?? 'desconocido',
                    articleNumber: fixture.articleNumber ?? 'desconocido',
                    provenanceNote: `oráculo Radiance — ${config.fixture.referenceSource}`,
                })),
                spacing: config.spacing,
            });

            const directRelativeError = Math.abs(oracle.directLux - engineDirect) / engineDirect;
            const fullReflectionRelativeChange = Math.abs(oracle.fullReflectionLux - config.knownFullReflectionLux) / config.knownFullReflectionLux;

            // eslint-disable-next-line no-console
            console.log(
                `[radiance-oracle] ${config.fixture.id}: directo motor=${engineDirect.toFixed(1)} lx · directo Radiance=${oracle.directLux.toFixed(1)} lx ` +
                    `(error ${(directRelativeError * 100).toFixed(1)}%) · con reflexión completa=${oracle.fullReflectionLux.toFixed(1)} lx ` +
                    `(registrado en Ronda 6: ${config.knownFullReflectionLux} lx) · referencia DIALux evo=${config.fixture.reference.avgLux} lx`,
            );

            // Cota generosa (10%): valida que el montaje de la escena (IES,
            // posición) esté razonablemente bien armado. Desde la Ronda 21
            // el oráculo SÍ usa exactamente la misma malla que el motor real
            // (`generateSensorGrid` delega en `generatePolygonSensorGrid`,
            // que replica `buildGrid()`), así que el residual esperado aquí
            // es menor que en la validación original de la Ronda 6
            // (1.9%/4.7%, medida con una malla distinta a la de producción).
            expect(directRelativeError).toBeLessThan(0.1);

            // Cota MUY generosa (25%): solo para detectar una regresión
            // grande (ej. un cambio accidental en la geometría/reflectancia
            // de los fixtures que invalide el número ya registrado) — no es
            // una tolerancia de precisión física, esa discusión vive en el
            // plan.
            expect(fullReflectionRelativeChange).toBeLessThan(0.25);
        },
        TEST_TIMEOUT_MS,
    );
});
