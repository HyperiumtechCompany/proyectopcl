import { describe, expect, it } from 'vitest';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from '@/pages/dialux/domain/calculation/types';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxExportSnapshot } from './buildDialuxExportSnapshot';

/**
 * RegresiÃ³n del hallazgo de Fase 6 (planes/plan_agentes_skills_revision_normativa_dialux.md):
 * `RequirementEvaluation.status` no debe ser `pass`/`fail` cuando el ambiente
 * no tiene ninguna fuente normativa asignada (`normativeStandard`,
 * `normativeLabel` ni `normativeCategory`) â€” de lo contrario el informe
 * afirmarÃ­a "cumple"/"no cumple" sin poder citar quÃ© norma se estÃ¡ evaluando.
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

describe('buildDialuxExportSnapshot â€” requerimientos sin fuente normativa', () => {
    it('ambiente SIN normativeStandard/normativeLabel/normativeCategory: nunca marca pass/fail', () => {
        const room = buildRoom(); // sin ningÃºn campo normativo asignado
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

    it('ambiente CON normativeLabel asignado: sÃ­ evalÃºa pass/fail normalmente', () => {
        const room = buildRoom({
            normativeLabel: 'Aula â€” EN 12464-1',
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

        expect(illuminance.source).toBe('Aula â€” EN 12464-1');
        expect(['pass', 'fail']).toContain(illuminance.status);
    });

    it('ambiente CON normativeStandard pero sin label ni categorÃ­a: igual cuenta como fuente vÃ¡lida', () => {
        const room = buildRoom({ normativeStandard: 'en_12464_1' });
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

        expect(illuminance.source).toBe('en_12464_1');
        expect(['pass', 'fail']).toContain(illuminance.status);
    });
});

describe('buildDialuxExportSnapshot â€” Fase 11 (resultados profesionales: procedencia real y warnings)', () => {
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
        const room = buildRoom({ normativeLabel: 'Aula â€” EN 12464-1', normativeCategory: 'educacion' });
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
        // interreflexión 'first-bounce' es el default desde la Fase 16.
        expect(provenance.configSummary).toBe('oclusión: no · interreflexión: first-bounce · UGR: guth-observers');
    });

    it('un ambiente sin luminarias trae SU warning (`object-without-luminaires`) y no el de otros ambientes', async () => {
        const room = buildRoom();
        const project = buildProjectWithRoom(room);
        project.scenes[0]!.fixtures = []; // sin luminarias en el Ãºnico ambiente

        // interreflection en 'none': este test es sobre el filtrado de
        // warnings por ambiente, no sobre materiales â€” `buildRoom()` no tiene
        // reflectancias asignadas, asÃ­ que con el default 'first-bounce'
        // (Fase 16) aparecerÃ­a ademÃ¡s `object-without-material-reflectance`,
        // ruido irrelevante para lo que se verifica acÃ¡.
        const { resultsByRoom, run } = await runProjectLightingCalculation(project, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'none',
        });
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

    it('un warning global (`objectId: null`) va en `snapshot.globalWarnings`, no en el de ningÃºn ambiente', async () => {
        const room = buildRoom();
        const project = buildProjectWithRoom(room);

        // maxBounces=1 con interreflection='iterative' dispara
        // 'interreflection-maxBounces-too-low', que es un warning global
        // (objectId: null, no asociado a ningÃºn ambiente en particular).
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

    it('un ambiente ausente del `calculationRun` (fallback a cÃ¡lculo directo) no hereda la procedencia del run', async () => {
        const roomA = buildRoom({ id: 'room-a' });
        const roomB = buildRoom({ id: 'room-b' });

        // El `calculationRun` solo cubre room-a: simula el caso de un
        // ambiente agregado/editado despuÃ©s de haber corrido el cÃ¡lculo,
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

        // room-a sÃ­ pasÃ³ por el run: trae hash/config reales.
        expect(ambientA.metrics.provenance.snapshotHash).toBe(run.snapshotHash);

        // room-b NO estÃ¡ en `run.surfaces` (cÃ¡lculo de respaldo directo):
        // no debe aparentar que vino del mismo `calculationRun`.
        expect(ambientB.metrics.provenance.snapshotHash).toBeUndefined();
        expect(ambientB.metrics.provenance.configSummary).toBeUndefined();
    });
});

/**
 * RegresiÃ³n del hallazgo bloqueante Â§-9.4 (plan_cierre_brecha_paridad_dialux_evo.md):
 * el PDF (esta funciÃ³n) no evaluaba Ra/CRI, mientras el panel interactivo
 * (`normativeEngine.ts`) sÃ­ â€” un ambiente con una luminaria de Ra insuficiente
 * podÃ­a exportarse como "Cumple" en el documento entregado. Usa una actividad
 * REAL de `normativaData.ts` (EN 12464-1 "Vestibulos de entrada", Ra >= 60),
 * no un valor inventado en el test.
 */
describe('buildDialuxExportSnapshot â€” evaluaciÃ³n de Ra/CRI (paridad con el panel interactivo)', () => {
    it('luminaria instalada con CRI por debajo del mÃ­nimo de la actividad: la fila "ra" falla y el ambiente NO cumple', () => {
        const room = buildRoom({
            normativeStandard: 'en_12464_1',
            normativeActivity: 'Vestibulos de entrada',
            illuminanceLux: 100,
            norma: 100,
        });
        const project = buildProjectWithRoom(room);
        project.scenes[0]!.fixtures[0]!.cri = 50; // por debajo del Ra >= 60 exigido

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambient = snapshot.ambients[0]!;
        const ra = ambient.metrics.requirementEvaluations.find((e) => e.metric === 'ra')!;

        expect(ra).toBeDefined();
        expect(ra.requiredValue).toBe(60);
        expect(ra.calculatedValue).toBe(50);
        expect(ra.status).toBe('fail');
        expect(ambient.metrics.ra).toBe(50);
        expect(ambient.metrics.raRequired).toBe(60);
        // Antes de esta correcciÃ³n, `complies` no consideraba Ra en absoluto
        // y este ambiente hubiera dado "Cumple" pese al CRI insuficiente.
        expect(ambient.metrics.complies).toBe(false);
    });

    it('luminaria instalada con CRI suficiente: la fila "ra" pasa', () => {
        const room = buildRoom({
            normativeStandard: 'en_12464_1',
            normativeActivity: 'Vestibulos de entrada',
            illuminanceLux: 100,
            norma: 100,
        });
        const project = buildProjectWithRoom(room);
        project.scenes[0]!.fixtures[0]!.cri = 80;

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const ambient = snapshot.ambients[0]!;
        const ra = ambient.metrics.requirementEvaluations.find((e) => e.metric === 'ra')!;
        expect(ra.status).toBe('pass');
    });
});

