import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import { buildFase0MediumAmbients } from '@/pages/dialux/hooks/__fixtures__/fase0MediumFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import { calculateLightingResult, LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Project, Scene } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';

function buildSmallProject(): Project {
    const room = buildFase0SmallRoom();
    const fixtures = buildFase0SmallFixtures();
    const scene: Scene = {
        id: 'fase0-small-scene',
        name: 'Nivel único',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures,
        lightSwitches: [],
        partitions: [],
    };
    return {
        id: 'fase0-small-project',
        name: 'Proyecto de referencia',
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        scenes: [scene],
    };
}

describe('runDirectPreviewEngine — Fase 1 (wrapper, sin cambiar fórmula)', () => {
    it('produce el MISMO avg/min/max/uniformity/ugr que llamar a calculateLightingResult directamente (fixture pequeña)', async () => {
        const room = buildFase0SmallRoom();
        const fixtures = buildFase0SmallFixtures();
        const direct = calculateLightingResult(room, fixtures);

        const snapshot = buildCalculationSnapshot(buildSmallProject());
        const run = await runDirectPreviewEngine(snapshot);

        expect(run.surfaces).toHaveLength(1);
        const wrapped = run.surfaces[0]!.result;
        expect(wrapped.avg_lux).toBeCloseTo(direct.avg_lux, 9);
        expect(wrapped.min_lux).toBeCloseTo(direct.min_lux, 9);
        expect(wrapped.max_lux).toBeCloseTo(direct.max_lux, 9);
        expect(wrapped.uniformity).toBeCloseTo(direct.uniformity, 9);
        expect(wrapped.ugr).toBeCloseTo(direct.ugr, 9);
    });

    it('coincide con el golden de Fase 0 para la fixture mediana, ambiente por ambiente', async () => {
        const ambients = buildFase0MediumAmbients();
        const directResults = ambients.map((a) => calculateLightingResult(a.room, a.fixtures));

        // Reconstruye el mismo proyecto como Scene única con 20 recintos.
        const scene: Scene = {
            id: 'fase0-medium-scene',
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
            id: 'fase0-medium-project',
            name: 'Proyecto mediano',
            created_at: '2026-08-02T00:00:00.000Z',
            updated_at: '2026-08-02T00:00:00.000Z',
            scenes: [scene],
        };

        const snapshot = buildCalculationSnapshot(project);
        const run = await runDirectPreviewEngine(snapshot);

        expect(run.surfaces).toHaveLength(20);
        // `deriveSceneAmbientSpaces` identifica cada ambiente con un id compuesto
        // (`${room.id}::ambient-1`), no con el `room.id` original — es el mismo
        // esquema que ya usa el export a PDF/snapshot.
        const avgByObjectId = new Map(run.surfaces.map((s) => [s.objectId, s.result.avg_lux]));
        for (const [i, ambient] of ambients.entries()) {
            expect(avgByObjectId.get(`${ambient.room.id}::ambient-1`)).toBeCloseTo(directResults[i]!.avg_lux, 9);
        }
    });

    it('etiqueta el run con LIGHTING_ENGINE_VERSION y estado completed', async () => {
        const snapshot = buildCalculationSnapshot(buildModuloIProjectFixture());
        const run = await runDirectPreviewEngine(snapshot);

        expect(run.engineVersion).toBe(LIGHTING_ENGINE_VERSION);
        expect(run.status).toBe('completed');
        expect(run.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
        expect(run.surfaces).toHaveLength(24);
        expect(run.durationMs).toBeGreaterThanOrEqual(0);
        expect(run.warnings).toEqual([]);
    });

    it('agrega un warning cuando un objeto de cálculo no tiene luminarias asociadas', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.fixtures = []; // sin luminarias en el único ambiente
        const snapshot = buildCalculationSnapshot(project);
        const run = await runDirectPreviewEngine(snapshot);

        expect(run.warnings).toHaveLength(1);
        expect(run.warnings[0]!.code).toBe('object-without-luminaires');
        expect(run.surfaces[0]!.result.avg_lux).toBe(0);
    });
});
