import { describe, expect, it } from 'vitest';
import { distanceToPolygonEdge } from '@/pages/dialux/geometry/polygonGeometry';
import { buildGrid } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Room, Vertex } from '@/pages/dialux/hooks/types';
import { buildAllPolygonShapeFixtures } from './polygonShapeFixtures';
import { generatePolygonSensorGrid } from './generateSensorGrid';

/**
 * Ronda 21 (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-21):
 * prueba de paridad EXACTA entre la grilla de sensores del oráculo Radiance
 * (`generatePolygonSensorGrid`) y la grilla real de producción
 * (`hooks/lightingEngineCore.ts::buildGrid` + la exclusión de zona marginal
 * de `hooks/marginalZoneFilter.ts::filterPointsOutsideMarginalZone`).
 *
 * Esto NO necesita Radiance instalado — corre en cada `vitest run` y es la
 * guardia permanente contra el bug real de la Ronda 19/20: el oráculo y el
 * motor promediando sobre CONJUNTOS DE PUNTOS DE MUESTREO distintos (mismo
 * `spacing` nominal, esquema de anclaje de grilla distinto), sin que
 * ningún test anterior lo detectara porque ninguno comparaba posiciones de
 * sensor, solo conteos y pertenencia al polígono.
 */

function productionGridPoints(vertices: Vertex[], spacing: number, marginalZone: number, workingPlaneHeight: number) {
    const room: Room = {
        id: 'parity-room',
        name: 'parity',
        roomType: 'ambient',
        vertices,
        height: 3,
        color: '#000000',
        illuminanceLux: 100,
        usefulPlaneHeight: workingPlaneHeight,
        marginalZone,
    } as Room;

    const grid = buildGrid(room, spacing, workingPlaneHeight);
    return grid.points
        .filter((p) => p.active && distanceToPolygonEdge(p, vertices) >= marginalZone)
        .map((p) => ({ x: p.x, y: p.y }));
}

describe('generatePolygonSensorGrid — paridad exacta con la malla real de producción', () => {
    it.each(buildAllPolygonShapeFixtures())(
        '$id ($label): mismos puntos (x,y) que buildGrid() + filtro de zona marginal',
        (fixture) => {
            const oraclePoints = generatePolygonSensorGrid({
                vertices: fixture.vertices,
                workingPlaneHeight: fixture.workingPlaneHeight,
                marginalZone: fixture.marginalZone,
                spacing: fixture.spacing,
            }).map((p) => ({ x: p.x, y: p.y }));

            const productionPoints = productionGridPoints(
                fixture.vertices,
                fixture.spacing,
                fixture.marginalZone,
                fixture.workingPlaneHeight,
            );

            expect(oraclePoints.length).toBeGreaterThan(0);
            expect(oraclePoints.length).toBe(productionPoints.length);
            for (let i = 0; i < oraclePoints.length; i++) {
                expect(oraclePoints[i]!.x).toBeCloseTo(productionPoints[i]!.x, 9);
                expect(oraclePoints[i]!.y).toBeCloseTo(productionPoints[i]!.y, 9);
            }
        },
    );

    it('rectángulo simple: también coincide (regresión — no solo formas no convexas)', () => {
        const vertices: Vertex[] = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 3 },
        ];
        const spacing = 0.5;
        const marginalZone = 0.2;
        const workingPlaneHeight = 0.85;

        const oraclePoints = generatePolygonSensorGrid({ vertices, workingPlaneHeight, marginalZone, spacing }).map((p) => ({
            x: p.x,
            y: p.y,
        }));
        const productionPoints = productionGridPoints(vertices, spacing, marginalZone, workingPlaneHeight);

        expect(oraclePoints.length).toBe(productionPoints.length);
        for (let i = 0; i < oraclePoints.length; i++) {
            expect(oraclePoints[i]!.x).toBeCloseTo(productionPoints[i]!.x, 9);
            expect(oraclePoints[i]!.y).toBeCloseTo(productionPoints[i]!.y, 9);
        }
    });
});
