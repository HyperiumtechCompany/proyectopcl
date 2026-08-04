import { describe, expect, it } from 'vitest';
import {
    deriveAmbientSpaces,
    deriveSceneAmbientSpaces,
    findAmbientSpaceAtPoint,
} from './ambientSpaces';
import { buildRoomLightingInputs } from './roomLighting';
import type { Room, Scene, Wall } from './types';

const corridorRoom = {
    id: 'corridor-1',
    name: 'Pasadizo 1',
    roomType: 'corridor',
    vertices: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 1.5 },
        { x: 0, y: 1.5 },
    ],
    height: 2.7,
    color: 'rgba(59, 130, 246, 0.4)',
    illuminanceLux: 150,
    norma: 150,
} satisfies Room;

const closedWallInsideCorridor = {
    id: 'wall-1',
    vertices: [
        { x: 1, y: 0.25 },
        { x: 2, y: 0.25 },
        { x: 2, y: 1.25 },
        { x: 1, y: 1.25 },
        { x: 1, y: 0.25 },
    ],
    thickness: 0.15,
    height: 2.7,
} satisfies Wall;

describe('ambientSpaces', () => {
    it('derives corridor room type as one ambient without wall-defined splits', () => {
        const ambients = deriveAmbientSpaces(
            corridorRoom,
            [closedWallInsideCorridor],
            [],
        );

        expect(ambients).toHaveLength(1);
        expect(ambients[0]?.id).toBe('corridor-1::ambient-1');
        expect(ambients[0]?.roomId).toBe('corridor-1');
        expect(ambients[0]?.wallId).toBeUndefined();
        expect(ambients[0]?.area).toBe(12);
    });

    it('preserves a manually edited lux value when deriving the result ambient', () => {
        const room = {
            ...corridorRoom,
            normativeStandard: 'en_12464',
            normativeCategory: 'Educacion',
            normativeActivity: 'Aulas para clases nocturnas',
            illuminanceLux: 500,
            norma: 500,
            ambientConfigs: {
                'ambient-1': {
                    name: 'Aula Inicial 1',
                    normativeStandard: 'en_12464',
                    normativeCategory: 'Educacion',
                    activity: 'Aulas para clases nocturnas',
                    illuminanceLux: 300,
                },
            },
        } satisfies Room;

        const [ambient] = deriveAmbientSpaces(room, [], []);
        const calculation = buildRoomLightingInputs(ambient!.room, []);

        expect(ambient?.room.illuminanceLux).toBe(300);
        expect(ambient?.room.norma).toBe(300);
        expect(ambient?.room.normativeLabel).toContain('educación de adultos');
        expect(calculation.illuminanceLux).toBe(300);
        expect(calculation.lumensRequired).toBeGreaterThan(0);
    });

    it('uses the lux already saved on a wall for legacy derived ambients', () => {
        const room = {
            ...corridorRoom,
            id: 'room-legacy',
            roomType: 'room',
            illuminanceLux: 500,
            norma: 500,
        } satisfies Room;
        const wall = {
            ...closedWallInsideCorridor,
            illuminanceLux: 300,
        } satisfies Wall;

        const [ambient] = deriveAmbientSpaces(room, [wall], []);

        expect(ambient?.room.illuminanceLux).toBe(300);
        expect(buildRoomLightingInputs(ambient!.room, []).illuminanceLux).toBe(300);
    });

    it('attaches corridor room type to its containing room as an ambient', () => {
        const parentRoom = {
            ...corridorRoom,
            id: 'module-1',
            name: 'Modulo 1',
            roomType: 'room',
            vertices: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 5 },
                { x: 0, y: 5 },
            ],
        } satisfies Room;
        const scene = {
            id: 'scene-1',
            name: 'Planta',
            scaleConfig: {
                unit: 'm',
                factor: 1,
                displayUnit: 'Metros (1 = 1m)',
                calibrationFactor: 1,
                isCalibrated: false,
            },
            rooms: [parentRoom, corridorRoom],
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: [],
        } satisfies Scene;

        const ambients = deriveSceneAmbientSpaces(scene);
        const corridorAmbient = ambients.find(
            (ambient) => ambient.sourceRoom.id === corridorRoom.id,
        );

        expect(corridorAmbient?.roomId).toBe('module-1');
        expect(corridorAmbient?.roomName).toBe('Modulo 1');
        expect(corridorAmbient?.id).toBe('module-1::corridor-1::ambient-1');
        expect(
            findAmbientSpaceAtPoint(scene, { x: 4, y: 0.75 })?.id,
        ).toBe('module-1::corridor-1::ambient-1');
    });

    it.each(['evacuation-route', 'antipanic-area'] as const)(
        'derives %s room type as one ambient without wall-defined splits (Fase 16)',
        (roomType) => {
            const room = { ...corridorRoom, id: `emergency-1`, roomType } satisfies Room;

            const ambients = deriveAmbientSpaces(
                room,
                [closedWallInsideCorridor],
                [],
            );

            expect(ambients).toHaveLength(1);
            expect(ambients[0]?.roomId).toBe('emergency-1');
            expect(ambients[0]?.wallId).toBeUndefined();
            expect(ambients[0]?.area).toBe(12);
        },
    );
});
