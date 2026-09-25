import { describe, expect, it } from 'vitest';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import {
    calculateSiteLighting,
    clipPolygonToRect,
    siteLuminaires,
} from './siteLightingCalculation';
import type { SiteData, SiteElement } from './types';

const square = (
    id: string,
    type: SiteElement['type'],
    x0: number,
    y0: number,
    size: number,
    extra: Partial<SiteElement> = {},
): SiteElement => ({
    id,
    type,
    label: id,
    vertices: [
        { x: x0, y: y0 },
        { x: x0 + size, y: y0 },
        { x: x0 + size, y: y0 + size },
        { x: x0, y: y0 + size },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
    ...extra,
});

const pole = (
    id: string,
    x: number,
    y: number,
    extra: Partial<SiteElement['config']> = {},
    element: Partial<SiteElement> = {},
): SiteElement => ({
    id,
    type: 'pole',
    label: id,
    vertices: [{ x, y }],
    config: {
        kind: 'pole',
        heightM: 8,
        armLengthM: 0,
        armDirectionDeg: 0,
        fixtures: 1,
        lumens: 3000,
        maintenanceFactor: 0.8,
        ...extra,
    } as SiteElement['config'],
    style: { fillColor: '#000', strokeColor: '#000' },
    ...element,
});

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

describe('calculateSiteLighting (motor luminotécnico V1 en exteriores)', () => {
    it('un poste lambertiano da E ≈ I/h² bajo la luminaria (fórmula analítica)', () => {
        const { areas } = calculateSiteLighting(
            site([square('cancha', 'court', 0, 0, 20), pole('p1', 10, 10)]),
            NO_PHOTOMETRY,
        );
        expect(areas).toHaveLength(1);
        const [area] = areas;
        // I = Φ·MF·η/π = 3000·0.8·0.85/π; E nadir = I/h² (h = 8 m).
        const expectedNadir = (3000 * 0.8 * 0.85) / Math.PI / 64;
        expect(area.result.max_lux).toBeGreaterThan(expectedNadir * 0.95);
        expect(area.result.max_lux).toBeLessThanOrEqual(expectedNadir * 1.001);
        expect(area.result.avg_lux).toBeGreaterThan(0);
        expect(area.summary.uniformity).toBeGreaterThan(0);
        expect(area.luminairesWithoutPhotometry).toBe(1);
        expect(area.avgLuminanceCdM2).toBeCloseTo(
            (area.result.avg_lux * 0.2) / Math.PI,
            6,
        );
    });

    it('la altura se mide sobre la cota del área (plataforma más alta = poste más bajo relativo)', () => {
        const flat = calculateSiteLighting(
            site([square('patio', 'custom_zone', 0, 0, 20), pole('p1', 10, 10)]),
            NO_PHOTOMETRY,
        ).areas[0];
        const raised = calculateSiteLighting(
            site([
                square('plataforma', 'terrace_platform', 0, 0, 20, {
                    baseElevationM: 2,
                }),
                // El poste se apoya sobre la plataforma: queda a 8 m de ella.
                pole('p1', 10, 10),
            ]),
            NO_PHOTOMETRY,
        ).areas[0];
        expect(raised.result.max_lux).toBeCloseTo(flat.result.max_lux, 3);
    });

    it('un edificio entre el poste y el área le hace sombra', () => {
        const open = calculateSiteLighting(
            site([square('patio', 'custom_zone', 0, 0, 10), pole('p1', 20, 5, { heightM: 4 })]),
            NO_PHOTOMETRY,
        ).areas.find((area) => area.elementId === 'patio')!;
        const shaded = calculateSiteLighting(
            site([
                square('patio', 'custom_zone', 0, 0, 10),
                // Bloque de 2 m de ancho entre el patio (x 0–10) y el poste (x 20).
                square('bloque', 'building_block', 12, -5, 2, {
                    heightM: 10,
                    vertices: [
                        { x: 12, y: -5 },
                        { x: 14, y: -5 },
                        { x: 14, y: 15 },
                        { x: 12, y: 15 },
                    ],
                }),
                pole('p1', 20, 5, { heightM: 4 }),
            ]),
            NO_PHOTOMETRY,
        ).areas.find((area) => area.elementId === 'patio')!;
        expect(shaded.result.avg_lux).toBeLessThan(open.result.avg_lux * 0.2);
    });

    it('usa la fotometría IES/LDT del catálogo cuando el poste tiene producto', () => {
        const web = {
            c_angles: [0],
            gamma_angles: [0, 90, 180],
            candela: [[1000, 0, 0]],
            reference_lumens: 1000,
        };
        const photometry = new Map<number, LuminairePhotometry>([
            [7, { id: 7, totalLumens: 1000, web }],
        ]);
        const [lum] = siteLuminaires(
            site([pole('p1', 0, 0, { productId: 7, lumens: undefined })]),
            photometry,
        );
        expect(lum.hasPhotometry).toBe(true);
        // Flujo de la ficha × mantenimiento.
        expect(lum.fixture.lumens).toBeCloseTo(800, 6);
    });
});

describe('calculateSiteLighting · portones y techados', () => {
    const canopy = (lights: Record<string, unknown> | undefined, translucent = false) =>
        square('techo', 'canopy', 0, 0, 10, {
            config: {
                kind: 'canopy',
                heightM: 3,
                roof: 'flat',
                translucent,
                columnSpacingM: 3,
                columnDiameterM: 0.2,
                ...(lights ? { lights } : {}),
            } as SiteElement['config'],
        });

    it('las luminarias del techado caen dentro del contorno y alumbran la superficie', () => {
        const plant = site([
            canopy({ enabled: true, count: 4, lumens: 2000, wattage: 18 }),
        ]);
        const luminaires = siteLuminaires(plant, NO_PHOTOMETRY);
        expect(luminaires).toHaveLength(4);
        for (const lum of luminaires) {
            expect(lum.sourceType).toBe('canopy');
            expect(lum.x).toBeGreaterThan(0);
            expect(lum.x).toBeLessThan(10);
            expect(lum.headElevationM).toBeCloseTo(2.85, 6);
        }
        const [area] = calculateSiteLighting(plant, NO_PHOTOMETRY).areas;
        expect(area.result.avg_lux).toBeGreaterThan(10);
    });

    it('la cubierta opaca le hace sombra a un poste; la translúcida no', () => {
        const withPole = (translucent: boolean) =>
            calculateSiteLighting(
                site([canopy(undefined, translucent), pole('p1', 5, 5, { heightM: 8 })]),
                NO_PHOTOMETRY,
            ).areas[0].result.avg_lux;
        expect(withPole(false)).toBeLessThan(withPole(true) * 0.05);
    });

    it('las luces del portón entran al cálculo en la posición del 3D', () => {
        const gate: SiteElement = {
            id: 'porton',
            type: 'gate',
            label: 'Portón',
            vertices: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
            ],
            config: {
                kind: 'gate',
                lights: { enabled: true, count: 3, heightM: 2.8, lumens: 1500, wattage: 15 },
            } as SiteElement['config'],
            style: { fillColor: '#000', strokeColor: '#000' },
        };
        const luminaires = siteLuminaires(site([gate]), NO_PHOTOMETRY);
        expect(luminaires.map((lum) => lum.sourceType)).toEqual(['gate', 'gate', 'gate']);
        // Repartidas a lo largo del vano de 6 m: -2, 0, +2 respecto del centro.
        expect(luminaires.map((lum) => Math.round(lum.x * 1000) / 1000)).toEqual([1, 3, 5]);
    });
});

