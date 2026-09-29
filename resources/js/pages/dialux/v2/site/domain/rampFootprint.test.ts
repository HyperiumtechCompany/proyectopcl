import { describe, expect, it } from 'vitest';
import {
    arrivalBridge,
    normalizeFlightRises,
    poolLightPoints,
    rampCalcPatches,
    rampPlanSegments,
    rampSideLightPoints,
} from './rampFootprint';
import { calculateSiteLighting } from './siteLightingCalculation';
import { siteElementLoadW } from './siteOutputs';
import type { RampConfig, SiteData, SiteElement } from './types';

const rect = (x0: number, y0: number, w: number, h: number) => [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + h },
    { x: x0, y: y0 + h },
];

const rampConfig = (extra: Partial<RampConfig> = {}): RampConfig => ({
    kind: 'ramp',
    fromElevationM: 0,
    toElevationM: 0.8,
    widthM: 1.5,
    flights: [{ id: 'f1', direction: 'east', lengthM: 10, riseM: 0.8, landingLengthM: 0 }],
    ...extra,
});

const ramp = (config: RampConfig = rampConfig()): SiteElement => ({
    id: 'rampa',
    type: 'ramp',
    label: 'Rampa',
    vertices: rect(0, 0, 10, 1.5),
    config,
    style: { fillColor: '#999', strokeColor: '#666' },
});

const platform = (id: string, x0: number, w: number, elevation: number): SiteElement => ({
    id,
    type: 'terrace_platform',
    label: id,
    vertices: rect(x0, -5, w, 12),
    baseElevationM: elevation,
    style: { fillColor: '#ccc', strokeColor: '#999' },
});

const site = (elements: SiteElement[]): SiteData =>
    ({ schemaVersion: 1, terrainScaleM: 1, layers: [], elements }) as unknown as SiteData;

describe('tramos repartidos al desnivel real', () => {
    it('los tramos que suben de más se escalan para llegar a la cota de destino', () => {
        const config = rampConfig({
            toElevationM: 3.5,
            flights: [
                { id: 'a', direction: 'east', lengthM: 8, riseM: 0.7 },
                { id: 'b', direction: 'east', lengthM: 8, riseM: 3.4 },
            ],
        });
        const normalized = normalizeFlightRises(config);
        const sum = (normalized.flights ?? []).reduce((acc, flight) => acc + flight.riseM, 0);
        expect(sum).toBeCloseTo(3.5, 9);
        expect(normalized.flights?.[0].riseM).toBeCloseTo((0.7 * 3.5) / 4.1, 9);
        // Ya cuadra, o sin desnivel: no se toca.
        const exact = rampConfig();
        expect(normalizeFlightRises(exact)).toBe(exact);
        const flat = rampConfig({ toElevationM: 0 });
        expect(normalizeFlightRises(flat)).toBe(flat);
    });
});

describe('rampa por tramos: parches de cálculo, llegada y balizas', () => {
    it('cada trozo del tramo se calcula a su cota real (sube a lo largo)', () => {
        const patches = rampCalcPatches(ramp(), 1, 1.5);
        expect(patches.length).toBeGreaterThan(3);
        const elevations = patches.map((patch) => patch.baseElevationM);
        expect(Math.min(...elevations)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...elevations)).toBeLessThanOrEqual(0.8);
        expect(Math.max(...elevations) - Math.min(...elevations)).toBeGreaterThan(0.5);
    });

    it('si la llegada queda a menos de 3 m de la plataforma de destino, hay losa de llegada', () => {
        const segments = rampPlanSegments(ramp(), 1);
        const endX = Math.max(...segments[segments.length - 1].corners.map((p) => p.x));
        // Plataforma a +0,80 que empieza 1 m después del final.
        const bridge = arrivalBridge(ramp(), [ramp(), platform('alta', endX + 1, 10, 0.8)], 1);
        expect(bridge?.gapM).toBeCloseTo(1, 1);
        expect(bridge?.elevationM).toBeCloseTo(0.8, 6);
        // Apoyada directamente: no hace falta.
        expect(arrivalBridge(ramp(), [ramp(), platform('alta', endX - 0.5, 10, 0.8)], 1)).toBeNull();
        // Destino a otra cota: no se inventa una losa.
        expect(arrivalBridge(ramp(), [ramp(), platform('otra', endX + 1, 10, 2)], 1)).toBeNull();
    });

    it('balizas de muro: en ambos costados, a 0,30 m sobre el piso real de cada punto', () => {
        const lit = ramp(rampConfig({ lights: { enabled: true, mode: 'wall', spacingM: 2, sides: 'both', lumens: 150, wattage: 3 } }));
        const points = rampSideLightPoints(lit, 1);
        expect(points.length).toBeGreaterThanOrEqual(8);
        // Suben con la rampa: la primera cerca de 0,30 y la última cerca de 1,10.
        const elevations = points.map((point) => point.elevationM);
        expect(Math.min(...elevations)).toBeGreaterThan(0.29);
        expect(Math.max(...elevations)).toBeLessThan(1.11);
        expect(siteElementLoadW(lit, 1).watts).toBe(points.length * 3);
    });

    it('el cálculo de la rampa usa sus balizas y la evalúa por tramos', () => {
        const lit = ramp(rampConfig({ lights: { enabled: true, mode: 'wall', spacingM: 1.5, sides: 'both', lumens: 150, wattage: 3 } }));
        const calc = calculateSiteLighting(site([lit]), new Map());
        const area = calc.areas.find((item) => item.elementId === 'rampa')!;
        expect(area.ownLuminaires).toBe(rampSideLightPoints(lit, 1).length);
        expect(area.result.avg_lux).toBeGreaterThan(0);
        expect(calc.warnings.some((w) => w.startsWith('Rampa: calculada por tramos'))).toBe(true);
    });
});

describe('piscina', () => {
    it('luces subacuáticas repartidas en el perímetro y su carga', () => {
        const pool: SiteElement = {
            id: 'piscina',
            type: 'pool',
            label: 'Piscina',
            vertices: rect(0, 0, 10, 5),
            config: { kind: 'pool', depthM: 1.5, lights: { enabled: true, count: 6, lumens: 1500, wattage: 18 } },
            style: { fillColor: '#0ea5e9', strokeColor: '#0369a1' },
        };
        expect(poolLightPoints(pool, 1)).toHaveLength(6);
        expect(siteElementLoadW(pool).watts).toBe(108);
    });
});
