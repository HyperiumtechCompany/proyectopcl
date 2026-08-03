import type { Fixture, Room } from '@/pages/dialux/hooks/useEditorStore';

/**
 * Fixture "mediano" de línea base (Fase 0,
 * planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md §17): 1 nivel,
 * 20 recintos, 200 luminarias (10 por recinto). Sirve para benchmarks de
 * cálculo/exportación a escala intermedia y como golden — no representa
 * ningún proyecto real.
 */

const ROOMS_PER_ROW = 5;
const ROOM_ROWS = 4;
const ROOM_WIDTH = 5;
const ROOM_LENGTH = 4;
const ROOM_GAP = 1;
const ROOM_HEIGHT = 3;
const FIXTURES_PER_ROOM = 10;

export interface Fase0MediumAmbient {
    room: Room;
    fixtures: Fixture[];
}

function buildRoom(columnIndex: number, rowIndex: number): Room {
    const x0 = columnIndex * (ROOM_WIDTH + ROOM_GAP);
    const y0 = rowIndex * (ROOM_LENGTH + ROOM_GAP);
    const id = `fase0-medium-room-${rowIndex}-${columnIndex}`;

    return {
        id,
        name: `Ambiente ${rowIndex * ROOMS_PER_ROW + columnIndex + 1}`,
        roomType: 'ambient',
        vertices: [
            { x: x0, y: y0 },
            { x: x0 + ROOM_WIDTH, y: y0 },
            { x: x0 + ROOM_WIDTH, y: y0 + ROOM_LENGTH },
            { x: x0, y: y0 + ROOM_LENGTH },
        ],
        height: ROOM_HEIGHT,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: 500,
        norma: 500,
        fixtureLumens: 3000,
        fixtureFlux: 3000,
        normativeCategory: 'oficinas',
        normativeSection: 'interiores',
        normativeActivity: 'oficina',
        normativeLabel: `Ambiente ${rowIndex * ROOMS_PER_ROW + columnIndex + 1}`,
    };
}

/** 10 luminarias por recinto en grilla 5x2 (columnas x filas). */
function buildFixturesForRoom(room: Room): Fixture[] {
    const minX = room.vertices[0]!.x;
    const minY = room.vertices[0]!.y;
    const cols = 5;
    const rows = 2;
    const fixtures: Fixture[] = [];

    let index = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            index += 1;
            const x = minX + ROOM_WIDTH * ((col + 0.5) / cols);
            const y = minY + ROOM_LENGTH * ((row + 0.5) / rows);
            fixtures.push({
                id: `${room.id}-fixture-${index}`,
                name: 'Panel LED 60x60',
                x,
                y,
                z: ROOM_HEIGHT - 0.1,
                lumens: 3000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: `${room.id}::ambient-1`,
                power: 30,
            });
        }
    }

    return fixtures;
}

/** 20 ambientes (5x4), 10 luminarias cada uno = 200 luminarias en total. */
export function buildFase0MediumAmbients(): Fase0MediumAmbient[] {
    const ambients: Fase0MediumAmbient[] = [];

    for (let rowIndex = 0; rowIndex < ROOM_ROWS; rowIndex++) {
        for (let columnIndex = 0; columnIndex < ROOMS_PER_ROW; columnIndex++) {
            const room = buildRoom(columnIndex, rowIndex);
            ambients.push({ room, fixtures: buildFixturesForRoom(room) });
        }
    }

    return ambients;
}

export const FASE0_MEDIUM_EXPECTED_ROOM_COUNT = ROOMS_PER_ROW * ROOM_ROWS;
export const FASE0_MEDIUM_EXPECTED_FIXTURE_COUNT =
    FASE0_MEDIUM_EXPECTED_ROOM_COUNT * FIXTURES_PER_ROOM;
