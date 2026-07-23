import { beforeEach, describe, expect, it } from 'vitest';
import type { Project, Scene } from '../types';
import { useEditorStore } from '../useEditorStore';

const outlet = (roomId: string, label: string) => ({
    type: 'outlet_floor' as const,
    x: 1,
    y: 1,
    label,
    mountingHeight: 0.4,
    roomId,
    generatedBy: 'outlet-rule' as const,
    connectedDeviceIds: [],
    properties: {},
});

describe('grupos de tomacorrientes por ambiente', () => {
    beforeEach(() => {
        const scene = {
            id: 'scene-1',
            name: 'Nivel 1',
            rooms: [],
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: [],
            lightSwitches: [],
            partitions: [],
            electricalDevices: [],
            conductors: [],
        } as unknown as Scene;
        useEditorStore.setState({
            project: { id: 'project-1', name: 'Proyecto', scenes: [scene] } as Project,
            activeSceneId: scene.id,
        });
    });

    it('regenerar un ambiente conserva íntegro el grupo de otro ambiente', () => {
        const store = useEditorStore.getState();
        store.replaceGeneratedOutletsForRoom('room-a', [outlet('room-a', 'TA-01')]);
        store.replaceGeneratedOutletsForRoom('room-b', [outlet('room-b', 'TB-01')]);
        store.replaceGeneratedOutletsForRoom('room-a', [outlet('room-a', 'TA-NEW-01'), outlet('room-a', 'TA-NEW-02')]);

        const devices = useEditorStore.getState().activeScene()?.electricalDevices ?? [];
        expect(devices.filter((device) => device.roomId === 'room-a').map((device) => device.label)).toEqual(['TA-NEW-01', 'TA-NEW-02']);
        expect(devices.filter((device) => device.roomId === 'room-b').map((device) => device.label)).toEqual(['TB-01']);
    });

    it('cambia y elimina únicamente el conjunto del ambiente indicado', () => {
        const store = useEditorStore.getState();
        store.replaceGeneratedOutletsForRoom('room-a', [outlet('room-a', 'TA-01')]);
        store.replaceGeneratedOutletsForRoom('room-b', [outlet('room-b', 'TB-01')]);
        store.updateGeneratedOutletsForRoom('room-a', { type: 'outlet_high_180', mountingHeight: 1.8 });

        let devices = useEditorStore.getState().activeScene()?.electricalDevices ?? [];
        expect(devices.find((device) => device.roomId === 'room-a')?.type).toBe('outlet_high_180');
        expect(devices.find((device) => device.roomId === 'room-b')?.type).toBe('outlet_floor');

        useEditorStore.getState().removeGeneratedOutletsForRoom('room-a');
        devices = useEditorStore.getState().activeScene()?.electricalDevices ?? [];
        expect(devices.some((device) => device.roomId === 'room-a')).toBe(false);
        expect(devices.some((device) => device.roomId === 'room-b')).toBe(true);
    });
});
