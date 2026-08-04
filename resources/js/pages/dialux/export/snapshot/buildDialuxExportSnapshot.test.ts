import { describe, expect, it } from 'vitest';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from '@/pages/dialux/domain/calculation/types';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxExportSnapshot } from './buildDialuxExportSnapshot';

/**
 * Regresión del hallazgo de Fase 6 (planes/plan_agentes_skills_revision_normativa_dialux.md):
 * `RequirementEvaluation.status` no debe ser `pass`/`fail` cuando el ambiente
 * no tiene ninguna fuente normativa asignada (`normativeStandard`,
 * `normativeLabel` ni `normativeCategory`) — de lo contrario el informe
 * afirmaría "cumple"/"no cumple" sin poder citar qué norma se está evaluando.
 */
function buildRoom(overrides: Partial<Room> = {}): Room {
    return {
        id: 'room-1',
        name: 'Ambiente de prueba',
        vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: 300,
        norma: 300,
        fixtureLumens: 4000,
        fixtureFlux: 4000,
        ...overrides,
    };
}

function buildProjectWithRoom(room: Room): Project {
    const scene: Scene = {
        id: 'scene-1',
        name: 'Piso 1',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: false },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        lightSwitches: [],
        partitions: [],
        fixtures: [
            {
                id: 'fixture-1',
                name: 'Panel LED',
                x: 2.5, y: 2, z: 2.9,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                lightColor: '#fff5e1',
                roomId: `${room.id}::ambient-1`,
            },
        ],
    };

    return {
        id: 'project-test',
        name: 'Proyecto de prueba',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        scenes: [scene],
    };
}

const visualConfig = {
    showGrid: false,
    showIsolux: false,
    show3DView: false,
    isoluxMode: 'functional' as const,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedId: null,
};

describe('buildDialuxExportSnapshot — requerimientos sin fuente normativa', () => {
    it('ambiente SIN normativeStandard/normativeLabel/normativeCategory: nunca marca pass/fail', () => {
        const room = buildRoom(); // sin ningún campo normativo asignado
        const project = buildProjectWithRoom(room);

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambient = snapshot.ambients[0]!;
        expect(ambient.metrics.requirementEvaluations.length).toBeGreaterThan(0);

        for (const evaluation of ambient.metrics.requirementEvaluations) {
            expect(evaluation.source).toBeUndefined();
            // Nunca 'pass' ni 'fail' sin fuente citada, sin importar el valor calculado.
            expect(evaluation.status).toBe('not-evaluated');
        }

        // Sin evaluaciones en 'pass', el ambiente no puede darse por conforme.
        expect(ambient.metrics.complies).toBe(false);
    });

    it('ambiente CON normativeLabel asignado: sí evalúa pass/fail normalmente', () => {
        const room = buildRoom({
            normativeLabel: 'Aula — EN 12464-1',
            normativeCategory: 'educacion',
        });
        const project = buildProjectWithRoom(room);

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambient = snapshot.ambients[0]!;
        const illuminance = ambient.metrics.requirementEvaluations.find((e) => e.metric === 'illuminance')!;

        expect(illuminance.source).toBe('Aula — EN 12464-1');
        expect(['pass', 'fail']).toContain(illuminance.status);
    });

    it('ambiente CON normativeStandard pero sin label ni categoría: igual cuenta como fuente válida', () => {
        const room = buildRoom({ normativeStandard: 'en_12464' });
        const project = buildProjectWithRoom(room);

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambient = snapshot.ambients[0]!;
        const illuminance = ambient.metrics.requirementEvaluations.find((e) => e.metric === 'illuminance')!;

        expect(illuminance.source).toBe('en_12464');
        expect(['pass', 'fail']).toContain(illuminance.status);
    });
});

