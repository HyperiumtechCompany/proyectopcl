import { describe, expect, it } from 'vitest';
import { computeAdaptiveGridSpacing } from './adaptiveGridSpacing';
import type { Fixture, Room } from './useEditorStore';

const BASE_SPACING = 0.5;

function buildRoom(overrides: Partial<Room> = {}): Room {
    return {
        id: 'room-1',
        name: 'Recinto de prueba',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: 300,
        norma: 300,
        ...overrides,
    };
}

function buildFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'fixture-1',
        name: 'Panel LED',
        x: 5,
        y: 5,
        z: 2.9,
        lumens: 3000,
        efficiency: 0.8,
        fixtureType: 'panel',
        fixtureShape: 'rectangular',
        lightColor: '#ffffff',
        ...overrides,
    };
}

describe('computeAdaptiveGridSpacing', () => {
    it('sin luminarias (recinto uniforme en 0 lux) devuelve el espaciado base sin cambios', () => {
        const room = buildRoom();

        const spacing = computeAdaptiveGridSpacing(room, [], 0.8, [], BASE_SPACING);

        expect(spacing).toBe(BASE_SPACING);
    });

    it('recinto con una luminaria pegada a una esquina (gradiente fuerte) devuelve un espaciado más fino', () => {
        const room = buildRoom();
        // Luminaria montada cerca del techo (igual que en un proyecto real)
        // pero pegada a una esquina: los puntos cercanos reciben mucha más
        // luz que la esquina opuesta, a 13+ m de distancia horizontal.
        const fixtures = [buildFixture({ x: 0.3, y: 0.3, z: 2.9 })];

        const spacing = computeAdaptiveGridSpacing(room, fixtures, 0.8, [], BASE_SPACING);

        expect(spacing).toBeLessThan(BASE_SPACING);
        expect(spacing).toBeGreaterThanOrEqual(0.1);
    });

    it('nunca devuelve un espaciado más grueso que el base (solo afina)', () => {
        const room = buildRoom();
        // Luminaria centrada y muy alta: iluminación bastante pareja, pero
        // nunca perfectamente uniforme por la ley del inverso del cuadrado.
        const fixtures = [buildFixture({ x: 5, y: 5, z: 2.9 })];

        const spacing = computeAdaptiveGridSpacing(room, fixtures, 0.8, [], BASE_SPACING);

        expect(spacing).toBeLessThanOrEqual(BASE_SPACING);
    });

    it('recinto degenerado (malla de sondeo con menos de 2 puntos activos) devuelve el espaciado base', () => {
        const room = buildRoom({
            vertices: [
                { x: 0, y: 0 },
                { x: 0.05, y: 0 },
                { x: 0.05, y: 0.05 },
                { x: 0, y: 0.05 },
            ],
        });
        const fixtures = [buildFixture({ x: 0.025, y: 0.025, z: 0.5 })];

        const spacing = computeAdaptiveGridSpacing(room, fixtures, 0.1, [], BASE_SPACING);

        expect(spacing).toBe(BASE_SPACING);
    });

    it('recinto tipo pasillo se salta el refinamiento aunque tenga gradiente fuerte', () => {
        const room = buildRoom({ roomType: 'corridor' });
        const fixtures = [buildFixture({ x: 0.3, y: 0.3, z: 0.5 })];

        const spacing = computeAdaptiveGridSpacing(room, fixtures, 0, [], BASE_SPACING);

        expect(spacing).toBe(BASE_SPACING);
    });

    it('espaciado base inválido (0) se devuelve tal cual', () => {
        const room = buildRoom();

        expect(computeAdaptiveGridSpacing(room, [], 0.8, [], 0)).toBe(0);
    });
});
