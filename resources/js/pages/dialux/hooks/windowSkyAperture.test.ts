import { describe, expect, it } from 'vitest';
import type { Room, Wall, Window } from './types';
import { buildWindowSkyPatches, resolveWindowMidpointWorld } from './windowSkyAperture';

function buildWall(): Wall {
    return {
        id: 'wall-1',
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ],
        thickness: 0.2,
        height: 2.8,
    };
}

function buildRoomBelowWall(): Room {
    // Recinto por debajo del muro (y < 0) — el exterior/cielo está en +Y.
    return {
        id: 'room-1',
        name: 'Sala',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: -5 },
            { x: 0, y: -5 },
        ],
        height: 2.8,
        color: '#000000',
    };
}

function buildWindow(overrides: Partial<Window> = {}): Window {
    return {
        id: 'window-1',
        wallId: 'wall-1',
        offsetAlongWall: 3,
        width: 2,
        height: 1.2,
        sillHeight: 0.9,
        ...overrides,
    };
}

describe('windowSkyAperture', () => {
    it('genera cols*rows sub-parches por defecto', () => {
        const patches = buildWindowSkyPatches(buildWindow(), buildWall(), buildRoomBelowWall());
        expect(patches).toHaveLength(4 * 3);
    });

    it('respeta una subdivisión personalizada', () => {
        const patches = buildWindowSkyPatches(buildWindow(), buildWall(), buildRoomBelowWall(), 2, 2);
        expect(patches).toHaveLength(4);
    });

    it('el área total de los sub-parches iguala el área de la ventana', () => {
        const window = buildWindow();
        const patches = buildWindowSkyPatches(window, buildWall(), buildRoomBelowWall());
        const totalArea = patches.reduce((sum, p) => sum + p.area, 0);
        expect(totalArea).toBeCloseTo(window.width * window.height, 9);
    });

    it('la normal apunta HACIA el centroide del recinto (hacia adentro, misma convención que EnclosurePatch)', () => {
        const patches = buildWindowSkyPatches(buildWindow(), buildWall(), buildRoomBelowWall());
        // El recinto está en y<0 (debajo del muro en y=0) — "hacia adentro" es -Y.
        for (const patch of patches) {
            expect(patch.normal.y).toBeLessThan(0);
            expect(patch.normal.x).toBeCloseTo(0, 9);
        }
    });

    it('las posiciones quedan dentro del rango de la ventana (offset/ancho y antepecho/alto)', () => {
        const window = buildWindow();
        const patches = buildWindowSkyPatches(window, buildWall(), buildRoomBelowWall());
        for (const patch of patches) {
            expect(patch.x).toBeGreaterThanOrEqual(window.offsetAlongWall);
            expect(patch.x).toBeLessThanOrEqual(window.offsetAlongWall + window.width);
            expect(patch.z).toBeGreaterThanOrEqual(window.sillHeight);
            expect(patch.z).toBeLessThanOrEqual(window.sillHeight + window.height);
        }
    });

    it('resolveWindowMidpointWorld calcula el punto medio en coordenadas del mundo', () => {
        const window = buildWindow(); // offsetAlongWall=3, width=2 → punto medio en x=4
        const midpoint = resolveWindowMidpointWorld(window, buildWall());
        expect(midpoint).toEqual({ x: 4, y: 0 });
    });

    it('resolveWindowMidpointWorld devuelve null si el muro no tiene un segmento válido', () => {
        const brokenWall: Wall = { id: 'wall-2', vertices: [{ x: 0, y: 0 }], thickness: 0.2, height: 2.8 };
        expect(resolveWindowMidpointWorld(buildWindow({ wallId: 'wall-2' }), brokenWall)).toBeNull();
    });

    it('devuelve [] si el muro no tiene un segmento válido', () => {
        const brokenWall: Wall = { id: 'wall-2', vertices: [{ x: 0, y: 0 }], thickness: 0.2, height: 2.8 };
        const patches = buildWindowSkyPatches(buildWindow({ wallId: 'wall-2' }), brokenWall, buildRoomBelowWall());
        expect(patches).toEqual([]);
    });

    it('normal apunta hacia el lado opuesto cuando el recinto está del otro lado del muro', () => {
        const roomAboveWall: Room = {
            id: 'room-2',
            name: 'Sala 2',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 5 },
                { x: 0, y: 5 },
            ],
            height: 2.8,
            color: '#000000',
        };
        const patches = buildWindowSkyPatches(buildWindow(), buildWall(), roomAboveWall);
        for (const patch of patches) {
            expect(patch.normal.y).toBeGreaterThan(0);
        }
    });
});
