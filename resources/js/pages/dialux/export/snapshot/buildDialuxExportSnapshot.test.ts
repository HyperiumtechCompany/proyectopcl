import { describe, expect, it } from 'vitest';
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
