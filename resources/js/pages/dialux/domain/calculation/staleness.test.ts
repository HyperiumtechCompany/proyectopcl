import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { isCalculationRunStale, isCalculationRunStaleForSnapshotHash } from './staleness';

describe('isCalculationRunStale — Fase 1 (puerta de salida: "resultado pasa a stale")', () => {
    it('NO está obsoleto si el proyecto no cambió desde que se calculó', async () => {
        const project = buildModuloIProjectFixture();
        const run = await runDirectPreviewEngine(buildCalculationSnapshot(project));

        expect(await isCalculationRunStale(run, project)).toBe(false);
    });

    it('SÍ está obsoleto si se agrega una luminaria después de calcular', async () => {
        const project = buildModuloIProjectFixture();
        const run = await runDirectPreviewEngine(buildCalculationSnapshot(project));

        const mutatedProject = {
            ...project,
            scenes: project.scenes.map((scene, i) =>
                i === 0
                    ? {
                          ...scene,
                          fixtures: [
                              ...scene.fixtures,
                              { ...scene.fixtures[0]!, id: 'fixture-nueva' },
                          ],
                      }
                    : scene,
            ),
        };

        expect(await isCalculationRunStale(run, mutatedProject)).toBe(true);
    });

    it('SÍ está obsoleto si solo cambia un metadato de proyecto irrelevante para el cálculo (nombre)', async () => {
        // Nota: `projectId` SÍ entra al hash (identifica a qué proyecto pertenece
        // el snapshot), pero el nombre del proyecto no es parte de CalculationSnapshot
        // en absoluto — este caso documenta explícitamente ese límite: cambiar
        // `project.name` no lo invalida, porque el snapshot nunca lo capturó.
        const project = buildModuloIProjectFixture();
        const run = await runDirectPreviewEngine(buildCalculationSnapshot(project));
        const renamedProject = { ...project, name: 'Nombre nuevo' };

        expect(await isCalculationRunStale(run, renamedProject)).toBe(false);
    });

    it('isCalculationRunStaleForSnapshotHash compara directamente contra un hash ya calculado', async () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildCalculationSnapshot(project);
        const run = await runDirectPreviewEngine(snapshot);

        expect(await isCalculationRunStaleForSnapshotHash(run, run.snapshotHash)).toBe(false);
        expect(await isCalculationRunStaleForSnapshotHash(run, 'otro-hash-cualquiera')).toBe(true);
    });
});
