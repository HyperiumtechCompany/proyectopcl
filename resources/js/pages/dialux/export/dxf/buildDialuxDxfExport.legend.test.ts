import { describe, expect, it } from 'vitest';
import type { Conductor, ElectricalDevice } from '@/pages/dialux/hooks/types';
import { usedElectricalLegendItems } from './buildDialuxDxfExport';

describe('DXF electrical legend', () => {
    it('incluye solo los símbolos usados y el espesor/calibre del cable', () => {
        const outlet = {
            id: 't1', type: 'outlet_floor', x: 0, y: 0, label: 'T-01', mountingHeight: 0.4,
            connectedDeviceIds: [], properties: {},
        } satisfies ElectricalDevice;
        const conductor = {
            id: 'c1', sourceId: 't1', targetId: 'tg', wireCount: 3,
            routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH',
            sectionMm2: 4, waypoints: [],
        } satisfies Conductor;

        const rows = usedElectricalLegendItems([], [], [outlet], [conductor]);
        expect(rows.map((row) => row.code)).toContain('T');
        expect(rows.map((row) => row.code)).not.toContain('TG');
        expect(rows.map((row) => row.label)).toContain('Cu LSOH · 4 mm² (AWG 12)');
    });
});
