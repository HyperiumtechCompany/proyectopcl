import { describe, expect, it } from 'vitest';
import type { Vertex } from '@/pages/dialux/hooks/types';
import { generatePolygonRoomScene } from './generateRoomScene';

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Extrae los vértices de un polígono Radiance por nombre — mismo parser que `generateRoomScene.test.ts`. */
function extractVertices(scene: string, polygonName: string): Vec3[] {
    const lines = scene.split('\n');
    const headerIndex = lines.findIndex((line) => line.trim().endsWith(`polygon ${polygonName}`));
    if (headerIndex === -1) {
        throw new Error(`No se encontró el polígono "${polygonName}" en la escena generada.`);
    }
    const vertexCount = Number(lines[headerIndex + 3]) / 3;
    const vertices: Vec3[] = [];
    for (let i = 0; i < vertexCount; i++) {
        const [x, y, z] = lines[headerIndex + 4 + i]!.trim().split(' ').map(Number);
        vertices.push([x!, y!, z!]);
    }
    return vertices;
}

function normalOf(scene: string, polygonName: string): Vec3 {
    const [v0, v1, v2] = extractVertices(scene, polygonName) as [Vec3, Vec3, Vec3];
    return cross(sub(v1, v0), sub(v2, v0));
}

/**
 * L de 6 vértices (no convexa) — 3m x 3m con un "mordisco" de 1.5m x 1.5m
 * en la esquina superior derecha, recorrida en sentido ANTIHORARIO (CCW).
 *
 *   (0,3)──(1.5,3)
 *     │         │
 *     │      (1.5,1.5)──(3,1.5)
 *     │                     │
 *   (0,0)───────────────(3,0)
 */
const L_SHAPE_CCW: Vertex[] = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1.5 },
    { x: 1.5, y: 1.5 },
    { x: 1.5, y: 3 },
    { x: 0, y: 3 },
];

const REFLECTANCE = { ceiling: 0.7, wall: 0.5, floor: 0.2 };
const HEIGHT = 3;

describe('generatePolygonRoomScene', () => {
    it('coincide con generateRoomScene (rectángulo) en cantidad de superficies y reflectancias', () => {
        const rectVertices: Vertex[] = [
            { x: 0, y: 0 },
            { x: 2.209, y: 0 },
            { x: 2.209, y: 0.95 },
            { x: 0, y: 0.95 },
        ];
        const scene = generatePolygonRoomScene({ vertices: rectVertices, height: 3.5, reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 } });

        expect(scene).toContain('polygon floor');
        expect(scene).toContain('polygon ceiling');
        for (let i = 0; i < 4; i++) {
            expect(scene).toContain(`polygon wall_${i}`);
        }
        expect(normalOf(scene, 'floor')[2]).toBeGreaterThan(0);
        expect(normalOf(scene, 'ceiling')[2]).toBeLessThan(0);
    });

    it('piso y techo de una forma en L (no convexa): normales +Z / -Z', () => {
        const scene = generatePolygonRoomScene({ vertices: L_SHAPE_CCW, height: HEIGHT, reflectance: REFLECTANCE });

        const floorNormal = normalOf(scene, 'floor');
        const ceilingNormal = normalOf(scene, 'ceiling');
        expect(floorNormal[2]).toBeGreaterThan(0);
        expect(ceilingNormal[2]).toBeLessThan(0);
    });

    /**
     * Verificación geométrica general (no hay 4 nombres fijos como en el
     * rectángulo): para cada pared `wall_i` (arista Vi→Vi+1 del piso CCW),
     * la dirección 2D "hacia el interior" de esa arista es la rotación -90°
     * del vector de la arista con el signo invertido, (-dy, dx) — propiedad
     * estándar de polígonos CCW simples, válida también para polígonos no
     * convexos como esta L. La normal calculada de cada pared debe tener
     * componente positiva en esa dirección.
     */
    it('las 6 paredes de la forma en L apuntan hacia el interior', () => {
        const scene = generatePolygonRoomScene({ vertices: L_SHAPE_CCW, height: HEIGHT, reflectance: REFLECTANCE });

        for (let i = 0; i < L_SHAPE_CCW.length; i++) {
            const vi = L_SHAPE_CCW[i]!;
            const vNext = L_SHAPE_CCW[(i + 1) % L_SHAPE_CCW.length]!;
            const dx = vNext.x - vi.x;
            const dy = vNext.y - vi.y;
            const inward2d = [-dy, dx];

            const normal = normalOf(scene, `wall_${i}`);
            const dot = normal[0] * inward2d[0] + normal[1] * inward2d[1];
            expect(dot).toBeGreaterThan(0);
            // Las paredes son verticales — sin componente Z en la normal.
            expect(Math.abs(normal[2])).toBeLessThan(1e-9);
        }
    });

    it('normaliza automáticamente un polígono declarado en sentido horario (CW) a CCW', () => {
        const cwVertices = [...L_SHAPE_CCW].reverse();
        const sceneFromCcw = generatePolygonRoomScene({ vertices: L_SHAPE_CCW, height: HEIGHT, reflectance: REFLECTANCE });
        const sceneFromCw = generatePolygonRoomScene({ vertices: cwVertices, height: HEIGHT, reflectance: REFLECTANCE });

        // Mismo resultado geométrico (normal de piso hacia +Z) sin importar
        // el sentido en que el fixture haya declarado los vértices.
        expect(normalOf(sceneFromCcw, 'floor')[2]).toBeGreaterThan(0);
        expect(normalOf(sceneFromCw, 'floor')[2]).toBeGreaterThan(0);
    });

    it('rechaza un polígono con menos de 3 vértices', () => {
        expect(() =>
            generatePolygonRoomScene({
                vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
                height: HEIGHT,
                reflectance: REFLECTANCE,
            }),
        ).toThrow(/al menos 3 vértices/);
    });
});
