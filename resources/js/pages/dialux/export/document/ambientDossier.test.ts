import { describe, expect, it } from 'vitest';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { buildDialuxExportSnapshot } from '@/pages/dialux/export/snapshot/buildDialuxExportSnapshot';
import { DEFAULT_MAINTENANCE_FACTOR } from '@/pages/dialux/export/domain/types';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAmbientDetails } from './ambientDossier';

/**
 * Panel "Terreno" · Mantenimiento (`ProyectoPanel.tsx`, comparación DIALux
 * evo): `siteSettings.maintenanceFactor` es el mismo override que alimenta
 * el cálculo real (`EditorLayout.tsx::runCalc`) — este archivo solo prueba
 * que la ficha PDF por ambiente MUESTRA ese valor en vez de caer siempre al
 * default, que era el comportamiento anterior (el campo nunca estaba
 * poblado en `Project`, así que el `??` siempre resolvía al default).
 */
function buildRoom(): Room {
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
    };
}

function buildProject(room: Room, siteSettings?: Project['siteSettings']): Project {
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
        fixtures: [],
    };

    return {
        id: 'project-test',
        name: 'Proyecto de prueba',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        siteSettings,
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

describe('buildAmbientDetails — Factor de mantenimiento (panel "Terreno")', () => {
    it('sin siteSettings.maintenanceFactor: cae al default, igual que antes de este cambio', () => {
        const project = buildProject(buildRoom());
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const [detail] = buildAmbientDetails(snapshot, []);
        expect(detail!.maintenanceFactor).toBe(DEFAULT_MAINTENANCE_FACTOR);
    });

    it('con siteSettings.maintenanceFactor seteado: la ficha PDF muestra ese valor, no el default', () => {
        const project = buildProject(buildRoom(), { maintenanceFactor: 0.65 });
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const [detail] = buildAmbientDetails(snapshot, []);
        expect(detail!.maintenanceFactor).toBe(0.65);
        expect(detail!.maintenanceFactor).not.toBe(DEFAULT_MAINTENANCE_FACTOR);
    });
});

/**
 * Regresión de `planes/plan_cierre_brecha_paridad_dialux_evo.md` §2.1/§5.3:
 * un ambiente sin material/reflectancia asignada se calcula en luz 100%
 * directa (warning `object-without-material-reflectance`), pero la tabla
 * "Grado de reflexión" del PDF mostraba igual "70%/50%/20%" (el fallback de
 * VISUALIZACIÓN, `DEFAULT_REFLECTANCE_*`) como si esos valores hubieran
 * alimentado el cálculo. Comparando Pozuzo (sin material asignado) contra un
 * ambiente equivalente de un informe DIALux evo real, esa tabla sugería
 * reflectancias que el motor nunca usó.
 */
describe('buildAmbientDetails — reflectancia mostrada vs. reflectancia usada por el motor', () => {
    it('sin reflectancia asignada en el room: reflectionCeiling/Wall/Floor son null, no el default de visualización', async () => {
        // El fallback `calculateLightingResult` directo de
        // `buildDialuxExportSnapshot` (sin `calculationRun`) nunca resuelve
        // materiales — hay que pasar por `runProjectLightingCalculation`
        // (interreflexión 'first-bounce', default real de producción) para
        // que el warning `object-without-material-reflectance` exista.
        const project = buildProject(buildRoom());
        const { resultsByRoom, run } = await runProjectLightingCalculation(project);
        expect(run.warnings.map((w) => w.code)).toContain('object-without-material-reflectance');

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom,
            calculationRun: run,
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const [detail] = buildAmbientDetails(snapshot, []);
        expect(detail!.reflectionCeiling).toBeNull();
        expect(detail!.reflectionWall).toBeNull();
        expect(detail!.reflectionFloor).toBeNull();
    });

    it('con reflectancia asignada en el room: muestra los valores reales que el motor usó', () => {
        const room = buildRoom();
        room.ceilingReflectance = 0.7;
        room.wallReflectance = 0.5;
        room.floorReflectance = 0.2;
        const project = buildProject(room);
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig,
        });

        const [detail] = buildAmbientDetails(snapshot, []);
        expect(detail!.reflectionCeiling).toBe(70);
        expect(detail!.reflectionWall).toBe(50);
        expect(detail!.reflectionFloor).toBe(20);
    });
});
