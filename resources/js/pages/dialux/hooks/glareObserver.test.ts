import { describe, expect, it } from 'vitest';
import { buildDefaultObservers, DEFAULT_UGR_EYE_HEIGHT } from './glareObserver';
import type { Room } from './types';

function buildSquareRoom(): Room {
    return {
        id: 'glare-observer-room',
        name: 'Recinto de prueba — observadores',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3,
        color: '#000000',
    };
}

describe('Fase 9 — buildDefaultObservers', () => {
    it('genera 4 observadores en el punto medio de cada pared, mirando hacia adentro (no en el centroide)', () => {
        const room = buildSquareRoom();
        const observers = buildDefaultObservers(room);

        expect(observers).toHaveLength(4);
        expect(new Set(observers.map((o) => o.viewDirectionDeg))).toEqual(new Set([0, 90, 180, 270]));

        const byDirection = new Map(observers.map((o) => [o.viewDirectionDeg, o]));
        // Pared izquierda (x=0), mirando hacia +X.
        expect(byDirection.get(0)).toMatchObject({ x: 0, y: 2 });
        // Pared derecha (x=4), mirando hacia -X.
        expect(byDirection.get(180)).toMatchObject({ x: 4, y: 2 });
        // Pared inferior (y=0), mirando hacia +Y.
        expect(byDirection.get(90)).toMatchObject({ x: 2, y: 0 });
        // Pared superior (y=4), mirando hacia -Y.
        expect(byDirection.get(270)).toMatchObject({ x: 2, y: 4 });
        for (const observer of observers) {
            expect(observer.eyeHeight).toBe(DEFAULT_UGR_EYE_HEIGHT);
        }
    });

    it('acepta una altura de ojo personalizada', () => {
        const room = buildSquareRoom();
        const observers = buildDefaultObservers(room, 1.5);
        expect(observers.every((o) => o.eyeHeight === 1.5)).toBe(true);
    });

    it('devuelve [] para un recinto sin polígono válido', () => {
        const room = buildSquareRoom();
        room.vertices = [];
        expect(buildDefaultObservers(room)).toEqual([]);
    });
});