describe('buildDialuxExportSnapshot — Fase 11 (resultados profesionales: procedencia real y warnings)', () => {
    it('sin `calculationRun` (default), la procedencia se mantiene exactamente como antes de esta fase', () => {
        const room = buildRoom();
        const project = buildProjectWithRoom(room);

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const { provenance, warnings } = snapshot.ambients[0]!.metrics;
        expect(provenance.snapshotHash).toBeUndefined();
        expect(provenance.configSummary).toBeUndefined();
        expect(warnings).toEqual([]);
    });

    it('con `calculationRun` real (runProjectLightingCalculation), la procedencia trae hash/config y las advertencias se filtran por ambiente', async () => {
        const room = buildRoom({ normativeLabel: 'Aula — EN 12464-1', normativeCategory: 'educacion' });
        const project = buildProjectWithRoom(room);

        const { resultsByRoom, run } = await runProjectLightingCalculation(project);

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const { provenance } = snapshot.ambients[0]!.metrics;
        expect(provenance.snapshotHash).toBe(run.snapshotHash);
        expect(provenance.engineVersion).toBe(run.engineVersion);
        expect(provenance.configSummary).toBe('oclusión: no · interreflexión: none · UGR: guth-observers');
    });

    it('un ambiente sin luminarias trae SU warning (`object-without-luminaires`) y no el de otros ambientes', async () => {
        const room = buildRoom();
        const project = buildProjectWithRoom(room);
        project.scenes[0]!.fixtures = []; // sin luminarias en el único ambiente

        const { resultsByRoom, run } = await runProjectLightingCalculation(project);
        expect(run.warnings.map((w) => w.code)).toContain('object-without-luminaires');

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambientWarnings = snapshot.ambients[0]!.metrics.warnings;
        expect(ambientWarnings.map((w) => w.code)).toEqual(['object-without-luminaires']);
    });

    it('un warning global (`objectId: null`) va en `snapshot.globalWarnings`, no en el de ningún ambiente', async () => {
        const room = buildRoom();
        const project = buildProjectWithRoom(room);

        // maxBounces=1 con interreflection='iterative' dispara
        // 'interreflection-maxBounces-too-low', que es un warning global
        // (objectId: null, no asociado a ningún ambiente en particular).
        const { resultsByRoom, run } = await runProjectLightingCalculation(project, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'iterative',
            maxBounces: 1,
        });
        expect(run.warnings.map((w) => w.code)).toContain('interreflection-maxBounces-too-low');

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        expect(snapshot.globalWarnings.map((w) => w.code)).toContain('interreflection-maxBounces-too-low');
        for (const ambient of snapshot.ambients) {
            expect(ambient.metrics.warnings.map((w) => w.code)).not.toContain('interreflection-maxBounces-too-low');
        }
    });

    it('un ambiente ausente del `calculationRun` (fallback a cálculo directo) no hereda la procedencia del run', async () => {
        const roomA = buildRoom({ id: 'room-a' });
        const roomB = buildRoom({ id: 'room-b' });

        // El `calculationRun` solo cubre room-a: simula el caso de un
        // ambiente agregado/editado después de haber corrido el cálculo,
        // de modo que `resultsByRoom`/`calculationRun.surfaces` no lo cubren.
        const projectForRun = buildProjectWithRoom(roomA);
        const { resultsByRoom, run } = await runProjectLightingCalculation(projectForRun);

        const fullProject = buildProjectWithRoom(roomA);
        fullProject.scenes[0]!.rooms.push(roomB);
        fullProject.scenes[0]!.fixtures.push({
            id: 'fixture-2',
            name: 'Panel LED B',
            x: 2.5, y: 2, z: 2.9,
            lumens: 4000,
            efficiency: 0.8,
            fixtureType: 'panel',
            lightColor: '#fff5e1',
            roomId: `${roomB.id}::ambient-1`,
        });

        const snapshot = buildDialuxExportSnapshot({
            project: fullProject,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambientA = snapshot.ambients.find((a) => a.roomId === 'room-a')!;
        const ambientB = snapshot.ambients.find((a) => a.roomId === 'room-b')!;

        // room-a sí pasó por el run: trae hash/config reales.
        expect(ambientA.metrics.provenance.snapshotHash).toBe(run.snapshotHash);

        // room-b NO está en `run.surfaces` (cálculo de respaldo directo):
        // no debe aparentar que vino del mismo `calculationRun`.
        expect(ambientB.metrics.provenance.snapshotHash).toBeUndefined();
        expect(ambientB.metrics.provenance.configSummary).toBeUndefined();
    });
});
