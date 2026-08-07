import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import type { Project, Scene } from '@/pages/dialux/hooks/types';
import { resolveCalculationRunForExport } from './resolveCalculationRunForExport';

/**
 * Suite de la Fase 13 ("Documentación respaldada por cálculo", plan maestro
 * §11): `resolveCalculationRunForExport` es el punto donde
 * `useDialuxPdfExport.ts` decide si reusar el último `CalculationRun`
 * guardado o recalcular — nunca debe reusar uno que no coincida con el
 * proyecto actual (garantía de Fase 11: "el PDF nunca muestra resultados
 * viejos").
 */
function buildProject(overrides: Partial<Scene> = {}): Project {
    const room = buildFase0SmallRoom();
    const fixtures = buildFase0SmallFixtures();
    const scene: Scene = {
        id: 'fase13-scene',
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
        ...overrides,
    };
    return {
        id: 'fase13-project',
        name: 'Proyecto de referencia — resolveCalculationRunForExport',
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        scenes: [scene],
    };
}

describe('resolveCalculationRunForExport', () => {
    it('sin cachedRun (nunca se calculó antes), recalcula', async () => {
        const project = buildProject();

        const resolved = await resolveCalculationRunForExport(project, null);

        expect(resolved.reused).toBe(false);
        expect(resolved.calculationRun.surfaces.length).toBeGreaterThan(0);
        expect(Object.keys(resolved.resultsByRoom)).toHaveLength(resolved.calculationRun.surfaces.length);
    });

    it('con cachedRun vigente (proyecto sin cambios), lo reusa sin recalcular', async () => {
        const project = buildProject();
        const { run: cachedRun } = await runProjectLightingCalculation(project, buildProductionCalculationConfig(project));

        const resolved = await resolveCalculationRunForExport(project, cachedRun);

        expect(resolved.reused).toBe(true);
        expect(resolved.calculationRun).toBe(cachedRun);
        expect(resolved.calculationRun.snapshotHash).toBe(cachedRun.snapshotHash);
    });

    it('con cachedRun obsoleto (se agregó una luminaria desde que se calculó), recalcula en vez de reusarlo', async () => {
        const project = buildProject();
        const { run: cachedRun } = await runProjectLightingCalculation(project, buildProductionCalculationConfig(project));

        const mutatedProject: Project = {
            ...project,
            scenes: project.scenes.map((scene) => ({
                ...scene,
                fixtures: [...scene.fixtures, { ...scene.fixtures[0]!, id: 'fixture-nueva' }],
            })),
        };

        const resolved = await resolveCalculationRunForExport(mutatedProject, cachedRun);

        expect(resolved.reused).toBe(false);
        expect(resolved.calculationRun.snapshotHash).not.toBe(cachedRun.snapshotHash);
    });

    it('con cachedRun calculado con una config de producción vieja (mismo proyecto), recalcula en vez de reusarlo', async () => {
        const project = buildProject();
        // Sin pasar config explícita: usa el `DEFAULT_DIRECT_PREVIEW_CONFIG`
        // crudo — simula un run calculado antes de un cambio a
        // `buildProductionCalculationConfig` (bug real reportado: un cambio
        // de config/motor no invalidaba el caché).
        const { run: cachedRun } = await runProjectLightingCalculation(project);

        const resolved = await resolveCalculationRunForExport(project, cachedRun);

        expect(resolved.reused).toBe(false);
        expect(resolved.calculationRun).not.toBe(cachedRun);
    });
});
