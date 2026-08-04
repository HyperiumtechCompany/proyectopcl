import { describe, expect, it } from 'vitest';
import { compareLightingScenes } from './compareLightingScenes';
import { DEFAULT_DIRECT_PREVIEW_CONFIG, type CalculationRun } from './types';

function buildRun(overrides: Partial<CalculationRun> = {}): CalculationRun {
    return {
        id: 'run-1',
        engineVersion: 'direct-preview-v1',
        snapshotHash: 'hash',
        status: 'completed',
        config: DEFAULT_DIRECT_PREVIEW_CONFIG,
        startedAt: '2026-08-03T00:00:00.000Z',
        completedAt: '2026-08-03T00:00:01.000Z',
        durationMs: 1000,
        warnings: [],
        surfaces: [],
        ...overrides,
    };
}

describe('Fase 10 — compareLightingScenes', () => {
    it('calcula el delta (comparison - baseline) por objeto emparejado por objectId', () => {
        const baseline = buildRun({
            surfaces: [
                { objectId: 'obj-1', objectName: 'Oficina', levelId: 'nivel-1', result: { avg_lux: 500, min_lux: 400, max_lux: 600, uniformity: 0.8, ugr: 19, grid_rows: 1, grid_cols: 1, grid_values: [500] } },
            ],
        });
        const comparison = buildRun({
            surfaces: [
                { objectId: 'obj-1', objectName: 'Oficina', levelId: 'nivel-1', result: { avg_lux: 300, min_lux: 250, max_lux: 350, uniformity: 0.83, ugr: 22, grid_rows: 1, grid_cols: 1, grid_values: [300] } },
            ],
        });

        const [entry] = compareLightingScenes(baseline, comparison);

        expect(entry!.objectId).toBe('obj-1');
        expect(entry!.avgLuxDelta).toBeCloseTo(-200, 9);
        expect(entry!.minLuxDelta).toBeCloseTo(-150, 9);
        expect(entry!.maxLuxDelta).toBeCloseTo(-250, 9);
        expect(entry!.uniformityDelta).toBeCloseTo(0.03, 9);
        expect(entry!.ugrDelta).toBeCloseTo(3, 9);
    });

    it('omite objetos que no existen en el run base (nunca inventa un delta)', () => {
        const baseline = buildRun({ surfaces: [] });
        const comparison = buildRun({
            surfaces: [
                { objectId: 'obj-1', objectName: 'Oficina', levelId: 'nivel-1', result: { avg_lux: 300, min_lux: 250, max_lux: 350, uniformity: 0.83, ugr: 22, grid_rows: 1, grid_cols: 1, grid_values: [300] } },
            ],
        });

        expect(compareLightingScenes(baseline, comparison)).toEqual([]);
    });

    it('con las mismas escenas (mismo run dos veces), todos los deltas son 0', () => {
        const run = buildRun({
            surfaces: [
                { objectId: 'obj-1', objectName: 'Oficina', levelId: 'nivel-1', result: { avg_lux: 500, min_lux: 400, max_lux: 600, uniformity: 0.8, ugr: 19, grid_rows: 1, grid_cols: 1, grid_values: [500] } },
            ],
        });

        const [entry] = compareLightingScenes(run, run);
        expect(entry!.avgLuxDelta).toBe(0);
        expect(entry!.ugrDelta).toBe(0);
    });
});
