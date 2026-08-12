import { describe, expect, it } from 'vitest';
import { cycleCandidate, hitTestAtPoint } from './hitTest';
import type { HitTestScene } from './hitTest';

/** Identidad: 60 px por metro, sin pan/zoom/flip — simplifica las aserciones. */
const sceneToCanvas = (x: number, y: number) => ({ x: x * 60, y: y * 60 });

describe('hitTestAtPoint — Prueba A: interruptor sobre el borde de un ambiente', () => {
    it('el interruptor gana sobre el ambiente aunque ambos estén bajo el puntero', () => {
        const scene: HitTestScene = {
            rooms: [
                {
                    id: 'room-1',
                    name: 'Ambiente 1',
                    roomType: 'ambient',
                    vertices: [
                        { x: 0, y: 0 },
                        { x: 4, y: 0 },
                        { x: 4, y: 4 },
                        { x: 0, y: 4 },
                    ],
                    height: 2.7,
                    color: '#fff',
                } as any,
            ],
            lightSwitches: [{ id: 'sw-1', x: 4, y: 2, type: 'single', mountingHeight: 1.4, connectedFixtureIds: [] } as any],
        };
        const canvasPt = sceneToCanvas(4, 2); // exactamente sobre el borde y el switch
        const ranked = hitTestAtPoint(scene, canvasPt, { x: 4, y: 2 }, sceneToCanvas);
        expect(ranked[0].id).toBe('sw-1');
        expect(ranked[0].kind).toBe('switch');
        // El ambiente también es candidato (el punto cae en su borde) pero con menor prioridad
        expect(ranked.some((c) => c.id === 'room-1')).toBe(true);
        expect(ranked.findIndex((c) => c.id === 'room-1')).toBeGreaterThan(0);
    });
});

describe('hitTestAtPoint — la tolerancia de clic crece con el zoom (regresión: "hay que alejarse para seleccionar")', () => {
    it('a zoom alto, un clic lejos del centro pero dentro del símbolo dibujado sigue acertando', () => {
        // 400 px/m: zoom bien acercado, típico de trabajo de precisión al cablear.
        const zoomedIn = (x: number, y: number) => ({ x: x * 400, y: y * 400 });
        const scene: HitTestScene = {
            electricalDevices: [
                { id: 'dev-1', type: 'sub_panel', x: 5, y: 5, mountingHeight: 1.4, connectedDeviceIds: [] } as any,
            ],
        };
        const clickPt = zoomedIn(5, 5);
        clickPt.x += 40; // 40px de distancia al centro — dentro del símbolo a este zoom, pero fuera del radio fijo (20px) de antes.
        const ranked = hitTestAtPoint(scene, clickPt, { x: 5.1, y: 5 }, zoomedIn);
        expect(ranked[0]?.id).toBe('dev-1');
    });

    it('a zoom bajo (identidad, 60 px/m) se mantiene el radio fijo mínimo — no se vuelve más difícil clickear', () => {
        const scene: HitTestScene = {
            electricalDevices: [
                { id: 'dev-1', type: 'sub_panel', x: 5, y: 5, mountingHeight: 1.4, connectedDeviceIds: [] } as any,
            ],
        };
        const clickPt = sceneToCanvas(5, 5);
        clickPt.x += 19; // dentro del radio fijo mínimo (20px)
        const ranked = hitTestAtPoint(scene, clickPt, { x: 5.3, y: 5 }, sceneToCanvas);
        expect(ranked[0]?.id).toBe('dev-1');
    });
});

describe('hitTestAtPoint — Prueba de contenedores anidados', () => {
    const nestedScene: HitTestScene = {
        rooms: [
            {
                id: 'recinto',
                name: 'Recinto',
                roomType: 'room',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 10 },
                    { x: 0, y: 10 },
                ],
                height: 2.7,
                color: '#fff',
            } as any,
            {
                id: 'ambiente',
                name: 'Ambiente',
                roomType: 'ambient',
                vertices: [
                    { x: 2, y: 2 },
                    { x: 6, y: 2 },
                    { x: 6, y: 6 },
                    { x: 2, y: 6 },
                ],
                height: 2.7,
                color: '#fff',
            } as any,
        ],
    };

    it('el ambiente interior gana sobre el recinto que lo contiene (mismo priority, menor área)', () => {
        const pt = { x: 3, y: 3 };
        const ranked = hitTestAtPoint(nestedScene, sceneToCanvas(pt.x, pt.y), pt, sceneToCanvas);
        expect(ranked[0].id).toBe('ambiente');
    });

    it('el interior vacío del recinto queda al fondo y no captura el clic normal', () => {
        const pt = { x: 8, y: 8 };
        const ranked = hitTestAtPoint(nestedScene, sceneToCanvas(pt.x, pt.y), pt, sceneToCanvas);
        expect(ranked).toHaveLength(0);
    });

    it('Alt+clic permite seleccionar deliberadamente el interior del recinto', () => {
        const pt = { x: 8, y: 8 };
        const ranked = hitTestAtPoint(
            nestedScene,
            sceneToCanvas(pt.x, pt.y),
            pt,
            sceneToCanvas,
            { includeEnclosureInterior: true },
        );
        expect(ranked[0]?.id).toBe('recinto');
    });
});

