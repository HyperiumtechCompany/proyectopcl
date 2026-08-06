import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Project, Scene } from '@/pages/dialux/hooks/types';
import { runProjectLightingCalculation } from './runProjectLightingCalculation';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from './types';

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

describe('Fase 11 — runProjectLightingCalculation', () => {
    it('produce resultsByRoom indexado por objectId (== ambient.id), igual que el motor directo', async () => {
        const project = buildSmallProject();
        // maintenanceFactor explícito para igualar `DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor`
        // (0.8) — `calculateLightingResult` por sí solo por defecto usa 1 (sin
        // depreciar); mismatch preexistente detectado al tocar este archivo
        // para la Fase 16, no introducido por ella (confirmado con git stash:
        // ya fallaba antes del cambio de default de `interreflection`).
        const direct = calculateLightingResult(
            buildFase0SmallRoom(),
            buildFase0SmallFixtures(),
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor,
        );

        const { resultsByRoom, run } = await runProjectLightingCalculation(project);

        expect(run.surfaces).toHaveLength(1);
        const objectId = run.surfaces[0]!.objectId;
        expect(resultsByRoom[objectId]!.avg_lux).toBeCloseTo(direct.avg_lux, 9);
        expect(resultsByRoom[objectId]).toBe(run.surfaces[0]!.result);
    });

    it('procesa TODOS los niveles del proyecto de una sola vez (MÓDULO I: 24 ambientes)', async () => {
        const project = buildModuloIProjectFixture();
        const { resultsByRoom, run } = await runProjectLightingCalculation(project);

        expect(run.surfaces).toHaveLength(24);
        expect(Object.keys(resultsByRoom)).toHaveLength(24);
    });

    it('con config default, es idéntico a no pasar ningún config (mismo objeto DEFAULT_DIRECT_PREVIEW_CONFIG)', async () => {
        const project = buildSmallProject();
        const a = await runProjectLightingCalculation(project);
        const b = await runProjectLightingCalculation(project, DEFAULT_DIRECT_PREVIEW_CONFIG);

        expect(a.run.surfaces[0]!.result.avg_lux).toBe(b.run.surfaces[0]!.result.avg_lux);
    });

    it('la ejecución (`run`) trae versión de motor, hash y warnings — trazabilidad real (plan §11 Fase 11)', async () => {
        const project = buildSmallProject();
        const { run } = await runProjectLightingCalculation(project);

        expect(run.engineVersion).toBeTruthy();
        expect(run.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
        expect(run.config).toBe(DEFAULT_DIRECT_PREVIEW_CONFIG);
        expect(Array.isArray(run.warnings)).toBe(true);
    });

    // Panel "Terreno" (`ProyectoPanel.tsx`, comparación DIALux evo): mismo
    // patrón de override que arma `EditorLayout.tsx::runCalc` a partir de
    // `project.siteSettings.maintenanceFactor` — probado acá contra el motor
    // real en vez de montar el componente completo.
    it('Terreno · Mantenimiento: un MF de proyecto distinto del default cambia el lux calculado proporcionalmente (E ∝ MF)', async () => {
        const project = buildSmallProject();
        project.siteSettings = { maintenanceFactor: 0.4 };

        const configWithOverride = {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            maintenanceFactor: project.siteSettings.maintenanceFactor ?? DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor,
        };

        const baseline = await runProjectLightingCalculation(buildSmallProject());
        const overridden = await runProjectLightingCalculation(project, configWithOverride);

        const baselineLux = baseline.run.surfaces[0]!.result.avg_lux;
        const overriddenLux = overridden.run.surfaces[0]!.result.avg_lux;
        const expectedRatio = 0.4 / (DEFAULT_DIRECT_PREVIEW_CONFIG.maintenanceFactor ?? 0.8);

        expect(overriddenLux).not.toBeCloseTo(baselineLux, 1);
        expect(overriddenLux / baselineLux).toBeCloseTo(expectedRatio, 6);
    });

    it('Terreno · Orientación/Luz molesta: siguen sin consumidor de cálculo — el lux es idéntico con o sin esos campos', async () => {
        const withoutSiteSettings = buildSmallProject();
        const withSiteSettings = buildSmallProject();
        withSiteSettings.siteSettings = {
            latitude: -12.05,
            longitude: -77.04,
            northOrientationDeg: 15,
            timezone: 'America/Lima',
            obtrusiveLightStandard: 'en_12464_2_2014',
            environmentalZone: 'E3',
        };

        const a = await runProjectLightingCalculation(withoutSiteSettings);
        const b = await runProjectLightingCalculation(withSiteSettings);

        expect(b.run.surfaces[0]!.result.avg_lux).toBe(a.run.surfaces[0]!.result.avg_lux);
    });
});
