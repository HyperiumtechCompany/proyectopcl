import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildSsHhVsBanoFixture } from '../fixtures';
import { runRadianceOracle } from './runRadianceOracle';

/**
 * Ronda de investigación (2026-08-19): aísla la ALTURA como única variable
 * entre dos casos reales que dieron veredictos opuestos sobre qué modo de
 * interreflexión se acerca más a la realidad con el mismo aspecto de piso
 * (~2.3-2.4:1):
 *   - Proyecto real "Módulo 22", SS.HH: altura 4.67 m → `iterative`
 *     sobreestima 37-43% frente a lo que reportó DIALux evo (`first-bounce`
 *     es mejor ahí).
 *   - Benchmark `sshh-vs-bano` (fotometría real TEG18046): altura 3.5 m →
 *     `iterative` da mucho menos error que `first-bounce` frente al oráculo
 *     Radiance (radiosidad física independiente).
 *
 * Se corrió la MISMA geometría de piso/fotometría/reflectancia de
 * `sshh-vs-bano` a dos alturas (3.5 m y 4.67 m, luminaria siempre al techo),
 * contra Radiance como árbitro físico independiente de ambos modos.
 *
 * RESULTADO: la altura NO explica la contradicción. `iterative` gana
 * claramente en AMBAS alturas para esta geometría (ver constantes de abajo,
 * medidas contra Radiance real) — la hipótesis de que la altura era el
 * factor de confusión entre los dos casos queda DESCARTADA, no confirmada.
 * La contradicción con Módulo 22 sigue abierta; candidatos que quedan sin
 * investigar: el patrón real de haz de la luminaria de Módulo 22 (distinta
 * de TEG18046), o que comparar contra el PDF de DIALux evo (caja negra) no
 * tiene el mismo rigor que comparar contra un solver físico independiente
 * como Radiance — no se puede saber si DIALux evo mismo se parece más a
 * `first-bounce` o a `iterative` sin acceso a su código.
 *
 * Se deja como test permanente (no se borra) — mismo criterio que
 * `radianceOracle.test.ts`: un hallazgo real medido contra Radiance, no un
 * script de depuración descartable.
 */
const hasRadiance = Boolean(process.env.RADIANCE_BIN_DIR);
const TEST_TIMEOUT_MS = 420_000;

function buildRoomAtHeight(height: number): { room: Room; fixtureZ: number } {
    const base = buildSsHhVsBanoFixture();
    const room: Room = { ...base.room, height };
    return { room, fixtureZ: height };
}

async function computeEngineAverages(height: number): Promise<{ firstBounce: number; iterative: number }> {
    const base = buildSsHhVsBanoFixture();
    const { room } = buildRoomAtHeight(height);
    const fixtures = base.fixtures.map((f) => ({ ...f, z: height }));
    const roomWithReflectance: Room = {
        ...room,
        ceilingReflectance: base.reflectance.ceiling,
        wallReflectance: base.reflectance.wall,
        floorReflectance: base.reflectance.floor,
    };
    const scene: Scene = {
        id: `height-sweep-${height}-scene`,
        name: 'n',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: height,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'm', calibrationFactor: 1, isCalibrated: true },
        rooms: [roomWithReflectance],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures,
        lightSwitches: [],
        partitions: [],
    };
    const project: Project = { id: `height-sweep-${height}-project`, name: 'height-sweep', created_at: '', updated_at: '', scenes: [scene] };

    const firstBounceRun = await runProjectLightingCalculation(project, {
        ...buildProductionCalculationConfig(project),
        interreflection: 'first-bounce',
    });
    const iterativeRun = await runProjectLightingCalculation(project, {
        ...buildProductionCalculationConfig(project),
        interreflection: 'iterative',
        maxBounces: 30,
        convergenceTolerance: 1e-6,
    });

    return {
        firstBounce: Object.values(firstBounceRun.resultsByRoom)[0]!.avg_lux,
        iterative: Object.values(iterativeRun.resultsByRoom)[0]!.avg_lux,
    };
}

async function computeRadianceFullReflection(height: number): Promise<number> {
    const base = buildSsHhVsBanoFixture();
    const { room, fixtureZ } = buildRoomAtHeight(height);
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const { spacingM, marginalZoneOverride } = resolveMeshSpacing(room, base.fixtures, usefulPlaneHeight, [], {
        gridSpacingM: GRID_SPACING,
        adaptive: true,
    });
    const marginalZone = marginalZoneOverride ?? room.marginalZone ?? 0.1;

    const xs = room.vertices.map((v) => v.x);
    const ys = room.vertices.map((v) => v.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);

    const fixtures = base.fixtures.map((f) => ({ ...f, z: fixtureZ }));

    const oracle = await runRadianceOracle({
        room: {
            width,
            depth,
            height,
            workingPlaneHeight: usefulPlaneHeight,
            marginalZone,
            reflectance: base.reflectance,
        },
        fixtures: fixtures.map((fixture) => ({
            fixture,
            label: fixture.name,
            manufacturer: fixture.brand ?? 'desconocido',
            articleNumber: fixture.articleNumber ?? 'desconocido',
            provenanceNote: `height-sweep-experiment altura=${height}`,
        })),
        spacing: spacingM,
    });

    return oracle.fullReflectionLux;
}

/** Valores registrados 2026-08-19 contra Radiance real — ver el comentario de arriba del archivo. */
const KNOWN_RESULTS = {
    3.5: { radiance: 164.0, firstBounce: 120.0, iterative: 151.5 },
    4.67: { radiance: 98.5, firstBounce: 70.5, iterative: 88.1 },
} as const;

describe.skipIf(!hasRadiance)('Experimento: altura como variable aislada (sshh-vs-bano, 3.5m vs 4.67m)', () => {
    it.each([3.5, 4.67] as const)(
        'altura %sm: iterative se acerca más a Radiance que first-bounce (la altura NO explica la contradicción con Módulo 22)',
        async (height) => {
            const [radiance, engine] = await Promise.all([computeRadianceFullReflection(height), computeEngineAverages(height)]);
            const errorFirstBounce = Math.abs(engine.firstBounce - radiance) / radiance;
            const errorIterative = Math.abs(engine.iterative - radiance) / radiance;

            // eslint-disable-next-line no-console
            console.log(
                `[height-sweep h=${height}] Radiance=${radiance.toFixed(1)} lx · first-bounce=${engine.firstBounce.toFixed(1)} lx (${(errorFirstBounce * 100).toFixed(1)}%) · iterative=${engine.iterative.toFixed(1)} lx (${(errorIterative * 100).toFixed(1)}%)`,
            );

            // Cota generosa (15%): detecta una regresión grande frente al
            // valor ya registrado contra Radiance, no una tolerancia de
            // precisión física — mismo criterio que `radianceOracle.test.ts`.
            const known = KNOWN_RESULTS[height];
            expect(Math.abs(radiance - known.radiance) / known.radiance).toBeLessThan(0.15);

            // El hallazgo real de esta ronda: iterative gana en AMBAS
            // alturas para esta geometría — no es un umbral de precisión,
            // es la comparación directa que responde la pregunta de la
            // investigación.
            expect(errorIterative).toBeLessThan(errorFirstBounce);
        },
        TEST_TIMEOUT_MS,
    );
});
