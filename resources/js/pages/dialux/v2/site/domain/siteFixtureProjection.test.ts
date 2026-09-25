import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import {
    evaluatePoleGrid,
    PROJECTED_FOR_KEY,
    projectAreaLuminaires,
    projectCanopyLights,
    projectedPoleElement,
    suggestProjectionGrid,
} from './siteFixtureProjection';
import type { PoleConfig, SiteData, SiteElement } from './types';

const court: SiteElement = {
    id: 'cancha',
    type: 'court',
    label: 'Cancha',
    vertices: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 20 },
        { x: 0, y: 20 },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
};

const pole: PoleConfig = {
    kind: 'pole',
    heightM: 8,
    armLengthM: 0,
    armDirectionDeg: 0,
    fixtures: 1,
    lumens: 10000,
    maintenanceFactor: 0.8,
};

const site = (elements: SiteElement[]): SiteData => ({
    schemaVersion: 1,
    terrainScaleM: 1,
    gridSizeM: 1,
    canvasWidth: 100,
    canvasHeight: 100,
    elements,
    feederPaths: [],
    circuits: [],
    layers: [],
});

const NO_PHOTOMETRY = new Map<number, LuminairePhotometry>();

describe('projectAreaLuminaires (proyección de la V1 + motor luminotécnico V1)', () => {
    it('alcanza el Ēm objetivo y reparte los postes dentro del área', () => {
        const result = projectAreaLuminaires({
            site: site([court]),
            areaId: 'cancha',
            targetLux: 20,
            pole,
            photometry: NO_PHOTOMETRY,
        })!;
        expect(result.reachedTarget).toBe(true);
        expect(result.predicted.avgLux).toBeGreaterThanOrEqual(20);
        expect(result.positions).toHaveLength(result.rows * result.columns);
        for (const point of result.positions) {
            expect(pointInPolygon(point, court.vertices)).toBe(true);
        }
        // Área 40×20: más columnas que filas (proporción del espacio, como la V1).
        expect(result.columns).toBeGreaterThanOrEqual(result.rows);
        // Primer paso = método de lúmenes de la V1: ((800·20)/0.8)·0.8 / 10000 → 2.
        expect(result.lumenMethodCount).toBe(2);
        expect(result.steps[0].count).toBe(2);
    });

    it('con un objetivo mayor proyecta más luminarias', () => {
        const low = projectAreaLuminaires({
            site: site([court]),
            areaId: 'cancha',
            targetLux: 10,
            pole,
            photometry: NO_PHOTOMETRY,
        })!;
        const high = projectAreaLuminaires({
            site: site([court]),
            areaId: 'cancha',
            targetLux: 50,
            pole,
            photometry: NO_PHOTOMETRY,
        })!;
        expect(high.positions.length).toBeGreaterThan(low.positions.length);
    });

    it('reproyectar reemplaza los postes proyectados antes para la misma área', () => {
        const previous = Array.from({ length: 30 }, (_, i) =>
            projectedPoleElement(`old-${i}`, { x: 1 + i, y: 10 }, pole, 'cancha'),
        );
        const withOld = projectAreaLuminaires({
            site: site([court, ...previous]),
            areaId: 'cancha',
            targetLux: 20,
            pole,
            photometry: NO_PHOTOMETRY,
        })!;
        const clean = projectAreaLuminaires({
            site: site([court]),
            areaId: 'cancha',
            targetLux: 20,
            pole,
            photometry: NO_PHOTOMETRY,
        })!;
        expect(withOld.positions.length).toBe(clean.positions.length);
        expect(previous[0].metadata?.[PROJECTED_FOR_KEY]).toBe('cancha');
    });
});

describe('projectCanopyLights', () => {
    it('proyecta la cantidad de luminarias bajo la cubierta hasta el objetivo', () => {
        const techo: SiteElement = {
            id: 'techo',
            type: 'canopy',
            label: 'Techado',
            vertices: [
                { x: 0, y: 0 },
                { x: 12, y: 0 },
                { x: 12, y: 8 },
                { x: 0, y: 8 },
            ],
            config: {
                kind: 'canopy',
                heightM: 3.5,
                roof: 'flat',
                translucent: false,
                columnSpacingM: 4,
                columnDiameterM: 0.2,
            } as SiteElement['config'],
            style: { fillColor: '#000', strokeColor: '#000' },
        };
        const result = projectCanopyLights({
            site: site([techo]),
            areaId: 'techo',
            targetLux: 100,
            lights: { enabled: true, count: 1, lumens: 2000, wattage: 18 },
            photometry: NO_PHOTOMETRY,
        })!;
        expect(result.reachedTarget).toBe(true);
        expect(result.predicted.avgLux).toBeGreaterThanOrEqual(100);
        expect(result.count).toBeGreaterThanOrEqual(result.lumenMethodCount - 1);
    });
});

describe('proyección interactiva (filas × columnas)', () => {
    it('la propuesta respeta la regla de separación máxima k·h', () => {
        // Cancha 40 × 20 m, postes de 4 m y k = 3 → separación ≤ 12 m → ≥ 4 columnas × 2 filas.
        const suggestion = suggestProjectionGrid({
            site: site([court]),
            areaId: 'cancha',
            targetLux: 5,
            lumensEach: 20000,
            maintenanceFactor: 0.8,
            mountingHeightM: 4,
        })!;
        expect(suggestion.bySpacing).toMatchObject({ rows: 2, columns: 4, maxSpacingM: 12 });
        // Con tan poco lux el método de lúmenes pide 1: manda la regla.
        expect(suggestion.byLumens.count).toBe(1);
        expect(suggestion.rows * suggestion.columns).toBe(8);
    });

    it('evalúa la grilla con el motor V1: más columnas = más Ēm y separación real', () => {
        const at = (columns: number) =>
            evaluatePoleGrid({
                site: site([court]),
                areaId: 'cancha',
                rows: 1,
                columns,
                pole,
                photometry: NO_PHOTOMETRY,
            })!;
        const two = at(2);
        const four = at(4);
        expect(four.metrics.avgLux).toBeGreaterThan(two.metrics.avgLux);
        expect(four.positions).toHaveLength(4);
        expect(four.metrics.spacingXM).toBeCloseTo(10, 6);
    });
});
