import { describe, expect, it } from 'vitest';
import { buildProductionCalculationConfig } from '@/pages/dialux/domain/calculation/productionCalculationConfig';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import type { Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildAllPolygonShapeFixtures, type PolygonShapeFixture } from './polygonShapeFixtures';
import { generatePolygonSensorGrid } from './generateSensorGrid';

/**
 * Verificación RÁPIDA (sin Radiance, corre en cada `npx vitest run`) de que
 * los 3 ambientes no rectangulares están bien armados ANTES de invertir
 * varios minutos corriendo el oráculo real — un fixture con la luminaria
 * fuera del polígono, o una grilla de sensores sin puntos válidos, fallaría
 * recién al final de una corrida larga sin esto.
 */

function buildProjectForPolygonFixture(fixture: PolygonShapeFixture): Project {
    const room: Room = {
        id: fixture.id,
        name: fixture.label,
        roomType: 'ambient',
        vertices: fixture.vertices,
        height: fixture.height,
        color: '#000000',
        illuminanceLux: 100,
        usefulPlaneHeight: fixture.workingPlaneHeight,
        marginalZone: fixture.marginalZone,
        ceilingReflectance: fixture.reflectance.ceiling,
        wallReflectance: fixture.reflectance.wall,
        floorReflectance: fixture.reflectance.floor,
    };
    const scene: Scene = {
        id: `${fixture.id}-scene`,
        name: 'n',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: room.height,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'm', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: fixture.fixtures,
        lightSwitches: [],
        partitions: [],
    };
    return { id: `${fixture.id}-project`, name: fixture.label, created_at: '', updated_at: '', scenes: [scene] };
}

describe.each(buildAllPolygonShapeFixtures())('polygonShapeFixtures — $id ($label)', (fixture) => {
    it('genera una grilla de sensores no vacía para el oráculo Radiance', () => {
        const points = generatePolygonSensorGrid({
            vertices: fixture.vertices,
            workingPlaneHeight: fixture.workingPlaneHeight,
            marginalZone: fixture.marginalZone,
            spacing: fixture.spacing,
        });
        expect(points.length).toBeGreaterThan(0);
    });

    it('el motor de producción calcula un resultado finito y positivo para este ambiente no rectangular', async () => {
        const project = buildProjectForPolygonFixture(fixture);
        const { resultsByRoom } = await runProjectLightingCalculation(project, buildProductionCalculationConfig(project));
        const result = Object.values(resultsByRoom)[0]!;

        expect(Number.isFinite(result.avg_lux)).toBe(true);
        expect(result.avg_lux).toBeGreaterThan(0);
    });

    it('también calcula con interreflexión iterativa, sin lanzar, para este ambiente no rectangular', async () => {
        const project = buildProjectForPolygonFixture(fixture);
        const config = { ...buildProductionCalculationConfig(project), interreflection: 'iterative' as const, maxBounces: 30, convergenceTolerance: 1e-6 };
        const { resultsByRoom } = await runProjectLightingCalculation(project, config);
        const result = Object.values(resultsByRoom)[0]!;

        expect(Number.isFinite(result.avg_lux)).toBe(true);
        expect(result.avg_lux).toBeGreaterThan(0);
    });
});
