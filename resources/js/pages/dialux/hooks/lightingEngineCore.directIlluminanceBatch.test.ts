import { describe, expect, it } from 'vitest';
import type { DirectIlluminanceBatchKernel } from './directIlluminance';
import { calculateLightingResult, GRID_SPACING } from './lightingEngineCore';
import type { Fixture, Room } from './useEditorStore';

/**
 * Suite de la Fase 12 ("Rendimiento: Worker y WASM", plan maestro §11).
 * `directIlluminanceBatch` es el punto de inyección del kernel WASM
 * (`hooks/wasmDirectIlluminanceKernel.ts`, cargado por
 * `workers/dialuxCalculationWorker.ts`) — este archivo NUNCA importa WASM,
 * solo verifica el contrato del parámetro: default `undefined` reproduce
 * el bucle TS de siempre; un kernel inyectado reemplaza SOLO el término
 * directo, la componente reflejada/radiosidad sigue calculándose igual.
 */

function buildRoom(side = 4, height = 3): Room {
    return {
        id: 'direct-batch-room',
        name: 'Recinto de referencia — kernel por lotes',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: side, y: 0 },
            { x: side, y: side },
            { x: 0, y: side },
        ],
        height,
        color: '#000000',
        usefulPlaneHeight: 0.8,
    };
}

function buildFixture(x = 2, y = 2): Fixture {
    return {
        id: 'direct-batch-fixture',
        name: 'Luminaria de referencia',
        x,
        y,
        z: 2.8,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('Fase 12 — directIlluminanceBatch (kernel inyectable)', () => {
    it('sin kernel (default undefined) el resultado es idéntico al de antes de esta fase', () => {
        const room = buildRoom();
        const fixture = buildFixture();

        const withoutKernel = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const explicitUndefined = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, null, undefined);

        expect(explicitUndefined).toEqual(withoutKernel);
    });

    it('con un kernel inyectado, el resultado punto a punto usa la salida del kernel en vez del bucle TS', () => {
        const room = buildRoom();
        const fixture = buildFixture();

        const baseline = calculateLightingResult(room, [fixture], GRID_SPACING, []);

        // Kernel de prueba deliberadamente distinto (constante 500 lux por
        // punto activo) — si el resultado cambia a coincidir con esto, el
        // parámetro realmente está siendo usado en vez de ignorado.
        const constantKernel: DirectIlluminanceBatchKernel = (points) => points.map(() => 500);
        const withKernel = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, null, constantKernel);

        expect(withKernel.avg_lux).toBeCloseTo(500, 6);
        expect(withKernel.min_lux).toBeCloseTo(500, 6);
        expect(withKernel.max_lux).toBeCloseTo(500, 6);
        expect(withKernel.avg_lux).not.toBeCloseTo(baseline.avg_lux, 6);
    });

    it('el kernel recibe SOLO los puntos activos, en el mismo orden que la malla', () => {
        const room = buildRoom();
        const fixture = buildFixture();

        const receivedCounts: number[] = [];
        const passthroughKernel: DirectIlluminanceBatchKernel = (points, fixtures) => {
            receivedCounts.push(points.length);
            return points.map((point) => fixtures.reduce((sum, f) => sum + Math.max(0, 100 - Math.hypot(point.x - f.x, point.y - f.y) * 10), 0));
        };

        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, null, passthroughKernel);

        const activePointCount = result.grid_active?.filter(Boolean).length ?? 0;
        expect(receivedCounts).toEqual([activePointCount]);
    });

    it('la componente reflejada (Fase 7/8) sigue sumándose sobre la salida del kernel', () => {
        const room = buildRoom();
        const fixture = buildFixture();
        const reflectances = { ceiling: 0.7, wall: 0.5, floor: 0.2 };

        const zeroKernel: DirectIlluminanceBatchKernel = (points) => points.map(() => 0);
        const directOnlyViaKernel = calculateLightingResult(room, [fixture], GRID_SPACING, [], null, null, null, zeroKernel);
        const withReflectionAndKernel = calculateLightingResult(room, [fixture], GRID_SPACING, [], reflectances, null, null, zeroKernel);

        // Con el kernel forzando la directa a 0, cualquier lux restante viene
        // ÚNICAMENTE de la reflexión — debe seguir activa junto al kernel.
        expect(directOnlyViaKernel.avg_lux).toBe(0);
        expect(withReflectionAndKernel.avg_lux).toBeGreaterThan(0);
    });
});
