import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import { buildFase0MediumAmbients } from '@/pages/dialux/hooks/__fixtures__/fase0MediumFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import { calculateLightingResult, GRID_SPACING, LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from './types';

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

describe('runDirectPreviewEngine — Fase 1 (wrapper, sin cambiar fórmula)', () => {
    it('produce el MISMO avg/min/max/uniformity/ugr que llamar a calculateLightingResult directamente (fixture pequeña)', async () => {
        const room = buildFase0SmallRoom();
        const fixtures = buildFase0SmallFixtures();
        const direct = calculateMaintained(room, fixtures);

        const snapshot = buildCalculationSnapshot(buildSmallProject());
        // glare en 'legacy': `direct` (`calculateMaintained`) llama al motor
        // sin glareConfig (legacy implícito) — para comparar "el wrapper no
        // cambia la fórmula" hay que pedirle al wrapper EL MISMO modo, no el
        // default (guth-observers desde la Fase 16).
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            glare: { enabled: true, observerModel: 'legacy' },
        });

        expect(run.surfaces).toHaveLength(1);
        const wrapped = run.surfaces[0]!.result;
        expect(wrapped.avg_lux).toBeCloseTo(direct.avg_lux, 9);
        expect(wrapped.min_lux).toBeCloseTo(direct.min_lux, 9);
        expect(wrapped.max_lux).toBeCloseTo(direct.max_lux, 9);
        expect(wrapped.uniformity).toBeCloseTo(direct.uniformity, 9);
        expect(wrapped.ugr).toBeCloseTo(direct.ugr, 9);
    });

    it('coincide con el golden de Fase 0 para la fixture mediana, ambiente por ambiente', async () => {
        const ambients = buildFase0MediumAmbients();
        const directResults = ambients.map((a) => calculateMaintained(a.room, a.fixtures));

        // Reconstruye el mismo proyecto como Scene única con 20 recintos.
        const scene: Scene = {
            id: 'fase0-medium-scene',
            name: 'Nivel único',
            floorIndex: 0,
            floorElevation: 0,
            floorHeight: 3,
            scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
            rooms: ambients.map((a) => a.room),
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: ambients.flatMap((a) => a.fixtures),
            lightSwitches: [],
            partitions: [],
        };
        const project: Project = {
            id: 'fase0-medium-project',
            name: 'Proyecto mediano',
            created_at: '2026-08-02T00:00:00.000Z',
            updated_at: '2026-08-02T00:00:00.000Z',
            scenes: [scene],
        };

        const snapshot = buildCalculationSnapshot(project);
        const run = await runDirectPreviewEngine(snapshot);

        expect(run.surfaces).toHaveLength(20);
        // `deriveSceneAmbientSpaces` identifica cada ambiente con un id compuesto
        // (`${room.id}::ambient-1`), no con el `room.id` original — es el mismo
        // esquema que ya usa el export a PDF/snapshot.
        const avgByObjectId = new Map(run.surfaces.map((s) => [s.objectId, s.result.avg_lux]));
        for (const [i, ambient] of ambients.entries()) {
            expect(avgByObjectId.get(`${ambient.room.id}::ambient-1`)).toBeCloseTo(directResults[i]!.avg_lux, 9);
        }
    });

    it('etiqueta el run con LIGHTING_ENGINE_VERSION y estado completed', async () => {
        const snapshot = buildCalculationSnapshot(buildModuloIProjectFixture());
        // glare 'legacy' + interreflection 'none': este test es sobre metadatos del run, no sobre UGR ni materiales (ambos ruido con los defaults de Fase 16).
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'none',
            glare: { enabled: true, observerModel: 'legacy' },
        });

        expect(run.engineVersion).toBe(LIGHTING_ENGINE_VERSION);
        expect(run.status).toBe('completed');
        expect(run.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
        expect(run.surfaces).toHaveLength(24);
        expect(run.durationMs).toBeGreaterThanOrEqual(0);
        expect(run.warnings).toEqual([]);
    });

    it('Fase 5: config.meshPolicy.gridSpacingM cambia la resolución real de la malla, no solo metadata', async () => {
        const snapshot = buildCalculationSnapshot(buildSmallProject());

        const withDefaultSpacing = await runDirectPreviewEngine(snapshot);
        const coarser = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            meshPolicy: { gridSpacingM: GRID_SPACING * 2 },
        });

        const defaultGrid = withDefaultSpacing.surfaces[0]!.result;
        const coarserGrid = coarser.surfaces[0]!.result;

        // Recinto 6x4 m: con spacing=0.5 hay 12x8 celdas; con spacing=1.0, 6x4.
        expect(defaultGrid.grid_cols).toBe(12);
        expect(defaultGrid.grid_rows).toBe(8);
        expect(coarserGrid.grid_cols).toBe(6);
        expect(coarserGrid.grid_rows).toBe(4);
        // Menos puntos de muestreo cambia el resultado agregado (no es un
        // simple passthrough de metadata sin efecto).
        expect(coarserGrid.avg_lux).not.toBeCloseTo(defaultGrid.avg_lux, 6);
    });

    it('agrega un warning cuando un objeto de cálculo no tiene luminarias asociadas', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.fixtures = []; // sin luminarias en el único ambiente
        const snapshot = buildCalculationSnapshot(project);
        // interreflection 'none': este test es sobre el warning de luminarias faltantes, no sobre materiales (ruido con el default de Fase 16).
        const run = await runDirectPreviewEngine(snapshot, { ...DEFAULT_DIRECT_PREVIEW_CONFIG, interreflection: 'none' });

        expect(run.warnings).toHaveLength(1);
        expect(run.warnings[0]!.code).toBe('object-without-luminaires');
        expect(run.surfaces[0]!.result.avg_lux).toBe(0);
    });
});

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