describe('hitTestAtPoint — objetos puntuales superpuestos y selección cíclica (Prueba E)', () => {
    const scene: HitTestScene = {
        fixtures: [{ id: 'fix-1', x: 5, y: 5, name: 'L1' } as any],
        lightSwitches: [{ id: 'sw-1', x: 5, y: 5, type: 'single', mountingHeight: 1.4, connectedFixtureIds: [] } as any],
        electricalDevices: [{ id: 'dev-1', x: 5, y: 5, type: 'sub_panel', label: 'TD-01', connectedDeviceIds: [] } as any],
    };

    it('los tres objetos puntuales son candidatos en el mismo punto', () => {
        const pt = { x: 5, y: 5 };
        const ranked = hitTestAtPoint(scene, sceneToCanvas(pt.x, pt.y), pt, sceneToCanvas);
        expect(ranked.map((c) => c.id).sort()).toEqual(['dev-1', 'fix-1', 'sw-1']);
    });

    it('cycleCandidate recorre los tres sin repetir hasta completar el ciclo', () => {
        const pt = { x: 5, y: 5 };
        const ranked = hitTestAtPoint(scene, sceneToCanvas(pt.x, pt.y), pt, sceneToCanvas);
        const seen = new Set<string>();
        let current: string | null = null;
        for (let i = 0; i < ranked.length; i++) {
            const next = cycleCandidate(ranked, current);
            expect(next).not.toBeNull();
            seen.add(next!.id);
            current = next!.id;
        }
        expect(seen.size).toBe(3);
        // El cuarto clic vuelve al primero
        const wrapped = cycleCandidate(ranked, current);
        expect(wrapped!.id).toBe(ranked[0].id);
    });
});

describe('hitTestAtPoint — objetos ocultos', () => {
    it('no devuelve un objeto rechazado por la regla de selección', () => {
        const scene: HitTestScene = { fixtures: [{ id: 'hidden-fixture', x: 2, y: 2 } as never] };
        const ranked = hitTestAtPoint(
            scene,
            sceneToCanvas(2, 2),
            { x: 2, y: 2 },
            sceneToCanvas,
            { isSelectable: (id) => id !== 'hidden-fixture' },
        );

        expect(ranked).toEqual([]);
    });
});

describe('hitTestAtPoint — muros y tabiques por distancia a segmento', () => {
    it('un clic cerca de un muro pero lejos de cualquier room lo selecciona', () => {
        const scene: HitTestScene = {
            walls: [{ id: 'wall-1', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], wallType: 'interior' } as any],
        };
        const pt = { x: 5, y: 0.05 };
        const ranked = hitTestAtPoint(scene, sceneToCanvas(pt.x, pt.y), pt, sceneToCanvas);
        expect(ranked[0]?.id).toBe('wall-1');
    });

    it('fuera de tolerancia no produce candidatos', () => {
        const scene: HitTestScene = {
            walls: [{ id: 'wall-1', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], wallType: 'interior' } as any],
        };
        const pt = { x: 5, y: 5 };
        const ranked = hitTestAtPoint(scene, sceneToCanvas(pt.x, pt.y), pt, sceneToCanvas);
        expect(ranked).toHaveLength(0);
    });
});

describe('hitTestAtPoint — cableado curvo', () => {
    it('selecciona la curva visible aunque el clic esté lejos de la recta entre extremos', () => {
        const scene: HitTestScene = {
            fixtures: [{ id: 'fixture-1', x: 10, y: 0 } as any],
            lightSwitches: [{ id: 'switch-1', x: 0, y: 0 } as any],
            conductors: [{
                id: 'wire-1',
                sourceId: 'switch-1',
                targetId: 'fixture-1',
                routeType: 'wall_ceiling',
                waypoints: [],
            } as any],
            rooms: [{
                id: 'room-under-wire',
                roomType: 'ambient',
                vertices: [{ x: 0, y: -2 }, { x: 10, y: -2 }, { x: 10, y: 2 }, { x: 0, y: 2 }],
            } as any],
        };
        // La curva cuadrática tiene su punto medio visual en y=-0.9 m;
        // la recta antigua estaba a 54 px y no detectaba este clic.
        const point = { x: 5, y: -0.9 };
        const ranked = hitTestAtPoint(scene, sceneToCanvas(point.x, point.y), point, sceneToCanvas);

        expect(ranked[0]?.id).toBe('wire-1');
        expect(ranked[0]?.kind).toBe('conductor');
        expect(ranked.some((candidate) => candidate.id === 'room-under-wire')).toBe(true);
    });
});
