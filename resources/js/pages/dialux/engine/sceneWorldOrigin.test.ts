import { describe, expect, it } from 'vitest';
import type {
    LightingResult,
    Scene as EditorScene,
} from '@/pages/dialux/hooks/useEditorStore';
import {
    computeWorldOrigin,
    translateLightingResultForRender,
    translateSceneForRender,
} from './sceneWorldOrigin';

// Objetos mínimos a propósito: estas pruebas solo ejercen los campos de
// coordenadas que leen `computeWorldOrigin` / `translateSceneForRender`, no el
// contrato completo de `Scene`/`Fixture`/etc.
function buildScene(partial: Record<string, unknown>): EditorScene {
    return {
        id: 's1',
        name: 'PB',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: {
            unit: 'm',
            factor: 1,
            displayUnit: 'Metros',
            calibrationFactor: 1,
            isCalibrated: false,
        },
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        partitions: [],
        ...partial,
    } as unknown as EditorScene;
}

describe('computeWorldOrigin', () => {
    it('devuelve null para una escena cerca del origen (proyecto normal)', () => {
        const scene = buildScene({
            rooms: [
                {
                    id: 'r1',
                    name: 'Aula',
                    vertices: [
                        { x: 0, y: 0 },
                        { x: 8, y: 0 },
                        { x: 8, y: 6 },
                        { x: 0, y: 6 },
                    ],
                    height: 2.7,
                    color: '#fff',
                },
            ],
        });

        expect(computeWorldOrigin([scene])).toBeNull();
    });

    it('devuelve null si no hay geometría', () => {
        expect(computeWorldOrigin([buildScene({})])).toBeNull();
    });

    it('devuelve un offset redondeado a 10 m para coordenadas UTM', () => {
        const scene = buildScene({
            rooms: [
                {
                    id: 'r1',
                    name: 'Aula',
                    vertices: [
                        { x: 393_468.36, y: 8_955_872.4 },
                        { x: 393_480.1, y: 8_955_872.4 },
                        { x: 393_480.1, y: 8_955_885.9 },
                        { x: 393_468.36, y: 8_955_885.9 },
                    ],
                    height: 2.7,
                    color: '#fff',
                },
            ],
        });

        const origin = computeWorldOrigin([scene]);
        expect(origin).not.toBeNull();
        // floor(minX / 10) * 10
        expect(origin!.x).toBe(393_460);
        expect(origin!.y).toBe(8_955_870);
    });
});

describe('translateSceneForRender', () => {
    const origin = { x: 393_460, y: 8_955_870 };

    it('traslada vértices de recinto y preserva las distancias', () => {
        const scene = buildScene({
            rooms: [
                {
                    id: 'r1',
                    name: 'Aula',
                    vertices: [
                        { x: 393_468, y: 8_955_872 },
                        { x: 393_478, y: 8_955_872 },
                        { x: 393_478, y: 8_955_884 },
                    ],
                    height: 2.7,
                    color: '#fff',
                },
            ],
        });

        const out = translateSceneForRender(scene, origin);
        expect(out.rooms[0].vertices).toEqual([
            { x: 8, y: 2 },
            { x: 18, y: 2 },
            { x: 18, y: 14 },
        ]);
        // distancia lado 1: 10 m antes y después
        const a = out.rooms[0].vertices[0];
        const b = out.rooms[0].vertices[1];
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(10);
    });

    it('traslada fixtures, canopies, dispositivos, switches, cajas y áreas de proyección', () => {
        const scene = buildScene({
            fixtures: [{ id: 'f1', x: 393_470, y: 8_955_880, z: 2.6 }],
            canopies: [
                {
                    id: 'c1',
                    x1: 393_470,
                    y1: 8_955_880,
                    x2: 393_472,
                    y2: 8_955_882,
                    width: 1,
                    slabThickness: 0.15,
                    height: 2.4,
                },
            ],
            electricalDevices: [
                { id: 'e1', type: 'tablero', x: 393_465, y: 8_955_875, label: 'TD', mountingHeight: 1.6 },
            ],
            lightSwitches: [
                { id: 'sw1', x: 393_466, y: 8_955_876, mountingHeight: 1.4, type: 'single', connectedFixtureIds: [] },
            ],
            junctionBoxes: [{ id: 'j1', x: 393_467, y: 8_955_877, size: '100x100x50' }],
            fixtureArrangements: [
                {
                    id: 'a1',
                    config: {
                        rows: 2,
                        columns: 2,
                        fixtureTemplate: {},
                        ambientVertices: [
                            { x: 393_468, y: 8_955_872 },
                            { x: 393_478, y: 8_955_884 },
                        ],
                        columnGuides: [0.5],
                    },
                    fixtureIds: [],
                    rotation: 0,
                    createdAt: '',
                },
            ],
        });

        const out = translateSceneForRender(scene, origin);
        expect(out.fixtures[0]).toMatchObject({ x: 10, y: 10, z: 2.6 });
        expect(out.canopies[0]).toMatchObject({ x1: 10, y1: 10, x2: 12, y2: 12, width: 1 });
        expect(out.electricalDevices![0]).toMatchObject({ x: 5, y: 5 });
        expect(out.lightSwitches[0]).toMatchObject({ x: 6, y: 6 });
        expect(out.junctionBoxes![0]).toMatchObject({ x: 7, y: 7 });
        expect(out.fixtureArrangements![0].config.ambientVertices).toEqual([
            { x: 8, y: 2 },
            { x: 18, y: 14 },
        ]);
        // Las guías son fracciones 0..1: NO se trasladan
        expect(out.fixtureArrangements![0].config.columnGuides).toEqual([0.5]);
    });

    it('no toca offsetAlongWall de ventanas/puertas (es relativo a la pared)', () => {
        const scene = buildScene({
            windows: [
                { id: 'w1', wallId: 'wall1', offsetAlongWall: 1.5, width: 1.2, height: 1, sillHeight: 0.9 },
            ],
        });

        const out = translateSceneForRender(scene, origin);
        expect(out.windows[0].offsetAlongWall).toBe(1.5);
    });
});

describe('translateLightingResultForRender', () => {
    it('traslada el origen de la grilla isolux y el observador UGR, no los lux', () => {
        const result: LightingResult = {
            avg_lux: 500,
            min_lux: 300,
            max_lux: 700,
            uniformity: 0.6,
            ugr: 19,
            grid_rows: 4,
            grid_cols: 5,
            grid_values: [1, 2, 3],
            grid_origin_x: 393_468,
            grid_origin_y: 8_955_872,
            grid_cell_width: 0.5,
            grid_cell_height: 0.5,
            ugr_observer_x: 393_470,
            ugr_observer_y: 8_955_880,
            room_vertices: [
                { x: 393_468, y: 8_955_872 },
                { x: 393_478, y: 8_955_872 },
            ],
        };

        const out = translateLightingResultForRender(result, { x: 393_460, y: 8_955_870 });
        expect(out.grid_origin_x).toBe(8);
        expect(out.grid_origin_y).toBe(2);
        expect(out.ugr_observer_x).toBe(10);
        expect(out.ugr_observer_y).toBe(10);
        expect(out.room_vertices).toEqual([
            { x: 8, y: 2 },
            { x: 18, y: 2 },
        ]);
        // sin cambios
        expect(out.avg_lux).toBe(500);
        expect(out.grid_cell_width).toBe(0.5);
        expect(out.grid_values).toEqual([1, 2, 3]);
    });
});
