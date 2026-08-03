import { describe, expect, it } from 'vitest';
import { analyzeDeletion } from './deletionPolicy';
import type { Scene } from '@/pages/dialux/hooks/types';

function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
        id: 'scene-1',
        name: 'Planta',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'm', calibrationFactor: 1, isCalibrated: false },
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        conductors: [],
        junctionBoxes: [],
        partitions: [],
        ...overrides,
    } as Scene;
}

describe('analyzeDeletion — Prueba B/C/F del plan (protección de contenedores)', () => {
    it('un dispositivo suelto (luminaria) nunca requiere confirmación', () => {
        const scene = makeScene({
            fixtures: [{ id: 'fix-1', name: 'L1', x: 1, y: 1, z: 2.4 } as any],
        });
        const analysis = analyzeDeletion(scene, 'fix-1');
        expect(analysis.kind).toBe('fixture');
        expect(analysis.requiresConfirmation).toBe(false);
        expect(analysis.children).toHaveLength(0);
    });

    it('un interruptor suelto nunca requiere confirmación (Prueba B: borrar el switch no toca el ambiente)', () => {
        const scene = makeScene({
            rooms: [
                {
                    id: 'room-1',
                    name: 'Ambiente',
                    roomType: 'ambient',
                    vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
                    height: 2.7,
                    color: '#fff',
                } as any,
            ],
            lightSwitches: [{ id: 'sw-1', x: 1, y: 1, type: 'single', mountingHeight: 1.4, connectedFixtureIds: [] } as any],
        });
        const analysis = analyzeDeletion(scene, 'sw-1');
        expect(analysis.requiresConfirmation).toBe(false);
        // Y el room NO aparece en absoluto en este análisis (no es su target)
        expect(analysis.kind).toBe('switch');
    });

    it('un recinto vacío (envolvente) SIEMPRE requiere confirmación', () => {
        const scene = makeScene({
            rooms: [
                {
                    id: 'recinto-1',
                    name: 'Recinto',
                    roomType: 'room',
                    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
                    height: 2.7,
                    color: '#fff',
                } as any,
            ],
        });
        const analysis = analyzeDeletion(scene, 'recinto-1');
        expect(analysis.requiresConfirmation).toBe(true);
        expect(analysis.children).toHaveLength(0);
    });

    it('un ambiente vacío NO requiere confirmación (no es envolvente y no tiene hijos)', () => {
        const scene = makeScene({
            rooms: [
                {
                    id: 'ambiente-1',
                    name: 'Ambiente',
                    roomType: 'ambient',
                    vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
                    height: 2.7,
                    color: '#fff',
                } as any,
            ],
        });
        const analysis = analyzeDeletion(scene, 'ambiente-1');
        expect(analysis.requiresConfirmation).toBe(false);
    });

    it('un ambiente con luminarias dentro requiere confirmación y lista los hijos (Prueba F)', () => {
        const scene = makeScene({
            rooms: [
                {
                    id: 'ambiente-1',
                    name: 'Ambiente',
                    roomType: 'ambient',
                    vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
                    height: 2.7,
                    color: '#fff',
                } as any,
            ],
            fixtures: [
                { id: 'fix-1', name: 'L1', x: 2, y: 2, z: 2.4, roomId: 'ambiente-1' } as any,
                { id: 'fix-2', name: 'L2', x: 3, y: 3, z: 2.4 } as any, // dentro por geometría, sin roomId
            ],
            lightSwitches: [{ id: 'sw-1', x: 1, y: 1, type: 'single', mountingHeight: 1.4, connectedFixtureIds: [] } as any],
        });
        const analysis = analyzeDeletion(scene, 'ambiente-1');
        expect(analysis.requiresConfirmation).toBe(true);
        const ids = analysis.children.map((c) => c.id).sort();
        expect(ids).toEqual(['fix-1', 'fix-2', 'sw-1']);
    });

    it('un muro con ventanas/puertas requiere confirmación; un muro limpio no', () => {
        const scene = makeScene({
            walls: [
                { id: 'wall-1', vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }], wallType: 'interior' } as any,
                { id: 'wall-2', vertices: [{ x: 0, y: 5 }, { x: 5, y: 5 }], wallType: 'interior' } as any,
            ],
            windows: [{ id: 'win-1', wallId: 'wall-1', offsetAlongWall: 1, width: 1, height: 1, sillHeight: 1, windowType: 'fixed', windowShape: 'rectangular' } as any],
        });
        expect(analyzeDeletion(scene, 'wall-1').requiresConfirmation).toBe(true);
        expect(analyzeDeletion(scene, 'wall-2').requiresConfirmation).toBe(false);
    });
});
