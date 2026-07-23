import type { Project, Room, Scene } from '@/pages/dialux/hooks/useEditorStore';

/**
 * Fixture de referencia para el plan de réplica del informe MÓDULO I:
 * 3 niveles × 8 ambientes (2 aulas + circulación + hall de escalera + hall de
 * SS.HH. + SS.HH. acceso universal + SS.HH. mujeres + SS.HH. varones), igual
 * a la estructura descrita en planes/plan_replica_informe_luminotecnico_modulo_i.md
 * (sección 2.4). Se usa para probar paginación, TOC y agregados con un
 * proyecto de tamaño comparable al de referencia (24 ambientes), sin datos
 * reales de ningún proyecto.
 */

interface RoomSpec {
    id: string;
    name: string;
    illuminanceLux: number;
    fixtureLumens: number;
    columnIndex: number;
    rowIndex: number;
}

const ROOM_WIDTH = 5;
const ROOM_HEIGHT = 4;
const ROOM_GAP = 1;
const LEVEL_INTERIOR_HEIGHT = 3.2;

const AULA_NAMES_BY_LEVEL: readonly [string, string][] = [
    ['Aula 1° Primaria', 'Aula 2° Primaria'],
    ['Aula 3° Primaria', 'Aula 4° Primaria'],
    ['Aula 5° Primaria', 'Aula 6° Primaria'],
];

function buildLevelRoomSpecs(levelIndex: number): RoomSpec[] {
    const [aulaAName, aulaBName] = AULA_NAMES_BY_LEVEL[levelIndex]!;

    return [
        {
            id: `l${levelIndex}-aula-a`,
            name: aulaAName,
            illuminanceLux: 500,
            fixtureLumens: 4000,
            columnIndex: 0,
            rowIndex: 0,
        },
        {
            id: `l${levelIndex}-aula-b`,
            name: aulaBName,
            illuminanceLux: 500,
            fixtureLumens: 4000,
            columnIndex: 1,
            rowIndex: 0,
        },
        {
            id: `l${levelIndex}-circulacion`,
            name: 'Circulación',
            illuminanceLux: 150,
            fixtureLumens: 3000,
            columnIndex: 2,
            rowIndex: 0,
        },
        {
            id: `l${levelIndex}-hall-escalera`,
            name: 'Hall de Escalera',
            illuminanceLux: 150,
            fixtureLumens: 2400,
            columnIndex: 3,
            rowIndex: 0,
        },
        {
            id: `l${levelIndex}-hall-sshh`,
            name: 'Hall de Servicios Higiénicos',
            illuminanceLux: 150,
            fixtureLumens: 2000,
            columnIndex: 0,
            rowIndex: 1,
        },
        {
            id: `l${levelIndex}-sshh-universal`,
            name: 'SS.HH. Acceso Universal Niños',
            illuminanceLux: 200,
            fixtureLumens: 2000,
            columnIndex: 1,
            rowIndex: 1,
        },
        {
            id: `l${levelIndex}-sshh-mujeres`,
            name: 'SS.HH. Mujeres',
            illuminanceLux: 200,
            fixtureLumens: 2400,
            columnIndex: 2,
            rowIndex: 1,
        },
        {
            id: `l${levelIndex}-sshh-varones`,
            name: 'SS.HH. Varones',
            illuminanceLux: 200,
            fixtureLumens: 2400,
            columnIndex: 3,
            rowIndex: 1,
        },
    ];
}

function buildRoomFromSpec(spec: RoomSpec): Room {
    const x0 = spec.columnIndex * (ROOM_WIDTH + ROOM_GAP);
    const y0 = spec.rowIndex * (ROOM_HEIGHT + ROOM_GAP);

    return {
        id: spec.id,
        name: spec.name,
        vertices: [
            { x: x0, y: y0 },
            { x: x0 + ROOM_WIDTH, y: y0 },
            { x: x0 + ROOM_WIDTH, y: y0 + ROOM_HEIGHT },
            { x: x0, y: y0 + ROOM_HEIGHT },
        ],
        height: LEVEL_INTERIOR_HEIGHT,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: spec.illuminanceLux,
        norma: spec.illuminanceLux,
        fixtureLumens: spec.fixtureLumens,
        fixtureFlux: spec.fixtureLumens,
        normativeCategory: 'educacion',
        normativeSection: 'interiores',
        normativeActivity: 'aula',
        normativeLabel: spec.name,
    };
}

function buildLevelScene(levelIndex: number): Scene {
    const roomSpecs = buildLevelRoomSpecs(levelIndex);
    const rooms = roomSpecs.map(buildRoomFromSpec);

    return {
        id: `l${levelIndex}-scene`,
        name: `${levelIndex + 1}° Nivel`,
        floorIndex: levelIndex,
        floorElevation: levelIndex * LEVEL_INTERIOR_HEIGHT,
        floorHeight: LEVEL_INTERIOR_HEIGHT,
        lightSwitches: [],
        partitions: [],
        scaleConfig: {
            unit: 'm',
            factor: 1,
            displayUnit: 'Metros (1 = 1m)',
            calibrationFactor: 1,
            isCalibrated: false,
        },
        rooms,
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: roomSpecs.map((spec, index) => {
            const room = rooms[index]!;
            const centerX =
                (room.vertices[0]!.x + room.vertices[1]!.x) / 2;
            const centerY =
                (room.vertices[0]!.y + room.vertices[2]!.y) / 2;

            return {
                id: `${spec.id}-fixture-1`,
                name: 'Panel LED 60x60',
                x: centerX,
                y: centerY,
                z: LEVEL_INTERIOR_HEIGHT - 0.1,
                lumens: spec.fixtureLumens,
                efficiency: 0.8,
                fixtureType: 'panel' as const,
                fixtureShape: 'rectangular' as const,
                lightColor: '#fff5e1',
                roomId: `${spec.id}::ambient-1`,
                brand: 'PCL Iluminación',
                articleNumber: 'PANEL-40W',
                productId: 10,
                power: 40,
            };
        }),
    };
}

/** Proyecto de 3 niveles × 8 ambientes (24 ambientes en total). */
export function buildModuloIProjectFixture(): Project {
    return {
        id: 'modulo-i-fixture',
        name: 'MÓDULO I',
        created_at: '2026-07-21T10:00:00.000Z',
        updated_at: '2026-07-21T10:00:00.000Z',
        scenes: [
            buildLevelScene(0),
            buildLevelScene(1),
            buildLevelScene(2),
        ],
    };
}

export const MODULO_I_EXPECTED_LEVEL_COUNT = 3;
export const MODULO_I_EXPECTED_AMBIENT_COUNT = 24;
