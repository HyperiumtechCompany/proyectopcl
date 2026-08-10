import { describe, expect, it } from 'vitest';
import { distanceToPolygonEdge, pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Vertex } from '@/pages/dialux/hooks/types';
import { generatePolygonSensorGrid } from './generateSensorGrid';

/**
 * Misma L de `generatePolygonRoomScene.test.ts`: 3x3 m con un "mordisco" de
 * 1.5x1.5 m en la esquina superior derecha.
 */
const L_SHAPE: Vertex[] = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1.5 },
    { x: 1.5, y: 1.5 },
    { x: 1.5, y: 3 },
    { x: 0, y: 3 },
];

describe('generatePolygonSensorGrid', () => {
    it('todos los sensores caen dentro del polígono y respetan la zona marginal', () => {
        const marginalZone = 0.2;
        const points = generatePolygonSensorGrid({
            vertices: L_SHAPE,
            workingPlaneHeight: 0.85,
            marginalZone,
            spacing: 0.3,
        });

        expect(points.length).toBeGreaterThan(0);
        for (const p of points) {
            expect(pointInPolygon({ x: p.x, y: p.y }, L_SHAPE)).toBe(true);
            expect(distanceToPolygonEdge({ x: p.x, y: p.y }, L_SHAPE)).toBeGreaterThanOrEqual(marginalZone - 1e-9);
        }
    });

    it('ningún sensor cae en el "mordisco" recortado de la L (fuera del polígono aunque esté dentro del bounding box)', () => {
        const points = generatePolygonSensorGrid({
            vertices: L_SHAPE,
            workingPlaneHeight: 0,
            marginalZone: 0.05,
            spacing: 0.25,
        });

        // El mordisco es el rectángulo (1.5,1.5)-(3,3) — fuera de la L.
        const pointsInNotch = points.filter((p) => p.x > 1.5 && p.y > 1.5);
        expect(pointsInNotch).toHaveLength(0);
    });

    it('altura Z de cada sensor = workingPlaneHeight + offset vertical (default 0.01 m)', () => {
        const points = generatePolygonSensorGrid({
            vertices: L_SHAPE,
            workingPlaneHeight: 0.85,
            marginalZone: 0.1,
            spacing: 0.3,
        });

        for (const p of points) {
            expect(p.z).toBeCloseTo(0.86, 5);
        }
    });

    it('rechaza un polígono con menos de 3 vértices', () => {
        expect(() =>
            generatePolygonSensorGrid({
                vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
                workingPlaneHeight: 0,
                marginalZone: 0.1,
                spacing: 0.3,
            }),
        ).toThrow(/al menos 3 vértices/);
    });

    it('lanza un error explícito cuando la zona marginal deja cero sensores, en vez de devolver un arreglo vacío en silencio', () => {
        expect(() =>
            generatePolygonSensorGrid({
                vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
                workingPlaneHeight: 0,
                marginalZone: 0.6, // > mitad del lado más corto (1m) → no queda área útil
                spacing: 0.3,
            }),
        ).toThrow(/no dejaron ningún sensor/);
    });
});
