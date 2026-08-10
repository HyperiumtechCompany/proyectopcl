import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
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
    grid: { columns: number; rows: number };
    /** Ronda 6: resultado de referencia ya registrado (crudo, sin factor de mantenimiento), para detectar una regresión grande sin tener que re-verificar convergencia cada vez. */
    knownFullReflectionLux: number;
}

function bboxSize(room: Room): { width: number; depth: number } {
    const xs = room.vertices.map((v) => v.x);
    const ys = room.vertices.map((v) => v.y);
    return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

function fixtureConfigs(): FixtureRadianceConfig[] {
    const sshh = buildSsHhVsBanoFixture();
    const caseta = buildCasetaVsGuarderiasFixture();
    return [
        { fixture: sshh, ...bboxSize(sshh.room), grid: { columns: 7, rows: 3 }, knownFullReflectionLux: 160.5 },
        { fixture: caseta, ...bboxSize(caseta.room), grid: { columns: 5, rows: 5 }, knownFullReflectionLux: 170.9 },
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
                    marginalZone: config.fixture.room.marginalZone ?? 0.1,
                    reflectance: config.fixture.reflectance,
                },
                fixtures: config.fixture.fixtures.map((fixture) => ({
                    fixture,
                    label: fixture.name,
                    manufacturer: fixture.brand ?? 'desconocido',
                    articleNumber: fixture.articleNumber ?? 'desconocido',
                    provenanceNote: `oráculo Radiance — ${config.fixture.referenceSource}`,
                })),
                grid: config.grid,
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
            // posición, malla) esté razonablemente bien armado, no que ambos
            // motores usen exactamente la misma malla — ver Ronda 6
            // (1.9%/4.7% medidos en la validación original).
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
