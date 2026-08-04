import { describe, expect, it } from 'vitest';
import type { DialuxSceneComparisonSummary } from '../domain/types';
import { buildLightingSceneComparisonPageSeeds } from './lightingSceneComparisonPages';

/**
 * Suite de la Fase 13 ("Documentación respaldada por cálculo", plan maestro
 * §11: "añadir anexos comparativos"). Mismo patrón que `glossaryPages.ts`:
 * `sceneComparisons: []` (todo proyecto real hoy, ninguna UI crea 2+
 * `lightingScenes` por nivel) produce cero páginas.
 */
function buildComparison(overrides: Partial<DialuxSceneComparisonSummary> = {}): DialuxSceneComparisonSummary {
    return {
        id: 'nivel-1::modo-nocturno',
        levelId: 'nivel-1',
        levelName: 'Piso 1',
        baselineSceneName: 'Todo encendido',
        comparisonSceneName: 'Modo nocturno',
        entries: [
            {
                objectId: 'room-1::ambient-1',
                objectName: 'Oficina',
                levelId: 'nivel-1',
                avgLuxDelta: -120.5,
                minLuxDelta: -80,
                maxLuxDelta: -150,
                uniformityDelta: -0.05,
                ugrDelta: -2.1,
            },
        ],
        ...overrides,
    };
}

describe('buildLightingSceneComparisonPageSeeds', () => {
    it('sin comparaciones (todo proyecto real hoy), no produce ninguna página', () => {
        expect(buildLightingSceneComparisonPageSeeds([])).toEqual([]);
    });

    it('una comparación produce una página con los datos completos embebidos (sin join aparte)', () => {
        const comparison = buildComparison();

        const seeds = buildLightingSceneComparisonPageSeeds([comparison]);

        expect(seeds).toHaveLength(1);
        expect(seeds[0]!.kind).toBe('lighting-scene-comparison');
        expect(seeds[0]!.sectionId).toBe('technical-appendix');
        expect(seeds[0]!.sceneId).toBe(comparison.levelId);
        expect(seeds[0]!.sceneComparison).toBe(comparison);
        expect(seeds[0]!.subtitle).toContain('Todo encendido');
        expect(seeds[0]!.subtitle).toContain('Modo nocturno');
    });

    it('varias comparaciones producen una página cada una, con títulos de continuación', () => {
        const first = buildComparison({ id: 'a' });
        const second = buildComparison({ id: 'b', comparisonSceneName: 'Modo emergencia' });

        const seeds = buildLightingSceneComparisonPageSeeds([first, second]);

        expect(seeds).toHaveLength(2);
        expect(seeds[0]!.title).toBe('Comparación de escenas lumínicas');
        expect(seeds[1]!.title).toContain('cont.');
        expect(seeds[0]!.id).not.toBe(seeds[1]!.id);
    });
});
