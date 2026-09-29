import { describe, expect, it } from 'vitest';
import { calculateSiteLighting } from '../domain/siteLightingCalculation';
import type { SiteData, SiteElement } from '../domain/types';
import { calculateSiteLightingAsync } from './siteLightingWorkerClient';

const square = (id: string, type: SiteElement['type'], x0: number, size: number, extra: Partial<SiteElement> = {}): SiteElement => ({
    id,
    type,
    label: id,
    vertices: [
        { x: x0, y: 0 },
        { x: x0 + size, y: 0 },
        { x: x0 + size, y: size },
        { x: x0, y: size },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
    ...extra,
});

describe('cálculo de alumbrado fuera del hilo de la interfaz (C4)', () => {
    it('sin Worker disponible calcula en el hilo principal con el MISMO resultado', async () => {
        const site = {
            schemaVersion: 1,
            terrainScaleM: 1,
            layers: [],
            elements: [
                square('patio', 'custom_zone', 0, 10),
                {
                    ...square('p1', 'pole', 5, 0.2),
                    config: { kind: 'pole', heightM: 6, armLengthM: 0, armDirectionDeg: 0, fixtures: 1, lumens: 5000 },
                } as SiteElement,
            ],
        } as unknown as SiteData;
        const expected = calculateSiteLighting(site, new Map());
        const result = await calculateSiteLightingAsync(site, new Map());
        expect(result.areas.map((area) => area.result.avg_lux)).toEqual(expected.areas.map((area) => area.result.avg_lux));
        expect(result.areas[0].result.avg_lux).toBeGreaterThan(0);
    });
});
