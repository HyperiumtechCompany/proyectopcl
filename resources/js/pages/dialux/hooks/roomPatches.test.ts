import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import { buildRoomEnclosurePatches, clampReflectance } from './roomPatches';
import type { Room } from './types';

function buildSquareRoom(side = 4, height = 3): Room {
    return {
        id: 'patches-room',
        name: 'Recinto de prueba — parches',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: side, y: 0 },
            { x: side, y: side },
            { x: 0, y: side },
        ],
        height,
        color: '#000000',
    };
}

describe('Fase 7 — clampReflectance', () => {
    it('deja pasar valores dentro de [0,1] sin cambios', () => {
        expect(clampReflectance(0.5)).toBe(0.5);
        expect(clampReflectance(0)).toBe(0);
        expect(clampReflectance(1)).toBe(1);
    });

    it('recorta valores fuera de rango', () => {
        expect(clampReflectance(1.5)).toBe(1);
        expect(clampReflectance(-0.3)).toBe(0);
    });

    it('trata NaN/Infinity como 0 (sin reflexión) en vez de propagar valores inválidos', () => {
        expect(clampReflectance(NaN)).toBe(0);
        expect(clampReflectance(Infinity)).toBe(0);
        expect(clampReflectance(-Infinity)).toBe(0);
    });
});

describe('Fase 7 — buildRoomEnclosurePatches', () => {
    it('genera piso + techo + una pared por arista, con la reflectancia asignada por tipo de superficie', () => {
        const room = buildSquareRoom(4, 3);
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0.7, wall: 0.5, floor: 0.2 });

        expect(patches).toHaveLength(2 + 4); // piso, techo, 4 paredes de un cuadrado

        const floor = patches[0]!;
        const ceiling = patches[1]!;
        expect(floor.area).toBeCloseTo(16, 9); // 4x4
        expect(floor.z).toBe(0);
        expect(floor.normal).toEqual({ x: 0, y: 0, z: 1 });
        expect(floor.reflectance).toBe(0.2);

        expect(ceiling.area).toBeCloseTo(16, 9);
        expect(ceiling.z).toBe(3);
        expect(ceiling.normal).toEqual({ x: 0, y: 0, z: -1 });
        expect(ceiling.reflectance).toBe(0.7);

        const walls = patches.slice(2);
        for (const wall of walls) {
            expect(wall.area).toBeCloseTo(4 * 3, 9); // lado 4m x altura 3m
            expect(wall.reflectance).toBe(0.5);
            expect(wall.z).toBeCloseTo(1.5, 9);
        }
    });

    it('la normal de cada pared apunta hacia el interior del recinto (hacia el centroide)', () => {
        const room = buildSquareRoom(4, 3); // centroide en (2,2)
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0, wall: 0, floor: 0 });
        const walls = patches.slice(2);

        for (const wall of walls) {
            const towardsCentroid = { x: 2 - wall.x, y: 2 - wall.y };
            const dot = wall.normal.x * towardsCentroid.x + wall.normal.y * towardsCentroid.y;
            expect(dot).toBeGreaterThan(0);
        }
    });

    it('recorta reflectancias fuera de rango pasadas directamente (defensa en profundidad)', () => {
        const room = buildSquareRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 2, wall: -1, floor: NaN });
        expect(patches[0]!.reflectance).toBe(0); // floor: NaN -> 0
        expect(patches[1]!.reflectance).toBe(1); // ceiling: 2 -> 1
        expect(patches[2]!.reflectance).toBe(0); // wall: -1 -> 0
    });

    it('devuelve [] para un recinto sin polígono válido', () => {
        const room = buildSquareRoom();
        room.vertices = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; // solo 2 vértices
        expect(buildRoomEnclosurePatches(room, { ceiling: 0.5, wall: 0.5, floor: 0.5 })).toEqual([]);
    });

    it('devuelve [] para un recinto de altura no positiva', () => {
        const room = buildSquareRoom(4, 0);
        expect(buildRoomEnclosurePatches(room, { ceiling: 0.5, wall: 0.5, floor: 0.5 })).toEqual([]);
    });
});

describe('Fase 7 — buildRoomEnclosurePatches en recintos cóncavos (regresión)', () => {
    /**
     * Recinto en L: el centroide GLOBAL de este polígono cae en (3, 2.71),
     * que está FUERA del polígono (en el "hueco" de la L) — heurísticas que
     * comparan la normal candidata contra la dirección al centroide global
     * (en vez de una propiedad puramente local a cada arista) invierten en
     * silencio la normal de al menos una pared, subestimando su iluminancia
     * sin ningún aviso (hallazgo de la auditoría `dialux-calc-reviewer`).
     */
    function buildLShapedRoom(): Room {
        return {
            id: 'l-shaped-room',
            name: 'Recinto en L — regresión de normales cóncavas',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 2 },
                { x: 2, y: 2 },
                { x: 2, y: 6 },
                { x: 0, y: 6 },
            ],
            height: 3,
            color: '#000000',
        };
    }

    it('cada normal de pared apunta hacia el interior REAL del polígono (verificado con pointInPolygon, no con el centroide global)', () => {
        const room = buildLShapedRoom();
        const patches = buildRoomEnclosurePatches(room, { ceiling: 0, wall: 0, floor: 0 });
        const walls = patches.slice(2);
        expect(walls.length).toBeGreaterThan(0);

        const EPS = 0.05;
        for (const wall of walls) {
            const inside = { x: wall.x + wall.normal.x * EPS, y: wall.y + wall.normal.y * EPS };
            const outside = { x: wall.x - wall.normal.x * EPS, y: wall.y - wall.normal.y * EPS };
            expect(pointInPolygon(inside, room.vertices)).toBe(true);
            expect(pointInPolygon(outside, room.vertices)).toBe(false);
        }
    });
});