describe('runDirectPreviewEngine — Fase 9 (UGR y luminancia profesional)', () => {
    it('con glare.observerModel: "legacy" (explícito), el UGR es idéntico al de antes de esta fase y no expone campos ugr_observer_*', async () => {
        // Desde la Fase 16, el DEFAULT ya no es 'legacy' (ver
        // `DEFAULT_DIRECT_PREVIEW_CONFIG`) — este test ya no valida el
        // comportamiento por defecto, sino que el modo 'legacy' en sí
        // sigue funcionando igual que antes de la Fase 9, para quien lo
        // pida explícitamente.
        const snapshot = buildCalculationSnapshot(buildSmallProject());
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            glare: { enabled: true, observerModel: 'legacy' },
        });
        const direct = calculateMaintained(buildFase0SmallRoom(), buildFase0SmallFixtures());

        expect(run.surfaces[0]!.result.ugr).toBeCloseTo(direct.ugr, 9);
        expect(run.surfaces[0]!.result.ugr_observer_view_direction_deg).toBeUndefined();
    });

    it('con la configuración por DEFECTO (guth-observers desde la Fase 16), expone el observador ganador', async () => {
        const snapshot = buildCalculationSnapshot(buildSmallProject());
        const run = await runDirectPreviewEngine(snapshot);

        const result = run.surfaces[0]!.result;
        expect(result.ugr_observer_x).toBeDefined();
        expect([0, 90, 180, 270]).toContain(result.ugr_observer_view_direction_deg);
    });

    it('con glare.observerModel: "guth-observers", expone el observador ganador y el conteo de exclusiones', async () => {
        const snapshot = buildCalculationSnapshot(buildSmallProject());
        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            glare: { enabled: true, observerModel: 'guth-observers' },
        });

        const result = run.surfaces[0]!.result;
        expect(result.ugr_observer_x).toBeDefined();
        expect([0, 90, 180, 270]).toContain(result.ugr_observer_view_direction_deg);
        expect(result.ugr_excluded_fixture_count).toBeDefined();
    });

    it('advierte cuando "guth-observers" e interreflexión están activos a la vez (Lb cambia de método: avg/π → Eind/π)', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0.5;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0.2;
        const snapshot = buildCalculationSnapshot(project);

        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'guth-observers' },
        });

        expect(run.warnings.map((w) => w.code)).toContain('ugr-background-luminance-method-changed');
    });

    it('NO advierte sobre el cambio de método de Lb cuando solo una de las dos condiciones está activa', async () => {
        const project = buildSmallProject();
        project.scenes[0]!.rooms[0]!.ceilingReflectance = 0.7;
        project.scenes[0]!.rooms[0]!.wallReflectance = 0.5;
        project.scenes[0]!.rooms[0]!.floorReflectance = 0.2;
        const snapshot = buildCalculationSnapshot(project);

        const onlyReflectances = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'first-bounce',
            glare: { enabled: true, observerModel: 'legacy' },
        });
        // interreflection 'none' explícito: este caso prueba SOLO guth-observers activo (el room tiene reflectancias, así que el default real activaría ambas condiciones a la vez).
        const onlyGuthObservers = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'none',
            glare: { enabled: true, observerModel: 'guth-observers' },
        });

        expect(onlyReflectances.warnings.map((w) => w.code)).not.toContain('ugr-background-luminance-method-changed');
        expect(onlyGuthObservers.warnings.map((w) => w.code)).not.toContain('ugr-background-luminance-method-changed');
    });
});

