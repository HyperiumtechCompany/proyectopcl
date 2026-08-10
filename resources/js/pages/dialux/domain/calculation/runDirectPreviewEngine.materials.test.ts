import { describe, expect, it } from 'vitest';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from './types';

/**
 * Fase 7/8 (materiales/reflectancia e interreflexión) de
 * `runDirectPreviewEngine.test.ts` — separado por presupuesto de tamaño de
 * archivo (`__architecture__/fileSizeBudget.test.ts`), sin cambios de
 * comportamiento respecto al archivo original.
 */

function calculateMaintained(room: Room, fixtures: Fixture[]) {
    return calculateLightingResult(
        room,
        fixtures,
        undefined,
        [],
        null,
        null,
        null,
        undefined,
        0.8,
    );
}

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

describe('runDirectPreviewEngine — Fase 7 (materiales e interreflexión inicial)', () => {
    it('con interreflection: "none" explícito el resultado es idéntico al de antes de esta fase, aunque el recinto tenga reflectancias', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0.5;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0.2;
        const snapshot = buildCalculationSnapshot(project);

        // glare 'legacy' + interreflection 'none' explícito (default desde Fase 16 es 'first-bounce'): este test es sobre avg_lux sin interreflexión, no sobre UGR.
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'none',
            glare: { enabled: true, observerModel: 'legacy' },
        });
        const direct = calculateMaintained(buildFase0SmallRoom(), buildFase0SmallFixtures());

        expect(run.surfaces[0]!.result.avg_lux).toBeCloseTo(direct.avg_lux, 9);
        expect(run.warnings).toEqual([]);
    });

    it('con interreflection: "first-bounce" y reflectancias definidas, el avg_lux aumenta respecto al cálculo directo', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0.5;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0.2;
        const snapshot = buildCalculationSnapshot(project);

        // glare en 'legacy': este test es sobre interreflexión, no sobre UGR —
        // con guth-observers (default desde la Fase 16) activar reflectancias
        // dispara además el warning documentado de cambio de método de Lb,
        // ruido irrelevante para lo que se verifica acá.
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'legacy' },
        });
        const direct = calculateMaintained(buildFase0SmallRoom(), buildFase0SmallFixtures());

        expect(run.surfaces[0]!.result.avg_lux).toBeGreaterThan(direct.avg_lux);
        expect(run.warnings).toEqual([]);
    });

    it('con interreflection: "first-bounce" pero SIN reflectancias definidas, no hay diferencia y se advierte que falta material', async () => {
        const snapshot = buildCalculationSnapshot(buildSmallProject()); // sin reflectancias en el room
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'legacy' },
        });
        const direct = calculateMaintained(buildFase0SmallRoom(), buildFase0SmallFixtures());

        expect(run.surfaces[0]!.result.avg_lux).toBeCloseTo(direct.avg_lux, 9);
        expect(run.warnings).toHaveLength(1);
        expect(run.warnings[0]!.code).toBe('object-without-material-reflectance');
    });

    /**
     * Regresión de auditoría `dialux-calc-reviewer`
     * (`planes/plan_cierre_brecha_paridad_dialux_evo.md`): asignar
     * reflectancia SOLO a una superficie (la UI de
     * `RoomSurfaceMaterialsSection.tsx` lo permite) hacía que las otras dos
     * cayeran silenciosamente a 0% (negro absoluto) en
     * `resolveSurfaceReflectances`, sin ningún aviso — muy distinto del caso
     * "sin ninguna reflectancia" que sí advertía.
     */
    it('con reflectancia SOLO en techo (pared/piso sin asignar): advierte que esas superficies se asumen 0%, no solo "sin material"', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        // wallReflectance/floorReflectance quedan sin asignar (undefined).
        const snapshot = buildCalculationSnapshot(project);

        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'legacy' },
        });

        expect(run.warnings).toHaveLength(1);
        expect(run.warnings[0]!.code).toBe('object-with-partial-material-reflectance');
        expect(run.warnings[0]!.message).toMatch(/pared/);
        expect(run.warnings[0]!.message).toMatch(/piso/);
        expect(run.warnings[0]!.message).not.toMatch(/techo/);
    });

    it('con las TRES reflectancias asignadas: no advierte nada de reflectancia parcial', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0.5;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0.2;
        const snapshot = buildCalculationSnapshot(project);

        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'legacy' },
        });

        expect(run.warnings.map((w) => w.code)).not.toContain('object-with-partial-material-reflectance');
        expect(run.warnings.map((w) => w.code)).not.toContain('object-without-material-reflectance');
    });

});

