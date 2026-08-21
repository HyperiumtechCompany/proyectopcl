import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fixture } from '@/pages/dialux/hooks/types';
import type { DialuxExportSnapshot } from '../../domain/types';
import { enrichProducts } from './enrichProducts';

vi.mock('axios');

function buildFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'fx-1',
        name: 'Luminaria de prueba',
        x: 0,
        y: 0,
        z: 2.5,
        rotation: 0,
        lumens: 3000,
        efficiency: 100,
        fixtureType: 'downlight',
        lightColor: '#ffffff',
        ...overrides,
    } as Fixture;
}

function buildSnapshot(fixtures: Fixture[]): DialuxExportSnapshot {
    return { fixtures } as unknown as DialuxExportSnapshot;
}

describe('Fase 15 — enrichProducts (Parte A: CDL polar sin dependencia de red)', () => {
    beforeEach(() => {
        vi.mocked(axios.get).mockReset();
    });

    it('usa fixture.reportAssets.polar_svg local sin depender de que la red responda', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('irrelevante para la CDL: ya está resuelta localmente'));
        const fixture = buildFixture({
            productId: 42,
            reportAssets: { polar_svg: '<svg>local</svg>' },
        });
        const snapshot = buildSnapshot([fixture]);

        const result = await enrichProducts(snapshot);

        expect(fixture.polarDiagramAssetId).toBe(`fixture-${fixture.id}-polar`);
        expect(result.assets.some((a) => a.id === fixture.polarDiagramAssetId)).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('si la red falla pero hay photometricWeb local, genera la CDL de todos modos', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Network down'));
        const fixture = buildFixture({
            productId: 7,
            photometricWeb: {
                c_angles: [0],
                gamma_angles: [0, 30, 60, 90],
                candela: [[1000, 800, 400, 0]],
            },
        });
        const snapshot = buildSnapshot([fixture]);

        const result = await enrichProducts(snapshot);

        expect(fixture.polarDiagramAssetId).toBe(`fixture-${fixture.id}-polar-generated`);
        expect(result.assets.some((a) => a.id === fixture.polarDiagramAssetId)).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('si la red falla y no hay ningún dato local, advierte con productId y causa (sin reventar el export)', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('HTTP 500'));
        const fixture = buildFixture({ productId: 9 });
        const snapshot = buildSnapshot([fixture]);

        const result = await enrichProducts(snapshot);

        expect(fixture.polarDiagramAssetId).toBeUndefined();
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('9');
        expect(result.warnings[0]).toContain('HTTP 500');
    });

    it('sin productId y sin datos locales, no advierte (no es un fixture de catálogo)', async () => {
        const fixture = buildFixture();
        const snapshot = buildSnapshot([fixture]);

        const result = await enrichProducts(snapshot);

        expect(fixture.polarDiagramAssetId).toBeUndefined();
        expect(result.warnings).toHaveLength(0);
    });

    it('la fuente local tiene prioridad sobre el catálogo remoto aunque la red responda con otra CDL', async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: { product: { name: 'Producto X', report_assets: { polar_svg: '<svg>remoto</svg>' } } },
        });
        const fixture = buildFixture({
            productId: 3,
            reportAssets: { polar_svg: '<svg>local</svg>' },
        });
        const snapshot = buildSnapshot([fixture]);

        const result = await enrichProducts(snapshot);

        expect(fixture.polarDiagramAssetId).toBe(`fixture-${fixture.id}-polar`);
        const asset = result.assets.find((a) => a.id === fixture.polarDiagramAssetId);
        expect(asset && 'svg' in asset ? asset.svg : null).toBe('<svg>local</svg>');
    });

    it('copia la matriz remota al fixture para generar CDL polar y tabla UGR del PDF', async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                product: {
                    name: 'Producto fotométrico',
                    photometric_web: {
                        c_angles: [0],
                        gamma_angles: [0, 30, 60, 90],
                        candela: [[1000, 800, 400, 0]],
                        provenance: 'manufacturer',
                        reference_lumens: 3000,
                    },
                },
            },
        });
        const fixture = buildFixture({ productId: 14 });

        const result = await enrichProducts(buildSnapshot([fixture]));

        expect(fixture.photometricWeb).toBeTruthy();
        expect(fixture.polarDiagramAssetId).toBe('fixture-fx-1-polar-generated');
        expect(result.assets.some((asset) => asset.id === fixture.polarDiagramAssetId)).toBe(true);
        expect(fixture.reportData?.ugrTablesComputed).toBeTruthy();
    });
});