describe('runDirectPreviewEngine — Fase 10 (escenas luminosas y controles)', () => {
    function buildProjectWithScenes() {
        const project = buildSmallProject();
        project.scenes[0]!.lightSwitches = [
            { id: 'switch-1', x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: ['fase0-small-fixture-1', 'fase0-small-fixture-2'] },
        ];
        project.scenes[0]!.lightingScenes = [
            { id: 'dia', name: 'Día', switchStates: {} },
            { id: 'noche', name: 'Noche', switchStates: { 'switch-1': { on: false, dimmingFactor: 1 } } },
        ];
        return project;
    }

    it('sin sceneSelectionByLevel (default null), usa la PRIMERA escena del nivel', async () => {
        const project = buildProjectWithScenes();
        const snapshot = buildCalculationSnapshot(project);

        const run = await runDirectPreviewEngine(snapshot);

        expect(run.surfaces[0]!.result.avg_lux).toBeGreaterThan(0); // "Día": todo encendido
    });

    it('con sceneSelectionByLevel, calcula la escena elegida — MISMA geometría (mismos niveles/objetos), resultado independiente', async () => {
        const project = buildProjectWithScenes();
        const snapshot = buildCalculationSnapshot(project);
        const levelId = snapshot.levels[0]!.id;

        const diaRun = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::dia` });
        const nocheRun = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::noche` });

        // Puerta de salida de la Fase 10: "una geometría puede calcularse con
        // varias escenas sin duplicar el nivel" — mismo snapshot, mismos
        // niveles/objetos, resultados de iluminancia distintos.
        expect(diaRun.surfaces).toHaveLength(nocheRun.surfaces.length);
        expect(nocheRun.surfaces[0]!.result.avg_lux).toBeLessThan(diaRun.surfaces[0]!.result.avg_lux);
        expect(nocheRun.warnings.map((w) => w.code)).not.toContain('scene-not-found');
    });

    it('con un sceneId que no existe para ese nivel, advierte y usa la escena por defecto (primera) sin fallar', async () => {
        const project = buildProjectWithScenes();
        const snapshot = buildCalculationSnapshot(project);
        const levelId = snapshot.levels[0]!.id;

        const run = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::no-existe` });

        expect(run.warnings.map((w) => w.code)).toContain('scene-not-found');
        expect(run.surfaces[0]!.result.avg_lux).toBeGreaterThan(0); // cae a "dia" (primera escena)
    });

    it('advierte "all-fixtures-off-in-scene" (no "object-without-luminaires") cuando la escena apaga TODAS las luminarias de un ambiente', async () => {
        const project = buildSmallProject();
        const allFixtureIds = project.scenes[0]!.fixtures.map((f) => f.id);
        project.scenes[0]!.lightSwitches = [
            { id: 'switch-all', x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: allFixtureIds },
        ];
        project.scenes[0]!.lightingScenes = [
            { id: 'apagado', name: 'Todo apagado', switchStates: { 'switch-all': { on: false, dimmingFactor: 1 } } },
        ];
        const snapshot = buildCalculationSnapshot(project);
        const levelId = snapshot.levels[0]!.id;

        const run = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::apagado` });

        expect(run.surfaces[0]!.result.avg_lux).toBe(0);
        expect(run.warnings.map((w) => w.code)).toContain('all-fixtures-off-in-scene');
        expect(run.warnings.map((w) => w.code)).not.toContain('object-without-luminaires');
    });

    it('la regulación (dimmingFactor) escala el flujo antes del cálculo — menos dimming produce menos iluminancia, proporcionalmente', async () => {
        const project = buildSmallProject();
        const allFixtureIds = project.scenes[0]!.fixtures.map((f) => f.id);
        project.scenes[0]!.lightSwitches = [
            { id: 'switch-all', x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: allFixtureIds },
        ];
        project.scenes[0]!.lightingScenes = [
            { id: 'full', name: 'Full', switchStates: { 'switch-all': { on: true, dimmingFactor: 1 } } },
            { id: 'atenuada', name: 'Atenuada', switchStates: { 'switch-all': { on: true, dimmingFactor: 0.5 } } },
        ];
        const snapshot = buildCalculationSnapshot(project);
        const levelId = snapshot.levels[0]!.id;

        const fullRun = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::full` });
        const dimmedRun = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::atenuada` });

        expect(dimmedRun.surfaces[0]!.result.avg_lux).toBeCloseTo(fullRun.surfaces[0]!.result.avg_lux * 0.5, 6);
    });

    it('una luminaria "encendida" pero con dimmingFactor=0 se trata como apagada (regresión de auditoría: 0 lúmenes es indistinguible de apagada)', async () => {
        const project = buildSmallProject();
        const allFixtureIds = project.scenes[0]!.fixtures.map((f) => f.id);
        project.scenes[0]!.lightSwitches = [
            { id: 'switch-all', x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: allFixtureIds },
        ];
        project.scenes[0]!.lightingScenes = [
            { id: 'apagada-por-dimming', name: 'Apagada por dimming', switchStates: { 'switch-all': { on: true, dimmingFactor: 0 } } },
        ];
        const snapshot = buildCalculationSnapshot(project);
        const levelId = snapshot.levels[0]!.id;

        const run = await runDirectPreviewEngine(snapshot, DEFAULT_DIRECT_PREVIEW_CONFIG, { [levelId]: `${levelId}::apagada-por-dimming` });

        expect(run.surfaces[0]!.result.avg_lux).toBe(0);
        expect(run.warnings.map((w) => w.code)).toContain('all-fixtures-off-in-scene');
    });
});
