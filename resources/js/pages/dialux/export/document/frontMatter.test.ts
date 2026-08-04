import { describe, expect, it } from 'vitest';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from '@/pages/dialux/domain/calculation/types';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';
import { buildFixedPageSeeds } from './frontMatter';
import { buildLuminaireList } from './productPages';

/**
 * Suite de la Fase 13 ("Documentación respaldada por cálculo", plan maestro
 * §11: "mostrar engineVersion, modo y warnings"). El motor/config/warnings
 * globales se muestran como notas de texto en "Observaciones preliminares"
 * (`preliminary-observations`) — ver `formal-pdf.blade.php`, que ya
 * renderiza `page.notes` como `<p>` sin lógica adicional.
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
                x: 2.5,
                y: 2,
                z: 2.9,
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

describe('buildFixedPageSeeds — trazabilidad de motor/config/warnings (Fase 13)', () => {
    it('sin calculationRun (default), no agrega notas de motor ni de advertencias globales', () => {
        const project = buildProjectWithRoom(buildRoom());
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const luminaires = buildLuminaireList(snapshot);
        const seeds = buildFixedPageSeeds(snapshot, luminaires, []);
        const observations = seeds.find((seed) => seed.kind === 'preliminary-observations')!;

        expect(observations.notes.some((note) => note.startsWith('Motor de calculo'))).toBe(false);
        expect(observations.notes.some((note) => note.startsWith('Advertencias del motor'))).toBe(false);
    });

    it('con calculationRun real, agrega una nota con el motor y el resumen de configuración', async () => {
        const project = buildProjectWithRoom(buildRoom());
        const { resultsByRoom, run } = await runProjectLightingCalculation(project, DEFAULT_DIRECT_PREVIEW_CONFIG);

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const luminaires = buildLuminaireList(snapshot);
        const seeds = buildFixedPageSeeds(snapshot, luminaires, []);
        const observations = seeds.find((seed) => seed.kind === 'preliminary-observations')!;
        const engineNote = observations.notes.find((note) => note.startsWith('Motor de calculo'));

        expect(engineNote).toContain(run.engineVersion);
    });

    it('con warnings globales (objectId null), agrega una nota con sus mensajes', async () => {
        const project = buildProjectWithRoom(buildRoom());
        const { resultsByRoom, run } = await runProjectLightingCalculation(project, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            interreflection: 'iterative',
            maxBounces: 1,
        });
        expect(run.warnings.map((w) => w.code)).toContain('interreflection-maxBounces-too-low');

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const luminaires = buildLuminaireList(snapshot);
        const seeds = buildFixedPageSeeds(snapshot, luminaires, []);
        const observations = seeds.find((seed) => seed.kind === 'preliminary-observations')!;
        const warningsNote = observations.notes.find((note) => note.startsWith('Advertencias del motor'));

        expect(warningsNote).toBeDefined();
        expect(warningsNote).toMatch(/no permite más de un rebote/);
    });
});
