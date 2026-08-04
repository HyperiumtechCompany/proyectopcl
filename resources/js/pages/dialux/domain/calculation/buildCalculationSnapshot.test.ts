import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import type { LightSwitch, Project, Scene } from '@/pages/dialux/hooks/types';
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

describe('buildCalculationSnapshot — Fase 10 (escenas lumínicas y controles)', () => {
    function buildSwitch(id: string, connectedFixtureIds: string[]): LightSwitch {
        return { id, x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds };
    }

    it('con interruptores modelados pero SIN ningún preset de escena, sigue generando la "Escena por defecto" con todo encendido (no disruptivo)', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [buildSwitch('switch-1', ['fase0-small-fixture-1'])];
        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.scenes).toHaveLength(1);
        expect(snapshot.scenes[0]!.name).toBe('Escena por defecto');
        expect(snapshot.scenes[0]!.luminaireStates.every((s) => s.on && s.dimmingFactor === 1)).toBe(true);
    });

    it('con un preset que apaga un interruptor, solo las luminarias conectadas a ESE interruptor quedan apagadas', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [buildSwitch('switch-1', ['fase0-small-fixture-1', 'fase0-small-fixture-2'])];
        project.scenes[0]!.lightingScenes = [
            { id: 'noche', name: 'Noche', switchStates: { 'switch-1': { on: false, dimmingFactor: 1 } } },
        ];

        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.scenes).toHaveLength(1); // reemplaza la default, no la agrega
        expect(snapshot.scenes[0]!.id).toBe('fase0-small-scene::noche');
        expect(snapshot.scenes[0]!.name).toBe('Noche');

        const byId = new Map(snapshot.scenes[0]!.luminaireStates.map((s) => [s.luminaireId, s]));
        expect(byId.get('fase0-small-fixture-1')!.on).toBe(false);
        expect(byId.get('fase0-small-fixture-2')!.on).toBe(false);
        // Las otras 2 luminarias no están conectadas a ningún interruptor: siguen encendidas.
        expect(byId.get('fase0-small-fixture-3')!.on).toBe(true);
        expect(byId.get('fase0-small-fixture-4')!.on).toBe(true);
    });

    it('un interruptor NO listado en switchStates se asume encendido al 100% (una escena es un "diff" desde todo encendido)', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [buildSwitch('switch-1', ['fase0-small-fixture-1'])];
        project.scenes[0]!.lightingScenes = [{ id: 'vacia', name: 'Sin overrides', switchStates: {} }];

        const snapshot = buildCalculationSnapshot(project);
        expect(snapshot.scenes[0]!.luminaireStates.every((s) => s.on && s.dimmingFactor === 1)).toBe(true);
    });

    it('una luminaria controlada por DOS interruptores queda apagada si CUALQUIERA de ellos está apagado (regla conservadora)', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [
            buildSwitch('switch-a', ['fase0-small-fixture-1']),
            buildSwitch('switch-b', ['fase0-small-fixture-1']),
        ];
        project.scenes[0]!.lightingScenes = [
            {
                id: 'mixta',
                name: 'Mixta',
                switchStates: {
                    'switch-a': { on: true, dimmingFactor: 1 },
                    'switch-b': { on: false, dimmingFactor: 1 },
                },
            },
        ];

        const snapshot = buildCalculationSnapshot(project);
        const state = snapshot.scenes[0]!.luminaireStates.find((s) => s.luminaireId === 'fase0-small-fixture-1');
        expect(state!.on).toBe(false);
    });

    it('con dos interruptores encendidos pero distinta atenuación, se usa la MÁS BAJA (regla conservadora)', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [
            buildSwitch('switch-a', ['fase0-small-fixture-1']),
            buildSwitch('switch-b', ['fase0-small-fixture-1']),
        ];
        project.scenes[0]!.lightingScenes = [
            {
                id: 'atenuada',
                name: 'Atenuada',
                switchStates: {
                    'switch-a': { on: true, dimmingFactor: 0.8 },
                    'switch-b': { on: true, dimmingFactor: 0.3 },
                },
            },
        ];

        const snapshot = buildCalculationSnapshot(project);
        const state = snapshot.scenes[0]!.luminaireStates.find((s) => s.luminaireId === 'fase0-small-fixture-1');
        expect(state!.on).toBe(true);
        expect(state!.dimmingFactor).toBe(0.3);
    });

    it('recorta dimmingFactor a [0,1] (regresión de auditoría: un valor fuera de rango no debe llegar sin filtro al motor)', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [buildSwitch('switch-1', ['fase0-small-fixture-1'])];
        project.scenes[0]!.lightingScenes = [
            { id: 'fuera-de-rango', name: 'Fuera de rango', switchStates: { 'switch-1': { on: true, dimmingFactor: -5 } } },
        ];

        const snapshot = buildCalculationSnapshot(project);
        const state = snapshot.scenes[0]!.luminaireStates.find((s) => s.luminaireId === 'fase0-small-fixture-1');
        expect(state!.dimmingFactor).toBe(0);
    });

    it('con VARIOS presets, genera una LightingSceneState por preset (geometría sin duplicar — mismos niveles/objetos/luminarias)', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [buildSwitch('switch-1', ['fase0-small-fixture-1'])];
        project.scenes[0]!.lightingScenes = [
            { id: 'dia', name: 'Día', switchStates: {} },
            { id: 'noche', name: 'Noche', switchStates: { 'switch-1': { on: false, dimmingFactor: 1 } } },
        ];

        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.scenes).toHaveLength(2);
        expect(snapshot.scenes.map((s) => s.id)).toEqual(['fase0-small-scene::dia', 'fase0-small-scene::noche']);
        // Puerta de salida de la Fase 10: "una geometría puede calcularse con
        // varias escenas sin duplicar el nivel" — un solo nivel, un solo
        // objeto de cálculo, una sola lista de luminarias, para las 2 escenas.
        expect(snapshot.levels).toHaveLength(1);
        expect(snapshot.calculationObjects).toHaveLength(1);
        expect(snapshot.luminaires).toHaveLength(4);

        const diaOn = snapshot.scenes[0]!.luminaireStates.find((s) => s.luminaireId === 'fase0-small-fixture-1')!.on;
        const nocheOn = snapshot.scenes[1]!.luminaireStates.find((s) => s.luminaireId === 'fase0-small-fixture-1')!.on;
        expect(diaOn).toBe(true);
        expect(nocheOn).toBe(false);
    });

    it('copia el `trigger` del preset al LightingSceneState', () => {
        const project = buildSmallProject();
        project.scenes[0]!.lightingScenes = [
            { id: 'sensor', name: 'Con sensor', switchStates: {}, trigger: { type: 'sensor', sensorType: 'occupancy' } },
        ];

        const snapshot = buildCalculationSnapshot(project);
        expect(snapshot.scenes[0]!.trigger).toEqual({ type: 'sensor', sensorType: 'occupancy' });
    });
});
