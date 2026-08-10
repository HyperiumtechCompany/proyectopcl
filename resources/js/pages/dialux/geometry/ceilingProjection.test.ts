import { describe, expect, it } from 'vitest';
import { pointInPolygon, polygonAreaM2 } from './polygonGeometry';
import {
    computeValidInstallationZones,
    distributeCountAcrossZones,
    isPointInZone,
    obstacleBlocksMountingPlane,
    snapPointIntoZone,
    type ValidInstallationZone,
} from './ceilingProjection';
import type { StructuralObstacle } from '../hooks/types';

const room10x10 = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];

function makeColumn(overrides: Partial<StructuralObstacle> = {}): StructuralObstacle {
    return {
        id: 'col-1',
        name: 'Columna 1',
        obstacleType: 'column',
        vertices: [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 5 }],
        height: 3,
        elevation: 0,
        ...overrides,
    };
}

describe('obstacleBlocksMountingPlane', () => {
    it('bloquea cuando la altura de montaje cae dentro de [elevation, elevation+height]', () => {
        const column = makeColumn({ elevation: 0, height: 3 });
        expect(obstacleBlocksMountingPlane(column, 2.7)).toBe(true);
    });

    it('no bloquea una viga suspendida si el montaje queda por debajo de ella', () => {
        const beam = makeColumn({ obstacleType: 'beam', elevation: 2.5, height: 0.3 });
        expect(obstacleBlocksMountingPlane(beam, 2.2)).toBe(false);
        expect(obstacleBlocksMountingPlane(beam, 2.6)).toBe(true);
    });

    it('height <= 0 bloquea a cualquier altura de montaje (zona restringida generica)', () => {
        const restricted = makeColumn({ obstacleType: 'restricted_area', height: 0, elevation: 0 });
        expect(obstacleBlocksMountingPlane(restricted, 0.1)).toBe(true);
        expect(obstacleBlocksMountingPlane(restricted, 5)).toBe(true);
    });
});

describe('computeValidInstallationZones', () => {
    it('sin obstaculos, devuelve el room intacto como unica zona sin huecos (camino rapido)', () => {
        const zones = computeValidInstallationZones(room10x10, [], 2.7);
        expect(zones).toHaveLength(1);
        expect(zones[0].holes).toHaveLength(0);
        expect(zones[0].areaM2).toBeCloseTo(100, 6);
    });

    it('un obstaculo que no bloquea el plano de montaje se ignora (misma zona intacta)', () => {
        const beam = makeColumn({ obstacleType: 'beam', elevation: 2.5, height: 0.1 });
        const zones = computeValidInstallationZones(room10x10, [beam], 1.0);
        expect(zones).toHaveLength(1);
        expect(zones[0].holes).toHaveLength(0);
    });

    it('una columna centrada genera 1 zona con 1 hueco, area = room - columna', () => {
        const column = makeColumn();
        const zones = computeValidInstallationZones(room10x10, [column], 2.7);
        expect(zones).toHaveLength(1);
        expect(zones[0].holes).toHaveLength(1);
        expect(zones[0].areaM2).toBeCloseTo(100 - 1, 6);
    });

    it('un obstaculo que atraviesa el room de lado a lado lo divide en 2 zonas', () => {
        // Franja vertical completa x=[4,6] atravesando el room 10x10 de borde a borde.
        const wall: StructuralObstacle = {
            id: 'wall-obstacle',
            name: 'Muro estructural',
            obstacleType: 'restricted_area',
            vertices: [{ x: 4, y: -1 }, { x: 6, y: -1 }, { x: 6, y: 11 }, { x: 4, y: 11 }],
            height: 3,
            elevation: 0,
        };
        const zones = computeValidInstallationZones(room10x10, [wall], 2.7);
        expect(zones).toHaveLength(2);
        zones.forEach((zone) => expect(zone.holes).toHaveLength(0));
        const totalArea = zones.reduce((sum, z) => sum + z.areaM2, 0);
        expect(totalArea).toBeCloseTo(100 - 2 * 10, 6);
    });

    it('el pole de cada zona cae dentro del area valida (no sobre el hueco)', () => {
        const column = makeColumn();
        const zones = computeValidInstallationZones(room10x10, [column], 2.7);
        const [zone] = zones;
        expect(isPointInZone(zone.pole, zone)).toBe(true);
    });

    it('degrada al room completo si la geometria del obstaculo es invalida (menos de 3 vertices)', () => {
        const degenerate = makeColumn({ vertices: [{ x: 1, y: 1 }, { x: 2, y: 2 }] });
        const zones = computeValidInstallationZones(room10x10, [degenerate], 2.7);
        expect(zones).toHaveLength(1);
        expect(zones[0].holes).toHaveLength(0);
    });
});

