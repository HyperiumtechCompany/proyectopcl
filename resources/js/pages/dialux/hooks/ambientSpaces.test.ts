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

    // Regresión (comparación DIALux evo, Módulo 22): un recinto `roomType:
    // 'room'` subdividido por dos paredes internas en dos sub-ambientes
    // ("Caseta de Control" / "SS.HH") necesitaba alturas de plano útil
    // DISTINTAS (0.6 m vestíbulo vs 1.8 m lavabo), igual que DIALux evo real
    // — antes de este fix, `ambientConfigs[key].usefulPlaneHeight` no existía
    // como campo y `buildWallDefinedAmbientSpaces` nunca lo mezclaba en el
    // `Room` derivado, así que las dos secciones de "Configuración de
    // Terreno" del panel de propiedades (`WallProps.tsx`) no tenían dónde
    // escribir ni el motor de dónde leer: ambos sub-ambientes quedaban
    // pegados al mismo default (0.8 m), sin importar qué se configurara.
    it('resolves a different useful plane height per wall-defined sub-ambient (Módulo 22 regression)', () => {
        const room = {
            id: 'modulo-22',
            name: 'Modulo 22',
            roomType: 'room',
            vertices: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 3 },
                { x: 0, y: 3 },
            ],
            height: 4.67,
            color: 'rgba(56,189,248,0.25)',
            illuminanceLux: 200,
            norma: 200,
            ambientConfigs: {
                'ambient-1': { name: 'Caseta de Control', usefulPlaneHeight: 0.6 },
                'ambient-2': { name: 'SS.HH', usefulPlaneHeight: 1.8 },
            },
        } satisfies Room;

        const casetaWall = {
            id: 'wall-caseta',
            vertices: [
                { x: 0.5, y: 0.5 },
                { x: 2.5, y: 0.5 },
                { x: 2.5, y: 2.5 },
                { x: 0.5, y: 2.5 },
                { x: 0.5, y: 0.5 },
            ],
            thickness: 0.15,
            height: 4.67,
        } satisfies Wall;
        const banoWall = {
            id: 'wall-bano',
            vertices: [
                { x: 3.5, y: 0.5 },
                { x: 5.5, y: 0.5 },
                { x: 5.5, y: 2.5 },
                { x: 3.5, y: 2.5 },
                { x: 3.5, y: 0.5 },
            ],
            thickness: 0.15,
            height: 4.67,
        } satisfies Wall;

        const ambients = deriveAmbientSpaces(room, [casetaWall, banoWall], []);
        expect(ambients).toHaveLength(2);

        const caseta = ambients.find((a) => a.name === 'Caseta de Control');
        const bano = ambients.find((a) => a.name === 'SS.HH');

        expect(caseta?.room.usefulPlaneHeight).toBe(0.6);
        expect(bano?.room.usefulPlaneHeight).toBe(1.8);
        // Ningún ambiente hereda la altura del otro (el bug hubiera dejado a
        // ambos en el mismo valor, el default de `room.usefulPlaneHeight`).
        expect(caseta?.room.usefulPlaneHeight).not.toBe(bano?.room.usefulPlaneHeight);
    });

    // Regresión: antes de este fix, `ambient-1`/`ambient-2` se asignaban
    // SIEMPRE por orden de área descendente — si la geometría cambiaba de
    // forma que la pared antes más grande pasaba a ser la más chica, la
    // configuración guardada por el usuario (altura de plano útil,
    // normativa) saltaba en silencio a la pared equivocada. `AmbientConfig.
    // wallId` (escrito por `WallProps.tsx` la primera vez que se guarda
    // algo de un sub-ambiente) ancla la clave a la pared real.
    it('keeps a sub-ambient config pinned to its wall even after the area ranking flips', () => {
        const room = {
            id: 'modulo-x',
            name: 'Modulo X',
            roomType: 'room',
            vertices: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 4 },
                { x: 0, y: 4 },
            ],
            height: 3,
            color: 'rgba(56,189,248,0.25)',
            illuminanceLux: 200,
            norma: 200,
            ambientConfigs: {
                // Simula un guardado previo: el usuario nombró/configuró
                // "wall-a" cuando era la más grande y quedó en ambient-1.
                'ambient-1': { name: 'Ambiente A', wallId: 'wall-a' },
            },
        } satisfies Room;

        function closedSquare(id: string, cx: number, half: number) {
            return {
                id,
                vertices: [
                    { x: cx - half, y: 2 - half },
                    { x: cx + half, y: 2 - half },
                    { x: cx + half, y: 2 + half },
                    { x: cx - half, y: 2 + half },
                    { x: cx - half, y: 2 - half },
                ],
                thickness: 0.15,
                height: 3,
            } satisfies Wall;
        }

        // Primera corrida: wall-a es la más grande (área mayor a wall-b).
        const wallASmall = closedSquare('wall-a', 2, 0.5);
        const wallBBig = closedSquare('wall-b', 7, 1.5);
        const flippedAmbients = deriveAmbientSpaces(room, [wallASmall, wallBBig], []);

        const a = flippedAmbients.find((ambient) => ambient.wallId === 'wall-a');
        const b = flippedAmbients.find((ambient) => ambient.wallId === 'wall-b');

        // wall-a sigue en ambient-1 (su config guardada), aunque ahora sea
        // la más CHICA — el bug lo hubiera movido a ambient-2.
        expect(a?.configKey).toBe('ambient-1');
        expect(b?.configKey).toBe('ambient-2');
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
            floorIndex: 0,
            floorElevation: 0,
            floorHeight: 2.7,
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
            lightSwitches: [],
            partitions: [],
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
