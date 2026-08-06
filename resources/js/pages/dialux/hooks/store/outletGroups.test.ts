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

    it('dos ambientes delimitados por paredes distintas dentro del MISMO recinto no se pisan (regresión: Baño vs Guarderías)', () => {
        const store = useEditorStore.getState();
        // Mismo roomId físico ("room-shared"), dos paredes distintas
        // delimitan dos ambientes normativos independientes.
        store.replaceGeneratedOutletsForRoom('room-shared', [outlet('room-shared', 'BANO-01')], 'wall-bano');
        store.replaceGeneratedOutletsForRoom('room-shared', [outlet('room-shared', 'GUARD-01')], 'wall-guarderias');

        let devices = useEditorStore.getState().activeScene()?.electricalDevices ?? [];
        expect(devices.filter((d) => d.ambientId === 'wall-bano').map((d) => d.label)).toEqual(['BANO-01']);
        expect(devices.filter((d) => d.ambientId === 'wall-guarderias').map((d) => d.label)).toEqual(['GUARD-01']);
        // `wallId` (snap 3D) no debe verse afectado — no se fija en el generador.
        expect(devices.every((d) => d.wallId === undefined)).toBe(true);

        // Regenerar "Guarderías" NO debe tocar los tomacorrientes de "Baño".
        store.replaceGeneratedOutletsForRoom('room-shared', [outlet('room-shared', 'GUARD-NEW-01')], 'wall-guarderias');
        devices = useEditorStore.getState().activeScene()?.electricalDevices ?? [];
        expect(devices.filter((d) => d.ambientId === 'wall-bano').map((d) => d.label)).toEqual(['BANO-01']);
        expect(devices.filter((d) => d.ambientId === 'wall-guarderias').map((d) => d.label)).toEqual(['GUARD-NEW-01']);

        // Eliminar el conjunto de "Baño" tampoco debe tocar "Guarderías".
        store.removeGeneratedOutletsForRoom('room-shared', 'wall-bano');
        devices = useEditorStore.getState().activeScene()?.electricalDevices ?? [];
        expect(devices.some((d) => d.ambientId === 'wall-bano')).toBe(false);
        expect(devices.filter((d) => d.ambientId === 'wall-guarderias').map((d) => d.label)).toEqual(['GUARD-NEW-01']);
    });
});
