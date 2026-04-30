import { describe, expect, it } from 'vitest';
import {
    buildRoomLightingInputs,
    getRoomMarginalZone,
    getRoomUsefulPlaneHeight,
} from './roomLighting';
import type { Room } from './types';

const baseRoom = {
    id: 'room-1',
    name: 'Guardiania',
    vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
    ],
    height: 2.7,
    color: '#ffffff',
} satisfies Room;

describe('roomLighting', () => {
    it('uses a floor-level useful plane for corridor-like ambients', () => {
        const corridor = {
            ...baseRoom,
            name: 'PASILLO',
            vertices: [
                { x: 0, y: 0 },
                { x: 8, y: 0 },
                { x: 8, y: 1.72 },
                { x: 0, y: 1.72 },
            ],
        } satisfies Room;

        expect(getRoomUsefulPlaneHeight(corridor)).toBe(0);
        expect(getRoomMarginalZone(corridor)).toBe(0.086);
        expect(buildRoomLightingInputs(corridor, []).usefulPlaneHeight).toBe(0);
    });

    it('uses a floor-level useful plane for corridor room type even when renamed', () => {
        const corridor = {
            ...baseRoom,
            name: 'Zona A',
            roomType: 'corridor',
        } satisfies Room;

        expect(getRoomUsefulPlaneHeight(corridor)).toBe(0);
        expect(buildRoomLightingInputs(corridor, []).usefulPlaneHeight).toBe(0);
    });

    it('uses desk-level useful plane for regular rooms unless explicitly overridden', () => {
        expect(getRoomUsefulPlaneHeight(baseRoom)).toBe(0.8);
        expect(
            getRoomUsefulPlaneHeight({ ...baseRoom, usefulPlaneHeight: 0.75 }),
        ).toBe(0.75);
    });
});