describe('calculateSiteLighting · alcance de cada luminaria (auditoría Fase 6)', () => {
    it('un mástil alto aporta más allá de 60 m (radio = max(60 m, 15·h))', () => {
        // Mástil de 20 m a 70 m del área: fuera de 60 m pero dentro de 15·20 = 300 m.
        const [area] = calculateSiteLighting(
            site([square('cancha', 'court', 0, 0, 10), pole('m1', 80, 5, { heightM: 20, lumens: 100000 })]),
            NO_PHOTOMETRY,
        ).areas;
        expect(area.luminairesUsed).toBe(1);
        expect(area.result.avg_lux).toBeGreaterThan(0);
    });

    it('un poste bajo lejano sigue fuera del radio mínimo de 60 m', () => {
        const [area] = calculateSiteLighting(
            site([square('cancha', 'court', 0, 0, 10), pole('p1', 80, 5, { heightM: 3 })]),
            NO_PHOTOMETRY,
        ).areas;
        expect(area.luminairesUsed).toBe(0);
    });

    it('una luminaria por debajo de la superficie no la ilumina y se informa', () => {
        const result = calculateSiteLighting(
            site([
                square('plataforma', 'terrace_platform', 0, 0, 10, { baseElevationM: 10 }),
                // Poste de 4 m al lado, sobre el terreno (cota 0): cabeza a 4 m < 10 m.
                pole('p1', 12, 5, { heightM: 4 }),
            ]),
            NO_PHOTOMETRY,
        );
        const area = result.areas.find((a) => a.elementId === 'plataforma')!;
        expect(area.luminairesUsed).toBe(0);
        expect(result.warnings.some((w) => w.includes('por debajo de esta superficie'))).toBe(true);
    });
});