describe('runDirectPreviewEngine — Fase 8 (interreflexión iterativa)', () => {
    function projectWithReflectances(): Project {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0.5;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0.2;
        return project;
    }

    it('con interreflection: "iterative" y maxBounces > 1, el avg_lux es mayor que con "first-bounce" (más rebotes suman más luz)', async () => {
        const snapshot = buildCalculationSnapshot(projectWithReflectances());

        const firstBounceRun = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'legacy' },
        });
        const iterativeRun = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'iterative',
            maxBounces: 30,
            convergenceTolerance: 1e-5,
            glare: { enabled: true, observerModel: 'legacy' },
        });

        expect(iterativeRun.surfaces[0]!.result.avg_lux).toBeGreaterThan(firstBounceRun.surfaces[0]!.result.avg_lux);
        expect(iterativeRun.surfaces[0]!.result.interreflection_converged).toBe(true);
        expect(iterativeRun.warnings).toEqual([]);
    });

    it('con interreflection: "iterative" y el maxBounces por defecto (<=1), advierte que equivale a "first-bounce" y produce el mismo resultado', async () => {
        const snapshot = buildCalculationSnapshot(projectWithReflectances());

        const firstBounceRun = await runDirectPreviewEngine(snapshot, { ...DEFAULT_DIRECT_PREVIEW_CONFIG, interreflection: 'first-bounce' });
        // DEFAULT_DIRECT_PREVIEW_CONFIG.maxBounces es 0 — "iterative" sin
        // configurar maxBounces explícitamente no debe fingir ser iterativo.
        const iterativeRun = await runDirectPreviewEngine(snapshot, { ...DEFAULT_DIRECT_PREVIEW_CONFIG, interreflection: 'iterative' });

        expect(iterativeRun.surfaces[0]!.result.avg_lux).toBeCloseTo(firstBounceRun.surfaces[0]!.result.avg_lux, 9);
        expect(iterativeRun.warnings.map((w) => w.code)).toContain('interreflection-maxBounces-too-low');
    });

    it('con interreflection: "iterative" pero SIN reflectancias definidas, advierte que falta material y no calcula interreflexión', async () => {
        const snapshot = buildCalculationSnapshot(buildSmallProject()); // sin reflectancias en el room
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'iterative',
            maxBounces: 30,
            convergenceTolerance: 1e-5,
        });
        const direct = calculateMaintained(buildFase0SmallRoom(), buildFase0SmallFixtures());

        expect(run.surfaces[0]!.result.avg_lux).toBeCloseTo(direct.avg_lux, 9);
        expect(run.warnings.map((w) => w.code)).toContain('object-without-material-reflectance');
        expect(run.surfaces[0]!.result.interreflection_iterations).toBeUndefined();
    });

    it('con reflectancia 0, "iterative" reproduce el cálculo directo EXACTO (converge trivialmente, sin warnings)', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0;
        const snapshot = buildCalculationSnapshot(project);

        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'iterative',
            maxBounces: 30,
            convergenceTolerance: 1e-5,
            glare: { enabled: true, observerModel: 'legacy' },
        });
        const direct = calculateMaintained(buildFase0SmallRoom(), buildFase0SmallFixtures());

        expect(run.surfaces[0]!.result.avg_lux).toBe(direct.avg_lux);
        expect(run.surfaces[0]!.result.interreflection_converged).toBe(true);
        expect(run.warnings).toEqual([]);
    });
});
