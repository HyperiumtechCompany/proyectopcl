import { describe, expect, it } from 'vitest';
import { buildFase0MediumAmbients } from '@/pages/dialux/hooks/__fixtures__/fase0MediumFixture';
import type { DirectIlluminanceBatchKernel } from '@/pages/dialux/hooks/directIlluminance';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Project, Scene } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';

/**
 * Suite de la Fase 12 ("Rendimiento: Worker y WASM", plan maestro §11).
 * `runOptions` es lo que `workers/dialuxCalculationWorker.ts` usa para
 * reportar progreso, cancelar cooperativamente y (opcionalmente) inyectar
 * el kernel WASM — este archivo verifica el contrato en aislamiento, sin
 * ningún Worker real de por medio.
 */
function buildMediumProject(): Project {
    const ambients = buildFase0MediumAmbients();
    const scene: Scene = {
        id: 'fase12-medium-scene',
        name: 'Nivel único',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
        rooms: ambients.map((a) => a.room),
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: ambients.flatMap((a) => a.fixtures),
        lightSwitches: [],
        partitions: [],
    };
    return {
        id: 'fase12-medium-project',
        name: 'Proyecto mediano',
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        scenes: [scene],
    };
}

describe('runDirectPreviewEngine — runOptions.onProgress', () => {
    it('reporta progreso una vez por calculationObject, en orden creciente hasta el total', async () => {
        const snapshot = buildCalculationSnapshot(buildMediumProject());
        const total = snapshot.calculationObjects.length;
        expect(total).toBe(20);

        const progressCalls: Array<[number, number]> = [];
        const run = await runDirectPreviewEngine(snapshot, undefined, null, {
            onProgress: (completed, totalArg) => progressCalls.push([completed, totalArg]),
        });

        expect(run.status).toBe('completed');
        expect(progressCalls).toHaveLength(total);
        expect(progressCalls.map(([completed]) => completed)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
        expect(progressCalls.every(([, totalArg]) => totalArg === total)).toBe(true);
    });
});

describe('runDirectPreviewEngine — runOptions.isCancelled', () => {
    it('corta el bucle entre objetos: status "cancelled" y solo las surfaces ya calculadas', async () => {
        const snapshot = buildCalculationSnapshot(buildMediumProject());

        let completedSoFar = 0;
        const run = await runDirectPreviewEngine(snapshot, undefined, null, {
            onProgress: (completed) => {
                completedSoFar = completed;
            },
            isCancelled: () => completedSoFar >= 3,
        });

        expect(run.status).toBe('cancelled');
        expect(run.surfaces).toHaveLength(3);
    });

    it('sin isCancelled (default), el comportamiento es idéntico al de antes de esta fase', async () => {
        const snapshot = buildCalculationSnapshot(buildMediumProject());
        const withoutRunOptions = await runDirectPreviewEngine(snapshot);
        const withEmptyRunOptions = await runDirectPreviewEngine(snapshot, undefined, null, {});

        expect(withEmptyRunOptions.status).toBe('completed');
        expect(withEmptyRunOptions.surfaces).toHaveLength(withoutRunOptions.surfaces.length);
        expect(withEmptyRunOptions.surfaces.map((s) => s.result.avg_lux)).toEqual(withoutRunOptions.surfaces.map((s) => s.result.avg_lux));
    });
});

describe('runDirectPreviewEngine — runOptions.directIlluminanceBatch', () => {
    it('se reenvía a calculateLightingResult para cada objeto (mismo resultado que llamarlo directamente con el kernel)', async () => {
        const ambients = buildFase0MediumAmbients().slice(0, 2);
        const scene: Scene = {
            id: 'fase12-kernel-scene',
            name: 'Nivel único',
            floorIndex: 0,
            floorElevation: 0,
            floorHeight: 3,
            scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
            rooms: ambients.map((a) => a.room),
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: ambients.flatMap((a) => a.fixtures),
            lightSwitches: [],
            partitions: [],
        };
        const project: Project = {
            id: 'fase12-kernel-project',
            name: 'Proyecto de referencia — kernel',
            created_at: '2026-08-02T00:00:00.000Z',
            updated_at: '2026-08-02T00:00:00.000Z',
            scenes: [scene],
        };

        const constantKernel: DirectIlluminanceBatchKernel = (points) => points.map(() => 500);
        const snapshot = buildCalculationSnapshot(project);
        const run = await runDirectPreviewEngine(snapshot, undefined, null, { directIlluminanceBatch: constantKernel });

        for (const surface of run.surfaces) {
            // `deriveSceneAmbientSpaces` identifica cada ambiente con un id
            // compuesto (`${room.id}::ambient-1}`), no con el `room.id`
            // original — ver `runDirectPreviewEngine.test.ts`.
            const ambient = ambients.find((a) => `${a.room.id}::ambient-1` === surface.objectId) ?? ambients[0]!;
            const expected = calculateLightingResult(
                ambient.room,
                ambient.fixtures,
                undefined,
                [],
                null,
                null,
                null,
                constantKernel,
                0.8,
            );
            expect(surface.result.avg_lux).toBeCloseTo(expected.avg_lux, 6);
        }
    });
});
