import { describe, expect, it } from 'vitest';
import type { Fixture, Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from './types';

/**
 * Suite de la Fase 14 ("Emergencia", plan maestro §11). Verificado con
 * `chief-electrical-engineer-reviewer` antes de implementar: no existe una
 * fórmula normativa (ni EN 1838 ni RNE A.130) para "factor de flujo de
 * emergencia" — es dato de fabricante por luminaria. El motor NUNCA debe
 * inventar un porcentaje ni usar el flujo normal como sustituto.
 */
function buildRoom(): Room {
    return {
        id: 'emergency-room',
        name: 'Recinto de referencia — modo emergencia',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3,
        color: '#000000',
        usefulPlaneHeight: 0.8,
    };
}

function buildFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'fixture-1',
        name: 'Luminaria de referencia',
        x: 2,
        y: 2,
        z: 2.8,
        lumens: 4000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
        ...overrides,
    };
}

function buildProject(fixtures: Fixture[], lightSwitches: Scene['lightSwitches'] = []): Project {
    const scene: Scene = {
        id: 'emergency-scene',
        name: 'Piso 1',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
        rooms: [buildRoom()],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures,
        lightSwitches,
        partitions: [],
    };
    return {
        id: 'emergency-project',
        name: 'Proyecto de referencia — modo emergencia',
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
        scenes: [scene],
    };
}

const EMERGENCY_CONFIG = { ...DEFAULT_DIRECT_PREVIEW_CONFIG, emergencyMode: true };

describe('runDirectPreviewEngine — emergencyMode (Fase 14)', () => {
    it('default (sin emergencyMode) reproduce el motor de siempre, sin importar emergencyType/emergencyFlux', async () => {
        const fixture = buildFixture({ emergencyType: 'emergency', emergencyFlux: 999 });
        const snapshot = buildCalculationSnapshot(buildProject([fixture]));

        const run = await runDirectPreviewEngine(snapshot);

        expect(run.surfaces[0]!.result.avg_lux).toBeGreaterThan(0);
        // El flujo normal (4000 lm) es el único que participa — nunca 999.
        const normalRun = await runDirectPreviewEngine(snapshot, undefined, null, {});
        expect(run.surfaces[0]!.result.avg_lux).toBeCloseTo(normalRun.surfaces[0]!.result.avg_lux, 9);
    });

    it("emergencyType: 'none' nunca participa en emergencyMode, aunque tenga emergencyFlux", async () => {
        const fixture = buildFixture({ emergencyType: 'none', emergencyFlux: 999 });
        const snapshot = buildCalculationSnapshot(buildProject([fixture]));

        const run = await runDirectPreviewEngine(snapshot, EMERGENCY_CONFIG);

        expect(run.surfaces[0]!.result.avg_lux).toBe(0);
        expect(run.warnings.map((w) => w.code)).toContain('no-emergency-fixtures-in-object');
    });

    it("emergencyType: 'emergency' con emergencyFlux definido usa ESE flujo, no el normal", async () => {
        const lowFlux = buildFixture({ id: 'low', emergencyType: 'emergency', emergencyFlux: 100, lumens: 4000 });
        const highFlux = buildFixture({ id: 'high', emergencyType: 'emergency', emergencyFlux: 8000, lumens: 4000 });

        const lowRun = await runDirectPreviewEngine(buildCalculationSnapshot(buildProject([lowFlux])), EMERGENCY_CONFIG);
        const highRun = await runDirectPreviewEngine(buildCalculationSnapshot(buildProject([highFlux])), EMERGENCY_CONFIG);

        expect(lowRun.surfaces[0]!.result.avg_lux).toBeGreaterThan(0);
        expect(highRun.surfaces[0]!.result.avg_lux).toBeGreaterThan(lowRun.surfaces[0]!.result.avg_lux);
    });

    it('emergencyType emergency/permanent SIN emergencyFlux se excluye y advierte — nunca usa el flujo normal como sustituto', async () => {
        const fixture = buildFixture({ emergencyType: 'permanent', emergencyFlux: null, lumens: 4000 });
        const snapshot = buildCalculationSnapshot(buildProject([fixture]));

        const run = await runDirectPreviewEngine(snapshot, EMERGENCY_CONFIG);

        expect(run.surfaces[0]!.result.avg_lux).toBe(0);
        expect(run.warnings.map((w) => w.code)).toContain('luminaire-without-emergency-flux-data');
    });

    it('el estado de escena/interruptor (apagado) se ignora en emergencyMode — el corte real vuelve irrelevante el interruptor normal', async () => {
        const fixture = buildFixture({ emergencyType: 'emergency', emergencyFlux: 500 });
        const project = buildProject([fixture], [
            { id: 'switch-1', x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: [fixture.id] },
        ]);
        // Escena Fase 10: el interruptor que controla la luminaria está apagado.
        project.scenes[0]!.lightingScenes = [
            {
                id: 'todo-apagado',
                name: 'Todo apagado',
                switchStates: { 'switch-1': { on: false, dimmingFactor: 0 } },
            },
        ];

        const snapshot = buildCalculationSnapshot(project);
        const run = await runDirectPreviewEngine(snapshot, EMERGENCY_CONFIG);

        // A pesar del interruptor apagado en la escena normal, la luminaria de
        // emergencia SÍ participa en modo emergencia (tiene su propia batería/alimentación).
        expect(run.surfaces[0]!.result.avg_lux).toBeGreaterThan(0);
    });
});
