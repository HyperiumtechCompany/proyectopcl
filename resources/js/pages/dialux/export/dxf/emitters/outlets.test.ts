import { describe, expect, it } from 'vitest';
import type { ElectricalDevice, JunctionBox } from '@/pages/dialux/hooks/types';
import { renderElectricalDeviceEntities, renderJunctionBoxEntities } from './outlets';

describe('renderElectricalDeviceEntities / renderJunctionBoxEntities', () => {
    it('dibujan el símbolo real de la Fase 5 para cada dispositivo, con su propia etiqueta', () => {
        const devices: ElectricalDevice[] = [
            { id: 'd1', type: 'outlet_floor', x: 0, y: 0, label: 'T-01', mountingHeight: 0.4, connectedDeviceIds: [], properties: {} },
            { id: 'd2', type: 'main_panel', x: 1, y: 1, label: 'TG', mountingHeight: 1.8, connectedDeviceIds: [], properties: {} },
        ];
        const jboxes: JunctionBox[] = [{ id: 'j1', x: 2, y: 2, size: '100x100x50' }];

        const out: string[] = [];
        renderElectricalDeviceEntities(out, 'DISP_ELECTRICOS', devices);
        renderJunctionBoxEntities(out, 'DISP_ELECTRICOS', jboxes);

        const dxf = out.join('\n');
        expect(dxf).toContain('T-01');
        expect(dxf).toContain('TG');
        expect(dxf).toContain('1\nC'); // caja de pase
    });
});
