import type { Fixture, Room } from '@/pages/dialux/hooks/useEditorStore';

/**
 * Fixture "pequeño" de línea base (Fase 0,
 * planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md §17): 1 recinto,
 * 4 luminarias. Sirve para benchmarks rápidos y como golden mínimo de
 * `calculateLightingResult` — no representa ningún proyecto real.
 */

const ROOM_WIDTH = 6;
const ROOM_LENGTH = 4;
const ROOM_HEIGHT = 3;

export function buildFase0SmallRoom(): Room {
    return {
        id: 'fase0-small-room',
        name: 'Oficina de referencia',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: ROOM_WIDTH, y: 0 },
            { x: ROOM_WIDTH, y: ROOM_LENGTH },
            { x: 0, y: ROOM_LENGTH },
        ],
        height: ROOM_HEIGHT,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: 500,
        norma: 500,
        fixtureLumens: 4000,
        fixtureFlux: 4000,
        normativeCategory: 'oficinas',
        normativeSection: 'interiores',
        normativeActivity: 'oficina',
        normativeLabel: 'Oficina de referencia',
    };
}

/** 4 luminarias en grilla 2x2, separadas 1/4 y 3/4 del ancho/largo del recinto. */
export function buildFase0SmallFixtures(): Fixture[] {
    const xs = [ROOM_WIDTH * 0.25, ROOM_WIDTH * 0.75];
    const ys = [ROOM_LENGTH * 0.25, ROOM_LENGTH * 0.75];
    const fixtures: Fixture[] = [];

    let index = 0;
    for (const y of ys) {
        for (const x of xs) {
            index += 1;
            fixtures.push({
                id: `fase0-small-fixture-${index}`,
                name: 'Panel LED 60x60',
                x,
                y,
                z: ROOM_HEIGHT - 0.1,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: 'fase0-small-room::ambient-1',
                power: 40,
            });
        }
    }

    return fixtures;
}
