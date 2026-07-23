import { describe, expect, it } from 'vitest';
import type { Conductor, ElectricalDevice, JunctionBox } from '@/pages/dialux/hooks/types';
import type { DxfDisciplineEntities } from '../domain/types';
import { buildOutletLegendRows } from './buildOutletLegendRows';

/**
 * Fase 7 del plan maestro DXF: leyenda de tomacorrientes. Criterio de cierre
 * — la leyenda describe fielmente las tomas visibles y no mezcla símbolos
 * de iluminación.
 */

function entities(overrides: Partial<DxfDisciplineEntities> = {}): DxfDisciplineEntities {
    return {
        discipline: 'outlets',
        fixtures: [],
        lightSwitches: [],
        electricalDevices: [],
        conductors: [],
        junctionBoxes: [],
        ...overrides,
    };
}

function device(overrides: Partial<ElectricalDevice> & Pick<ElectricalDevice, 'id' | 'type'>): ElectricalDevice {
    return {
        x: 0, y: 0, label: 'T', mountingHeight: 0.4, connectedDeviceIds: [], properties: {},
        ...overrides,
    };
}

describe('buildOutletLegendRows — toma baja y waterproof', () => {
    it('tienen códigos visualmente parecidos pero distintos, y quedan en filas separadas', () => {
        const rows = buildOutletLegendRows(entities({
            electricalDevices: [
                device({ id: 'd1', type: 'outlet_floor' }),
                device({ id: 'd2', type: 'outlet_waterproof', mountingHeight: 1.2 }),
            ],
        }));

        const outletRows = rows.filter((row) => row.kind === 'outlet');
        expect(outletRows).toHaveLength(2);
        const codes = outletRows.map((row) => row.code).sort();
        expect(codes).toEqual(['T', 'T-AP']);
        expect(codes[0]).not.toBe(codes[1]);
        // "Visualmente parecidos": ambos empiezan con la misma letra base.
        expect(codes.every((code) => code.startsWith('T'))).toBe(true);
    });
});

describe('buildOutletLegendRows — mismo tipo con dos alturas', () => {
    it('outlet_floor a 0.40m y a 1.50m produce dos filas distintas con cantidades correctas', () => {
        const rows = buildOutletLegendRows(entities({
            electricalDevices: [
                device({ id: 'd1', type: 'outlet_floor', mountingHeight: 0.4 }),
                device({ id: 'd2', type: 'outlet_floor', mountingHeight: 0.4 }),
                device({ id: 'd3', type: 'outlet_floor', mountingHeight: 1.5 }),
            ],
        }));

        const outletRows = rows.filter((row) => row.kind === 'outlet' && row.code === 'T');
        expect(outletRows).toHaveLength(2);
        const byHeight = new Map(outletRows.map((row) => [row.technicalFields[1], row.quantity]));
        expect(byHeight.get('0.40m')).toBe(2);
        expect(byHeight.get('1.50m')).toBe(1);
    });
});

describe('buildOutletLegendRows — caja sin dimensiones', () => {
    it('un dispositivo sin boxSize propio ni en los defaults no falla: muestra "-"', () => {
        const rows = buildOutletLegendRows(entities({
            // earth_pit no define boxSize ni boxMaterial en ELECTRICAL_DEVICE_DEFAULTS.
            electricalDevices: [
                device({ id: 'd1', type: 'earth_pit', properties: {} }),
            ],
        }));

        expect(rows).toHaveLength(1);
        expect(rows[0]!.technicalFields[0]).toBe('-');
    });

    it('un dispositivo sin boxSize propio pero con default sí lo muestra', () => {
        const rows = buildOutletLegendRows(entities({
            electricalDevices: [
                device({ id: 'd1', type: 'outlet_floor', properties: {} }),
            ],
        }));

        expect(rows[0]!.technicalFields[0]).toContain('100x55x50');
    });
});

describe('buildOutletLegendRows — tablero general y de piso', () => {
    it('main_panel (TG) y sub_panel (TD) son filas "panel" distintas', () => {
        const rows = buildOutletLegendRows(entities({
            electricalDevices: [
                device({ id: 'tg', type: 'main_panel', label: 'TG', mountingHeight: 1.8 }),
                device({ id: 'td', type: 'sub_panel', label: 'TD-01', mountingHeight: 1.8 }),
            ],
        }));

        const panelRows = rows.filter((row) => row.kind === 'panel');
        expect(panelRows).toHaveLength(2);
        expect(panelRows.map((row) => row.code).sort()).toEqual(['TD', 'TG']);
    });
});

describe('buildOutletLegendRows — cableado con varias secciones', () => {
    it('produce una fila distinta por sección de cable', () => {
        const conductors: Conductor[] = [
            { id: 'c1', sourceId: 'a', targetId: 'b', wireCount: 3, routeType: 'floor', tubeSize: 20, conductorType: 'N2XOH', sectionMm2: 4, waypoints: [] },
            { id: 'c2', sourceId: 'a', targetId: 'c', wireCount: 2, routeType: 'floor', tubeSize: 20, conductorType: 'N2XOH', sectionMm2: 6, waypoints: [] },
        ];
        const rows = buildOutletLegendRows(entities({ conductors }));

        const cableRows = rows.filter((row) => row.kind === 'cable');
        expect(cableRows).toHaveLength(2);
    });
});

describe('buildOutletLegendRows — no mezcla símbolos de iluminación', () => {
    it('ignora fixtures/lightSwitches aunque vengan en la entrada (no deberían llegar clasificados así, pero no deben producir filas)', () => {
        const rows = buildOutletLegendRows(entities({
            electricalDevices: [device({ id: 'd1', type: 'outlet_floor' })],
        }));

        expect(rows.every((row) => row.kind !== 'fixture' && row.kind !== 'switch' && row.kind !== 'emergency')).toBe(true);
    });
});

describe('buildOutletLegendRows — caja de pase legacy', () => {
    it('agrupa JunctionBox por tamaño y usa el mismo símbolo (Fase 5 extendida)', () => {
        const junctionBoxes: JunctionBox[] = [
            { id: 'j1', x: 0, y: 0, size: '100x100x50' },
            { id: 'j2', x: 1, y: 1, size: '100x100x50' },
            { id: 'j3', x: 2, y: 2, size: '100x55x50' },
        ];
        const rows = buildOutletLegendRows(entities({ junctionBoxes }));
        const boxRows = rows.filter((row) => row.kind === 'junctionBox');
        expect(boxRows).toHaveLength(2);
        expect(boxRows.every((row) => row.symbolRef?.kind === 'junctionBox')).toBe(true);
    });
});

describe('buildOutletLegendRows — leyenda vacía', () => {
    it('un nivel sin tomacorrientes produce un arreglo vacío', () => {
        expect(buildOutletLegendRows(entities())).toEqual([]);
    });
});
