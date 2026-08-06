import { describe, expect, it } from 'vitest';
import type { Fixture, Room, Wall } from '@/pages/dialux/hooks/useEditorStore';
import {
    resolveFixtureRenderHeight,
    resolveRoomCeilingHeight,
} from './fixtureHeights';

const room = {
    id: 'room-1',
    name: 'Aula',
    vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
    ],
    height: 2.7,
    color: '#ffffff',
} satisfies Room;

const fixture = {
    id: 'fixture-1',
    name: 'Panel',
    x: 2,
    y: 2,
    z: 2.8,
    lumens: 4000,
    efficiency: 0.8,
    fixtureType: 'surface',
    fixtureShape: 'round',
    lightColor: '#fff5e1',
} satisfies Fixture;

describe('fixtureHeights', () => {
    it('uses wall height as the visible ceiling when walls are lower than the room', () => {
        const walls = [
            {
                id: 'wall-1',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                ],
                thickness: 0.15,
                height: 2.4,
            },
        ] satisfies Wall[];

        expect(resolveRoomCeilingHeight(room, walls)).toBe(2.4);
    });

    it('ignora una pared MUCHO más baja que el recinto (dato sin sincronizar, no techo rebajado real)', () => {
        const tallRoom: Room = { ...room, height: 4.67 };
        const unsyncedWalls = [
            {
                id: 'wall-1',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                ],
                thickness: 0.15,
                height: 2.78, // altura por defecto al dibujar, nunca actualizada a 4.67
            },
        ] satisfies Wall[];

        expect(resolveRoomCeilingHeight(tallRoom, unsyncedWalls)).toBe(4.67);
    });

    it('keeps fixtures below the visible ceiling', () => {
        expect(resolveFixtureRenderHeight(fixture, 2.4)).toBeCloseTo(2.32);
    });

    it('drops pendant fixtures further below the ceiling', () => {
        expect(
            resolveFixtureRenderHeight(
                { ...fixture, fixtureType: 'pendant' },
                2.4,
            ),
        ).toBeCloseTo(1.95);
    });
});
