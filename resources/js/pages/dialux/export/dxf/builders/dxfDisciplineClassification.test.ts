import { describe, expect, it } from 'vitest';
import type {
    Conductor,
    ElectricalDevice,
    Fixture,
    JunctionBox,
    LightSwitch,
    Scene,
} from '@/pages/dialux/hooks/types';
import type { DxfLevelBasePlan } from '../domain/types';
import { buildDxfLevelPackage } from './buildDxfLevelPackage';
import { classifyDxfLevelEntities } from './classifyDxfLevelEntities';
import { buildLightingEntities, buildOutletEntities } from './buildDisciplineEntities';

/**
 * Fase 2 del plan maestro DXF: clasificación por especialidad. Criterio de
 * cierre — cada lámina contiene únicamente su especialidad, y los elementos
 * sin clasificación no se ocultan silenciosamente (siempre traen warning).
 */

const NO_BASE_PLAN: DxfLevelBasePlan = { source: 'none', entities: [], extents: null };

const SCALE_CONFIG = {
    unit: 'm' as const,
    factor: 1,
    displayUnit: 'Metros (1 = 1m)',
    calibrationFactor: 1,
    isCalibrated: false,
};

function makeScene(overrides: {
    fixtures?: Fixture[];
    lightSwitches?: LightSwitch[];
    electricalDevices?: ElectricalDevice[];
    conductors?: Conductor[];
    junctionBoxes?: JunctionBox[];
}): Scene {
    return {
        id: 'scene-1',
        name: 'Nivel de prueba',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: SCALE_CONFIG,
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: overrides.fixtures ?? [],
        lightSwitches: overrides.lightSwitches ?? [],
        conductors: overrides.conductors ?? [],
        junctionBoxes: overrides.junctionBoxes ?? [],
        electricalDevices: overrides.electricalDevices ?? [],
        partitions: [],
    };
}

function classify(overrides: Parameters<typeof makeScene>[0]) {
    const level = buildDxfLevelPackage(makeScene(overrides), NO_BASE_PLAN);
    return { level, classification: classifyDxfLevelEntities(level) };
}

const FIXTURE: Fixture = {
    id: 'fixture-1', name: 'Panel LED', x: 1, y: 1, z: 2.8,
    lumens: 4000, efficiency: 0.8, fixtureType: 'panel', fixtureShape: 'rectangular',
    lightColor: '#fff5e1',
};
const SWITCH: LightSwitch = {
    id: 'switch-1', x: 0.2, y: 1, mountingHeight: 1.4, type: 'single', connectedFixtureIds: ['fixture-1'],
};
const OUTLET: ElectricalDevice = {
    id: 'outlet-1', type: 'outlet_floor', x: 3, y: 0.2, label: 'T-01', mountingHeight: 0.4,
    connectedDeviceIds: [], properties: {},
};
const PANEL: ElectricalDevice = {
    id: 'panel-1', type: 'main_panel', x: 4, y: 4, label: 'TG', mountingHeight: 1.8,
    connectedDeviceIds: [], properties: {},
};

