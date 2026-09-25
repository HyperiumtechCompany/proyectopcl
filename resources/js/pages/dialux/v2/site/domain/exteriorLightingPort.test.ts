import { describe, expect, it } from 'vitest';
import {
    buildExteriorLightingPort,
    summarizeExteriorLighting,
} from './exteriorLightingPort';
import type { SiteElement } from './types';

const pole = (id: string, cfg: Partial<{ wattage: number; resolvedWatts: number; fixtures: number }>): SiteElement => ({
    id,
    type: 'pole',
    label: id,
    vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
    config: { kind: 'pole', heightM: 6, armLengthM: 0, armDirectionDeg: 0, fixtures: cfg.fixtures ?? 1, wattage: cfg.wattage, resolvedWatts: cfg.resolvedWatts },
});

const system = { nominalVoltageV: 220, phases: 1 as const, powerFactor: 0.9 };

describe('site/domain/exteriorLightingPort', () => {
    it('suma la potencia de los postes: manual > ficha > referencia', () => {
        const s = summarizeExteriorLighting([
            pole('a', { wattage: 100 }),
            pole('b', { resolvedWatts: 80, fixtures: 2 }),
            pole('c', {}),
        ]);
        expect(s.poles).toBe(3);
        expect(s.installedPowerW).toBe(100 + 160 + 60);
        expect(s.estimatedPoles).toBe(1);
    });

    it('sin postes no hay tablero virtual', () => {
        expect(buildExteriorLightingPort([], 1, system)).toBeNull();
    });

    it('el tablero virtual es raíz, con corriente y demanda coherentes', () => {
        const port = buildExteriorLightingPort([pole('a', { wattage: 990 })], 7, system);
        expect(port).not.toBeNull();
        expect(port!.moduleId).toBe(7);
        expect(port!.parentPanelId).toBeNull();
        expect(port!.demandPowerW).toBe(990);
        expect(port!.currentA).toBeCloseTo(990 / (220 * 0.9), 6);
    });
});
