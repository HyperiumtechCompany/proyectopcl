import { describe, expect, it } from 'vitest';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import type { LightingScenePreset, Project, Scene } from '@/pages/dialux/hooks/types';
import { resolveSceneComparisonsForExport } from './resolveSceneComparisonsForExport';

/**
 * Suite de la Fase 13 ("Documentación respaldada por cálculo", plan maestro
 * §11: "añadir anexos comparativos"). Hoy ninguna UI crea 2+
 * `lightingScenes` por nivel — la mayoría de proyectos reales caen en el
 * primer test (`[]`, cero llamadas al motor); el segundo test verifica el
 * caso dormido para cuando esa UI exista.
 */
function buildProject(lightingScenes?: LightingScenePreset[]): Project {
    const room = buildFase0SmallRoom();
    const fixtures = buildFase0SmallFixtures();
    const scene: Scene = {
        id: 'fase13-comparison-scene',
        name: 'Piso 1',
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
        lightingScenes,
    };
    return {
        id: 'fase13-comparison-project',
        name: 'Proyecto de referencia — comparación de escenas',
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        scenes: [scene],
    };
}

describe('resolveSceneComparisonsForExport', () => {
    it('sin lightingScenes (todo proyecto real hoy), devuelve [] sin correr el motor', async () => {
        const project = buildProject();

        expect(await resolveSceneComparisonsForExport(project)).toEqual([]);
    });

    it('con una sola lightingScene en el nivel, sigue devolviendo [] (no hay nada que comparar)', async () => {
        const project = buildProject([{ id: 'todo-encendido', name: 'Todo encendido', switchStates: {} }]);

        expect(await resolveSceneComparisonsForExport(project)).toEqual([]);
    });

    it('con 2+ lightingScenes en el nivel, compara la primera (baseline) contra cada una de las demás', async () => {
        const project = buildProject([
            { id: 'todo-encendido', name: 'Todo encendido', switchStates: {} },
            { id: 'modo-nocturno', name: 'Modo nocturno', switchStates: {} },
        ]);

        const comparisons = await resolveSceneComparisonsForExport(project);

        expect(comparisons).toHaveLength(1);
        expect(comparisons[0]!.levelId).toBe('fase13-comparison-scene');
        expect(comparisons[0]!.baselineSceneName).toBe('Todo encendido');
        expect(comparisons[0]!.comparisonSceneName).toBe('Modo nocturno');
        expect(comparisons[0]!.entries.length).toBeGreaterThan(0);
    });
});