describe('classifyDxfLevelEntities', () => {
    it('luminaria + interruptor + cable de alumbrado → conductor "lighting", sin warnings', () => {
        const conductor: Conductor = {
            id: 'cond-1', sourceId: SWITCH.id, targetId: FIXTURE.id, wireCount: 2,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const { classification } = classify({ fixtures: [FIXTURE], lightSwitches: [SWITCH], conductors: [conductor] });

        expect(classification.conductorDiscipline.get('cond-1')).toBe('lighting');
        expect(classification.warnings).toHaveLength(0);
    });

    it('toma + tablero + cable de tomacorrientes → conductor "outlets"', () => {
        const conductor: Conductor = {
            id: 'cond-2', sourceId: PANEL.id, targetId: OUTLET.id, wireCount: 3,
            routeType: 'floor', tubeSize: 20, conductorType: 'N2XOH', sectionMm2: 4, waypoints: [],
        };
        const { classification } = classify({ electricalDevices: [PANEL, OUTLET], conductors: [conductor] });

        expect(classification.deviceSpecialty.get(PANEL.id)).toBe('shared');
        expect(classification.deviceSpecialty.get(OUTLET.id)).toBe('outlets');
        expect(classification.conductorDiscipline.get('cond-2')).toBe('outlets');
    });

    it('conductor entre especialidades distintas → "unclassified" + warning, excluido de ambos planos', () => {
        const conductor: Conductor = {
            id: 'cond-3', sourceId: FIXTURE.id, targetId: OUTLET.id, wireCount: 2,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const { level, classification } = classify({ fixtures: [FIXTURE], electricalDevices: [OUTLET], conductors: [conductor] });

        expect(classification.conductorDiscipline.get('cond-3')).toBe('unclassified');
        expect(classification.warnings.map((w) => w.code)).toContain('conductor-mixed-disciplines');

        const lighting = buildLightingEntities(level, classification);
        const outlets = buildOutletEntities(level, classification);
        expect(lighting.conductors.map((c) => c.id)).not.toContain('cond-3');
        expect(outlets.conductors.map((c) => c.id)).not.toContain('cond-3');
    });

    it('conductor con endpoint inexistente → "unclassified" + warning de extremo colgante', () => {
        const conductor: Conductor = {
            id: 'cond-4', sourceId: FIXTURE.id, targetId: 'no-existe', wireCount: 2,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const { classification } = classify({ fixtures: [FIXTURE], conductors: [conductor] });

        expect(classification.conductorDiscipline.get('cond-4')).toBe('unclassified');
        expect(classification.warnings.map((w) => w.code)).toContain('conductor-dangling-endpoint');
    });

    it('caja compartida (conectada a alumbrado y tomacorrientes) → "shared" + warning, aparece en ambos planos', () => {
        const box: JunctionBox = { id: 'box-1', x: 2, y: 2, size: '100x100x50' };
        const condToFixture: Conductor = {
            id: 'cond-box-fixture', sourceId: box.id, targetId: FIXTURE.id, wireCount: 2,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const condToOutlet: Conductor = {
            id: 'cond-box-outlet', sourceId: box.id, targetId: OUTLET.id, wireCount: 3,
            routeType: 'floor', tubeSize: 20, conductorType: 'N2XOH', sectionMm2: 4, waypoints: [],
        };
        const { level, classification } = classify({
            fixtures: [FIXTURE], electricalDevices: [OUTLET], junctionBoxes: [box],
            conductors: [condToFixture, condToOutlet],
        });

        expect(classification.junctionBoxSpecialty.get(box.id)).toBe('shared');
        expect(classification.warnings.map((w) => w.code)).toContain('shared-junction-box');
        expect(classification.conductorDiscipline.get('cond-box-fixture')).toBe('lighting');
        expect(classification.conductorDiscipline.get('cond-box-outlet')).toBe('outlets');

        const lighting = buildLightingEntities(level, classification);
        const outlets = buildOutletEntities(level, classification);
        expect(lighting.junctionBoxes.map((b) => b.id)).toContain(box.id);
        expect(outlets.junctionBoxes.map((b) => b.id)).toContain(box.id);
    });

    it('alimentador tablero→tablero (TG→TD) → conductor "shared", aparece en ambos planos (bug real reportado tras exportar)', () => {
        const subPanel: ElectricalDevice = {
            id: 'panel-2', type: 'sub_panel', x: 6, y: 4, label: 'TD-01', mountingHeight: 1.8,
            connectedDeviceIds: [], properties: {},
        };
        const feeder: Conductor = {
            id: 'cond-feeder', sourceId: PANEL.id, targetId: subPanel.id, wireCount: 4,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'N2XOH', sectionMm2: 16, waypoints: [],
        };
        const { level, classification } = classify({ electricalDevices: [PANEL, subPanel], conductors: [feeder] });

        expect(classification.conductorDiscipline.get('cond-feeder')).toBe('shared');
        expect(classification.warnings.map((w) => w.code)).not.toContain('conductor-inconclusive-endpoints');

        const lighting = buildLightingEntities(level, classification);
        const outlets = buildOutletEntities(level, classification);
        expect(lighting.conductors.map((c) => c.id)).toContain('cond-feeder');
        expect(outlets.conductors.map((c) => c.id)).toContain('cond-feeder');
    });

    it('dispositivo desconocido (fuera de alumbrado/tomacorrientes) → "unclassified" + warning, no se oculta', () => {
        const unknownDevice: ElectricalDevice = {
            id: 'earth-1', type: 'earth_pit', x: 5, y: 5, label: 'PAT', mountingHeight: 0,
            connectedDeviceIds: [], properties: {},
        };
        const { level, classification } = classify({ electricalDevices: [unknownDevice] });

        expect(classification.deviceSpecialty.get(unknownDevice.id)).toBe('unclassified');
        expect(classification.warnings.map((w) => w.code)).toContain('unknown-device-type');

        const lighting = buildLightingEntities(level, classification);
        const outlets = buildOutletEntities(level, classification);
        expect(lighting.electricalDevices.map((d) => d.id)).not.toContain(unknownDevice.id);
        expect(outlets.electricalDevices.map((d) => d.id)).not.toContain(unknownDevice.id);
        // No se oculta en silencio: sigue en el nivel crudo y hay un warning explicando por qué no aparece.
        expect(level.electrical.electricalDevices.map((d) => d.id)).toContain(unknownDevice.id);
    });
});

describe('buildLightingEntities / buildOutletEntities', () => {
    it('el tablero compartido aparece en ambas láminas, la luminaria solo en alumbrado', () => {
        const lightingConductor: Conductor = {
            id: 'cond-light', sourceId: SWITCH.id, targetId: FIXTURE.id, wireCount: 2,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [],
        };
        const outletConductor: Conductor = {
            id: 'cond-outlet', sourceId: PANEL.id, targetId: OUTLET.id, wireCount: 3,
            routeType: 'floor', tubeSize: 20, conductorType: 'N2XOH', sectionMm2: 4, waypoints: [],
        };
        const { level, classification } = classify({
            fixtures: [FIXTURE], lightSwitches: [SWITCH],
            electricalDevices: [PANEL, OUTLET], conductors: [lightingConductor, outletConductor],
        });

        const lighting = buildLightingEntities(level, classification);
        const outlets = buildOutletEntities(level, classification);

        expect(lighting.fixtures.map((f) => f.id)).toEqual(['fixture-1']);
        expect(lighting.electricalDevices.map((d) => d.id)).toEqual(['panel-1']);
        expect(lighting.conductors.map((c) => c.id)).toEqual(['cond-light']);

        expect(outlets.fixtures).toHaveLength(0);
        expect(outlets.lightSwitches).toHaveLength(0);
        expect(outlets.electricalDevices.map((d) => d.id).sort()).toEqual(['outlet-1', 'panel-1']);
        expect(outlets.conductors.map((c) => c.id)).toEqual(['cond-outlet']);
    });
});
