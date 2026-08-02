import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import type { Project, Scene } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';

/** Envuelve la fixture pequeña de Fase 0 (Room + Fixture[] sueltos) en un Project/Scene mínimo. */
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

describe('buildCalculationSnapshot — Fase 1', () => {
    it('produce un nivel, un objeto de cálculo y 4 luminarias para la fixture pequeña', () => {
        const project = buildSmallProject();
        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.schemaVersion).toBe('1');
        expect(snapshot.projectId).toBe('fase0-small-project');
        expect(snapshot.levels).toHaveLength(1);
        expect(snapshot.calculationObjects).toHaveLength(1);
        expect(snapshot.luminaires).toHaveLength(4);
        expect(snapshot.scenes).toHaveLength(1);
        expect(snapshot.scenes[0]!.luminaireStates).toHaveLength(4);
        expect(snapshot.scenes[0]!.luminaireStates.every((s) => s.on && s.dimmingFactor === 1)).toBe(true);
        expect(snapshot.calculationObjects[0]!.luminaireIds).toHaveLength(4);
    });

    it('produce 24 objetos de cálculo para MÓDULO I (3 niveles x 8 ambientes)', () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.levels).toHaveLength(3);
        expect(snapshot.calculationObjects).toHaveLength(24);
        expect(snapshot.luminaires).toHaveLength(24); // 1 luminaria por ambiente en este fixture
    });

    it('no cambia si el Project de entrada se muta después de construir el snapshot (puerta de salida Fase 1)', () => {
        const project = buildSmallProject();
        const snapshot = buildCalculationSnapshot(project);
        const beforeJson = JSON.stringify(snapshot);

        // Mutaciones in-place sobre el árbol original, como podría hacer un store mal disciplinado.
        project.scenes[0]!.rooms[0]!.vertices.push({ x: 99, y: 99 });
        project.scenes[0]!.fixtures[0]!.lumens = 999999;
        project.scenes[0]!.fixtures.push({ ...project.scenes[0]!.fixtures[0]!, id: 'intruso' });
        project.name = 'Nombre mutado';

        expect(JSON.stringify(snapshot)).toBe(beforeJson);
    });

    it('cada luminaria y objeto de cálculo es una copia independiente (sin arrays/objetos compartidos)', () => {
        const project = buildSmallProject();
        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.calculationObjects[0]!.vertices).not.toBe(project.scenes[0]!.rooms[0]!.vertices);
        expect(snapshot.luminaires[0]).not.toBe(project.scenes[0]!.fixtures[0]);
    });
});
