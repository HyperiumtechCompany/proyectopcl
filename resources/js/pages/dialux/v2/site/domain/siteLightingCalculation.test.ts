import { describe, expect, it } from 'vitest';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import {
    areaGridFor,
    calculateSiteLighting,
    clipPolygonToRect,
    en12464GridSpacingM,
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
            site([square('patio', 'custom_zone', 0, 0, 10, { calcSurface: { luminaires: 'all' } }), pole('p1', 20, 5, { heightM: 4 })]),
            NO_PHOTOMETRY,
        ).areas.find((area) => area.elementId === 'patio')!;
        const shaded = calculateSiteLighting(
            site([
                square('patio', 'custom_zone', 0, 0, 10, { calcSurface: { luminaires: 'all' } }),
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
            site([square('cancha', 'court', 0, 0, 10, { calcSurface: { luminaires: 'all' } }), pole('m1', 80, 5, { heightM: 20, lumens: 100000 })]),
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
                square('plataforma', 'terrace_platform', 0, 0, 10, { baseElevationM: 10, calcSurface: { luminaires: 'all' } }),
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
            ...square('zona', 'custom_zone', 0, 0, 20, { calcSurface: { luminaires: 'all' } }),
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


describe('objeto de cálculo por espacio (como DIALux evo)', () => {
    it('malla automática EN 12464: p = 0,2·5^log10(d), tope 10 m', () => {
        expect(en12464GridSpacingM(10)).toBeCloseTo(1, 9);
        expect(en12464GridSpacingM(100)).toBeCloseTo(5, 9);
        expect(en12464GridSpacingM(1000)).toBe(10);
        expect(areaGridFor(undefined, 40, 20).spacingM).toBeCloseTo(0.2 * 5 ** Math.log10(40), 9);
    });

    it('malla propia con tope de puntos por rendimiento', () => {
        const grid = areaGridFor({ grid: 'custom', spacingM: 0.1 }, 500, 500);
        expect(grid.capped).toBe(true);
        expect((500 / grid.spacingM) * (500 / grid.spacingM)).toBeLessThanOrEqual(20000 + 1);
    });

    it('cada espacio usa SU malla y su altura de plano; se informa en el resultado', () => {
        const plant = site([
            square('cancha', 'court', 0, 0, 20, { calcSurface: { grid: 'custom', spacingM: 2, heightM: 1 } }),
            square('patio', 'custom_zone', 30, 0, 20),
            pole('p1', 10, 10),
            pole('p2', 40, 10),
        ]);
        const { areas } = calculateSiteLighting(plant, NO_PHOTOMETRY);
        const cancha = areas.find((a) => a.elementId === 'cancha')!;
        const patio = areas.find((a) => a.elementId === 'patio')!;
        expect(cancha.gridMode).toBe('custom');
        expect(cancha.spacingM).toBe(2);
        expect(cancha.planeHeightM).toBe(1);
        expect(cancha.gridPoints).toBe(100);
        expect(patio.gridMode).toBe('standard');
        expect(patio.gridBasis).toMatch(/EN 12464/);
        // Plano a 1 m: la luminaria está 1 m más cerca → Emáx bajo el poste mayor.
        const ground = calculateSiteLighting(
            site([square('cancha', 'court', 0, 0, 20, { calcSurface: { grid: 'custom', spacingM: 2 } }), pole('p1', 10, 10)]),
            NO_PHOTOMETRY,
        ).areas[0];
        expect(cancha.result.max_lux).toBeGreaterThan(ground.result.max_lux);
    });

    it('calcular SOLO un espacio no calcula los demás', () => {
        const plant = site([square('a', 'court', 0, 0, 20), square('b', 'custom_zone', 30, 0, 20), pole('p1', 10, 10)]);
        const { areas } = calculateSiteLighting(plant, NO_PHOTOMETRY, new Set(['b']));
        expect(areas.map((a) => a.elementId)).toEqual(['b']);
    });

    it('un espacio duplicado encima de otro no se omite en silencio: se informa quién lo cubre', () => {
        const plant = site([square('techo-1', 'canopy', 0, 0, 10), square('techo-2', 'canopy', 0, 0, 10), pole('p1', 5, 5)]);
        const calc = calculateSiteLighting(plant, NO_PHOTOMETRY);
        expect(calc.areas).toHaveLength(1);
        expect(calc.skipped).toHaveLength(1);
        const [skipped] = calc.skipped ?? [];
        expect(skipped.coveredById).toBe(calc.areas[0].elementId);
        expect(calc.warnings.some((w) => w.includes(`${skipped.label}: sin puntos de cálculo propios`))).toBe(true);
    });
});

describe('cada espacio con SUS luminarias (como un local de la V1)', () => {
    it('por defecto la vereda no recibe la luz del poste del estacionamiento vecino', () => {
        const plant = site([
            square('estac', 'parking', 0, 0, 10),
            square('vereda', 'sidewalk', 10, 0, 4),
            pole('p-estac', 5, 5),
        ]);
        const own = calculateSiteLighting(plant, NO_PHOTOMETRY);
        const vereda = own.areas.find((area) => area.elementId === 'vereda')!;
        expect(vereda.luminaireMode).toBe('own');
        expect(vereda.luminairesUsed).toBe(0);
        expect(vereda.result.avg_lux).toBe(0);
        expect(own.warnings.some((w) => w.startsWith('vereda: sin luminarias propias'))).toBe(true);
        expect(own.areas.find((area) => area.elementId === 'estac')!.ownLuminaireIds).toHaveLength(1);

        // Modo escena completa: la misma vereda sí recibe esa luz.
        const scene = site([
            square('estac', 'parking', 0, 0, 10),
            square('vereda', 'sidewalk', 10, 0, 4, { calcSurface: { luminaires: 'all' } }),
            pole('p-estac', 5, 5),
        ]);
        const all = calculateSiteLighting(scene, NO_PHOTOMETRY).areas.find((area) => area.elementId === 'vereda')!;
        expect(all.luminairesUsed).toBe(1);
        expect(all.result.avg_lux).toBeGreaterThan(0);
        expect(all.ownLuminaireIds).toHaveLength(0);
    });

    it('un poste proyectado para la vereda es de la vereda aunque esté fuera de su borde', () => {
        const plant = site([
            square('estac', 'parking', 0, 0, 10),
            square('vereda', 'sidewalk', 10, 0, 4),
            pole('p-vereda', 9.5, 2, {}, { metadata: { projectedFor: 'vereda' } }),
        ]);
        const { areas } = calculateSiteLighting(plant, NO_PHOTOMETRY);
        expect(areas.find((area) => area.elementId === 'vereda')!.luminairesUsed).toBe(1);
        expect(areas.find((area) => area.elementId === 'estac')!.luminairesUsed).toBe(0);
    });
});

describe('reflexiones del espacio', () => {
    it('a cielo abierto no hay techo: solo reflectancia de suelo, sin rebote', () => {
        const [area] = calculateSiteLighting(site([square('patio', 'custom_zone', 0, 0, 10), pole('p1', 5, 5)]), NO_PHOTOMETRY).areas;
        expect(area.reflectances).toEqual({ floor: 0.2, ceiling: null });
    });

    it('bajo un techado el techo (70 %) devuelve luz al suelo: más Ēm que sin reflexión', () => {
        const canopy = (ceilingReflectance: number) =>
            square('techo', 'canopy', 0, 0, 10, {
                config: {
                    kind: 'canopy',
                    heightM: 3,
                    roof: 'flat',
                    translucent: false,
                    columnSpacingM: 5,
                    columnDiameterM: 0.2,
                    lights: { enabled: true, count: 4, columns: 2, rows: 2, lumens: 3000, wattage: 30 },
                } as SiteElement['config'],
                calcSurface: { ceilingReflectance },
            });
        const withRoof = calculateSiteLighting(site([canopy(0.7)]), NO_PHOTOMETRY).areas[0];
        const black = calculateSiteLighting(site([canopy(0)]), NO_PHOTOMETRY).areas[0];
        expect(withRoof.reflectances.ceiling).toBe(0.7);
        expect(withRoof.luminairesUsed).toBe(4);
        expect(withRoof.result.avg_lux).toBeGreaterThan(black.result.avg_lux);
    });
});

describe('techado duplicado encima de otro', () => {
    it('sus luminarias pasan al espacio que lo cubre (no se pierden)', () => {
        const canopy = (id: string, lights: boolean) =>
            square(id, 'canopy', 0, 0, 10, {
                config: {
                    kind: 'canopy',
                    heightM: 3,
                    roof: 'flat',
                    translucent: false,
                    columnSpacingM: 5,
                    columnDiameterM: 0.2,
                    lights: { enabled: lights, count: 4, columns: 2, rows: 2, lumens: 3000, wattage: 30 },
                } as SiteElement['config'],
            });
        const calc = calculateSiteLighting(site([canopy('visible', false), canopy('duplicado', true)]), NO_PHOTOMETRY);
        expect(calc.areas).toHaveLength(1);
        expect(calc.areas[0].ownLuminaires).toBe(4);
        expect(calc.areas[0].result.avg_lux).toBeGreaterThan(0);
    });
});
