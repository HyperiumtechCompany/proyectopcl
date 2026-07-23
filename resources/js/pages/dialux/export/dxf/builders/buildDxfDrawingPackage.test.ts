import { describe, expect, it } from 'vitest';
import {
    DXF_FIXTURE_B_DXF_ENTITIES,
    buildDxfDuplicateLevelNamesProject,
    buildDxfFixtureAProject,
    buildDxfFixtureCProject,
    buildDxfHiddenLevelProject,
} from '../__fixtures__/dxfLevelFixtures';
import { buildDxfDrawingPackage } from './buildDxfDrawingPackage';

/**
 * Fase 1 del plan maestro DXF: modelo multinivel. Criterio de cierre — cada
 * entidad exportable pertenece a exactamente un nivel y ningún elemento de
 * un piso aparece en otro.
 */

const GLOBAL_BASE_PLAN = { entities: DXF_FIXTURE_B_DXF_ENTITIES, extents: null };

describe('buildDxfDrawingPackage — un nivel', () => {
    it('usa el fondo global como "shared" sin necesidad de política explícita y sin warnings', () => {
        const project = buildDxfFixtureAProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: project.scenes[0]!.id,
            globalBasePlan: GLOBAL_BASE_PLAN,
        });

        expect(pkg.levels).toHaveLength(1);
        expect(pkg.levels[0]!.basePlan.source).toBe('shared');
        expect(pkg.levels[0]!.basePlan.entities).toBe(DXF_FIXTURE_B_DXF_ENTITIES);
        expect(pkg.warnings).toHaveLength(0);
    });

    it('sin fondo global, el nivel único queda con source "none" y sin warnings', () => {
        const project = buildDxfFixtureAProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: project.scenes[0]!.id,
            globalBasePlan: null,
        });

        expect(pkg.levels[0]!.basePlan.source).toBe('none');
        expect(pkg.warnings).toHaveLength(0);
    });
});

describe('buildDxfDrawingPackage — tres niveles (sótano, planta baja, piso superior)', () => {
    it('ordena los niveles por floorIndex, no por orden de escena', () => {
        const project = buildDxfFixtureCProject();
        // Desordenar deliberadamente las escenas del proyecto.
        project.scenes = [...project.scenes].reverse();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: null,
        });

        expect(pkg.levels.map((level) => level.sceneId)).toEqual([
            'c-sotano', 'c-planta-baja', 'c-piso-1',
        ]);
        expect(pkg.levels.map((level) => level.floorIndex)).toEqual([-1, 0, 1]);
    });

    it('cada elemento eléctrico pertenece a exactamente un nivel, sin mezclarse entre pisos', () => {
        const project = buildDxfFixtureCProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: null,
        });

        const allFixtureIds = pkg.levels.flatMap((level) => level.electrical.fixtures.map((f) => f.id));
        const totalFixturesInScenes = project.scenes.reduce((sum, scene) => sum + scene.fixtures.length, 0);

        expect(allFixtureIds).toHaveLength(totalFixturesInScenes);
        expect(new Set(allFixtureIds).size).toBe(allFixtureIds.length); // sin duplicados entre niveles

        for (const level of pkg.levels) {
            const scene = project.scenes.find((s) => s.id === level.sceneId)!;
            expect(level.electrical.fixtures.map((f) => f.id)).toEqual(scene.fixtures.map((f) => f.id));
            expect(level.architecture.rooms.map((r) => r.id)).toEqual(scene.rooms.map((r) => r.id));
        }
    });

    it('un nivel sin tomacorrientes exporta electrical.electricalDevices vacío, sin fallar', () => {
        const project = buildDxfFixtureCProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: null,
        });

        const pisoSuperior = pkg.levels.find((level) => level.sceneId === 'c-piso-1')!;
        expect(pisoSuperior.electrical.electricalDevices).toHaveLength(0);

        const plantaBaja = pkg.levels.find((level) => level.sceneId === 'c-planta-baja')!;
        expect(plantaBaja.electrical.electricalDevices.length).toBeGreaterThan(0);
    });

    it('sin política explícita, aplica el fondo solo al nivel activo y advierte que falta configurar el reparto', () => {
        const project = buildDxfFixtureCProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: GLOBAL_BASE_PLAN,
        });

        expect(pkg.warnings.map((w) => w.code)).toContain('shared-base-plan-not-configured');

        const plantaBaja = pkg.levels.find((level) => level.sceneId === 'c-planta-baja')!;
        expect(plantaBaja.basePlan.source).toBe('scene');

        const sotano = pkg.levels.find((level) => level.sceneId === 'c-sotano')!;
        const pisoSuperior = pkg.levels.find((level) => level.sceneId === 'c-piso-1')!;
        expect(sotano.basePlan.source).toBe('none');
        expect(pisoSuperior.basePlan.source).toBe('none');

        const levelWithoutBasePlanWarnings = pkg.warnings.filter((w) => w.code === 'level-without-base-plan');
        expect(levelWithoutBasePlanWarnings.map((w) => w.sceneId).sort()).toEqual(['c-piso-1', 'c-sotano']);
    });

    it('política "shared-all-levels" aplica el mismo fondo a los tres niveles sin advertir reparto', () => {
        const project = buildDxfFixtureCProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: GLOBAL_BASE_PLAN,
            basePlanPolicy: 'shared-all-levels',
        });

        expect(pkg.warnings.map((w) => w.code)).not.toContain('shared-base-plan-not-configured');
        for (const level of pkg.levels) {
            expect(level.basePlan.source).toBe('shared');
            expect(level.basePlan.entities).toBe(DXF_FIXTURE_B_DXF_ENTITIES);
        }
    });

    it('política "drawn-only" ignora el fondo importado en todos los niveles', () => {
        const project = buildDxfFixtureCProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: GLOBAL_BASE_PLAN,
            basePlanPolicy: 'drawn-only',
        });

        for (const level of pkg.levels) {
            expect(level.basePlan.source).toBe('drawn-only');
            expect(level.basePlan.entities).toHaveLength(0);
        }
        expect(pkg.warnings.map((w) => w.code)).not.toContain('shared-base-plan-not-configured');
    });
});

describe('buildDxfDrawingPackage — nombres duplicados', () => {
    it('advierte pero conserva ambos niveles como entidades separadas', () => {
        const project = buildDxfDuplicateLevelNamesProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'dup-a',
            globalBasePlan: null,
        });

        expect(pkg.levels).toHaveLength(2);
        expect(pkg.levels.map((level) => level.sceneId)).toEqual(['dup-a', 'dup-b']);
        expect(pkg.warnings).toContainEqual(
            expect.objectContaining({ code: 'duplicate-level-name', sceneId: 'dup-b' }),
        );
    });
});

describe('buildDxfDrawingPackage — nivel invisible', () => {
    it('excluye el nivel oculto de "levels" y deja constancia en warnings', () => {
        const project = buildDxfHiddenLevelProject();

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'hide-a',
            globalBasePlan: null,
        });

        expect(pkg.levels).toHaveLength(1);
        expect(pkg.levels[0]!.sceneId).toBe('hide-a');
        expect(pkg.warnings).toContainEqual(
            expect.objectContaining({ code: 'level-hidden-excluded', sceneId: 'hide-b' }),
        );
    });
});