describe('calculateSiteLighting · plataformas y terreno (mapa de lux adaptable)', () => {
    // Terreno 40×20 a cota 0 con una plataforma de 20×20 a +3 m en su mitad izquierda.
    const terrain = () => ({
        ...square('terreno', 'terrain', 0, 0, 20),
        vertices: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 20 },
            { x: 0, y: 20 },
        ],
    });
    const platform = () =>
        square('plataforma', 'terrace_platform', 0, 0, 20, { baseElevationM: 3 });

    it('la plataforma es dueña de sus puntos: el terreno no los repite a otra cota', () => {
        const { areas } = calculateSiteLighting(
            site([terrain(), platform(), pole('p1', 30, 10), pole('p2', 10, 10)]),
            NO_PHOTOMETRY,
        );
        const t = areas.find((a) => a.elementId === 'terreno')!;
        const pl = areas.find((a) => a.elementId === 'plataforma')!;
        expect(pl.baseElevationM).toBe(3);
        // El terreno se calcula a SU cota (0), no a la de la plataforma de su centroide.
        expect(t.patches.every((patch) => patch.baseElevationM === 0)).toBe(true);
        // Ningún punto del terreno cae sobre la plataforma (x < 20 m).
        for (const patch of t.patches) {
            const r = patch.result;
            r.grid_values.forEach((value, index) => {
                if (value === null) return;
                const col = index % r.grid_cols;
                const x = (r.grid_origin_x ?? 0) + (col + 0.5) * (r.grid_cell_width ?? 0);
                expect(x).toBeGreaterThan(20);
            });
        }
    });

    it('una zona sobre dos cotas se calcula en parches, cada uno a su cota', () => {
        const zone = {
            ...square('zona', 'custom_zone', 0, 0, 20),
            vertices: [
                { x: 10, y: 0 },
                { x: 30, y: 0 },
                { x: 30, y: 20 },
                { x: 10, y: 20 },
            ],
        };
        const result = calculateSiteLighting(
            site([platform(), zone, pole('p1', 20, 10)]),
            NO_PHOTOMETRY,
            new Set(['zona']),
        );
        const area = result.areas[0];
        const elevations = new Set(area.patches.map((patch) => patch.baseElevationM));
        expect(elevations.has(0)).toBe(true);
        expect(elevations.has(3)).toBe(false); // la parte sobre la plataforma es de la plataforma
        expect(area.result.avg_lux).toBeGreaterThan(0);
    });

    it('un terreno plano sin otras superficies sigue siendo UN solo parche', () => {
        const [area] = calculateSiteLighting(
            site([square('patio', 'custom_zone', 0, 0, 20), pole('p1', 10, 10)]),
            NO_PHOTOMETRY,
        ).areas;
        expect(area.patches).toHaveLength(1);
        expect(area.result.grid_values).toBe(area.patches[0].result.grid_values);
    });
});

describe('clipPolygonToRect', () => {
    it('recorta un polígono cóncavo (L) a un rectángulo', () => {
        const l = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 2 },
            { x: 2, y: 2 },
            { x: 2, y: 10 },
            { x: 0, y: 10 },
        ];
        const clipped = clipPolygonToRect(l, { minX: 0, maxX: 5, minY: 0, maxY: 5 });
        let twice = 0;
        for (let i = 0; i < clipped.length; i++) {
            const a = clipped[i];
            const b = clipped[(i + 1) % clipped.length];
            twice += a.x * b.y - b.x * a.y;
        }
        // 5×2 + 2×3 = 16 m²
        expect(Math.abs(twice) / 2).toBeCloseTo(16, 9);
    });
});

