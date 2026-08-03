import { describe, expect, it } from 'vitest';
import { ensureFloorPanelHierarchy } from './panelHierarchy';
import type { ElectricalDocument } from './types';

function document(): ElectricalDocument {
    return {
        version: 1,
        settings: {
            voltageV: 220,
            phases: 1,
            frequencyHz: 60,
            powerFactor: 0.9,
            referenceStandard: 'pendiente',
            cableReserveFactor: 1.1,
            installationCategory: 'educativa',
        },
        floors: [
            { id: 'p1', name: 'Piso 1', level: 1 },
            { id: 'p2', name: 'Piso 2', level: 2 },
            { id: 'p3', name: 'Piso 3', level: 3 },
        ],
        rooms: [],
        luminaireTypes: [],
        roomLuminaires: [],
        roomOutlets: [],
        circuits: [],
        panels: [],
        feeders: [],
    };
}

describe('ensureFloorPanelHierarchy', () => {
    it('crea un único TG, un tablero por piso y sus alimentadores', () => {
        let id = 0;
        const result = ensureFloorPanelHierarchy(document(), () => `id-${++id}`);

        const roots = result.panels.filter((panel) => panel.parentPanelId === null);
        expect(roots).toHaveLength(1);
        expect(roots[0].code).toBe('TG-01');
        expect(result.panels).toHaveLength(4);
        expect(result.feeders).toHaveLength(3);

        for (const floor of result.floors) {
            const panel = result.panels.find(
                (candidate) => candidate.floorId === floor.id && candidate.id !== roots[0].id,
            );
            expect(panel?.parentPanelId).toBe(roots[0].id);
            expect(result.feeders.some((feeder) => feeder.toPanelId === panel?.id)).toBe(true);
        }
    });

    it('es idempotente y no duplica tableros ni alimentadores', () => {
        let id = 0;
        const once = ensureFloorPanelHierarchy(document(), () => `id-${++id}`);
        const twice = ensureFloorPanelHierarchy(once, () => `id-${++id}`);

        expect(twice.panels).toHaveLength(once.panels.length);
        expect(twice.feeders).toHaveLength(once.feeders.length);
    });
});