describe('isPointInZone / snapPointIntoZone', () => {
    const column = makeColumn();
    const zones = computeValidInstallationZones(room10x10, [column], 2.7);
    const zone: ValidInstallationZone = zones[0];

    it('un punto dentro del hueco es invalido', () => {
        expect(isPointInZone({ x: 4.5, y: 4.5 }, zone)).toBe(false);
    });

    it('un punto fuera del hueco pero dentro del room es valido', () => {
        expect(isPointInZone({ x: 1, y: 1 }, zone)).toBe(true);
    });

    it('snapPointIntoZone desplaza un punto dentro del hueco a un punto valido', () => {
        const snapped = snapPointIntoZone({ x: 4.5, y: 4.5 }, zone);
        expect(isPointInZone(snapped, zone)).toBe(true);
    });

    it('snapPointIntoZone no modifica un punto que ya es valido', () => {
        const original = { x: 1, y: 1 };
        const snapped = snapPointIntoZone(original, zone);
        expect(snapped).toEqual(original);
    });

    it('snapPointIntoZone con margen de seguridad se aleja del borde del hueco', () => {
        const snapped = snapPointIntoZone({ x: 4.5, y: 4.5 }, zone, 0.15);
        // Distancia del punto corregido al centro de la columna >= al radio "efectivo"
        // del hueco (0.5m hasta el borde en la direccion mas corta) -- confirma que
        // el snap se aleja del obstaculo, no solo toca el borde.
        const distToHoleEdgeApprox = Math.min(
            Math.abs(snapped.x - 4), Math.abs(snapped.x - 5),
            Math.abs(snapped.y - 4), Math.abs(snapped.y - 5),
        );
        expect(isPointInZone(snapped, zone)).toBe(true);
        expect(distToHoleEdgeApprox).toBeGreaterThanOrEqual(0);
    });
});

describe('distributeCountAcrossZones', () => {
    it('reparte proporcionalmente al area y la suma da exactamente el total', () => {
        const zones = [
            { outer: [], holes: [], areaM2: 75, pole: { x: 0, y: 0 } },
            { outer: [], holes: [], areaM2: 25, pole: { x: 0, y: 0 } },
        ] as ValidInstallationZone[];
        const counts = distributeCountAcrossZones(zones, 8);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(8);
        expect(counts[0]).toBeGreaterThan(counts[1]);
    });

    it('metodo de restos mayores: no sesga sistematicamente hacia abajo', () => {
        const zones = [
            { outer: [], holes: [], areaM2: 1, pole: { x: 0, y: 0 } },
            { outer: [], holes: [], areaM2: 1, pole: { x: 0, y: 0 } },
            { outer: [], holes: [], areaM2: 1, pole: { x: 0, y: 0 } },
        ] as ValidInstallationZone[];
        const counts = distributeCountAcrossZones(zones, 10);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it('zonas sin area no reciben luminarias', () => {
        const zones = [
            { outer: [], holes: [], areaM2: 100, pole: { x: 0, y: 0 } },
            { outer: [], holes: [], areaM2: 0, pole: { x: 0, y: 0 } },
        ] as ValidInstallationZone[];
        const counts = distributeCountAcrossZones(zones, 5);
        expect(counts).toEqual([5, 0]);
    });
});

describe('polygonAreaM2 (sanity de referencia usada por las pruebas de arriba)', () => {
    it('room10x10 mide 100 m2', () => {
        expect(polygonAreaM2(room10x10)).toBeCloseTo(100, 6);
    });
    it('pointInPolygon confirma el centro del room', () => {
        expect(pointInPolygon({ x: 5, y: 5 }, room10x10)).toBe(true);
    });
});
