import { describe, expect, it } from 'vitest';
import {
    checkLevelLink,
    nearestPlatform,
    shiftToReachArrival,
    suggestCotasFromPlatforms,
} from './levelLink';
import type { RampConfig, SiteElement } from './types';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
];
const el = (
    id: string,
    type: SiteElement['type'],
    vertices: SiteElement['vertices'],
    extra: Partial<SiteElement> = {},
): SiteElement => ({
    id,
    type,
    label: id,
    vertices,
    style: { fillColor: '#000', strokeColor: '#000' },
    ...extra,
});

/** Rampa recta al Este de 12 m, sube 1 m: INICIO en x≈-6, FIN en x≈+6 (+ descanso de llegada). */
const cfg: RampConfig = {
    kind: 'ramp',
    fromElevationM: 0,
    toElevationM: 1,
    widthM: 2,
    arrivalLandingM: 1.5,
    fitToPolygon: false,
    flights: [{ id: 'f1', direction: 'east', lengthM: 12, riseM: 1 }],
};
const ramp = el('ramp', 'ramp', rect(0, -1, 13.5, 1));

describe('site/domain/levelLink', () => {
    it('llega a las dos plataformas cuando cotas y bordes coinciden', () => {
        const low = el('low', 'terrace_platform', rect(-20, -10, 0.5, 10), { baseElevationM: 0, label: 'Baja' });
        const high = el('high', 'terrace_platform', rect(13, -10, 30, 10), { baseElevationM: 1, label: 'Alta' });
        const report = checkLevelLink(ramp, [ramp, low, high], 1, cfg)!;
        expect(report.start.ok).toBe(true);
        expect(report.end.ok).toBe(true);
        expect(report.start.platform?.label).toBe('Baja');
        expect(report.end.platform?.label).toBe('Alta');
    });

    it('avisa si el FIN declara una cota distinta a la de la plataforma vecina', () => {
        const low = el('low', 'terrace_platform', rect(-20, -10, 0.5, 10), { baseElevationM: 0 });
        const wrong = el('wrong', 'terrace_platform', rect(13, -10, 30, 10), { baseElevationM: 3.35, label: 'Plataforma 3.35' });
        const report = checkLevelLink(ramp, [ramp, low, wrong], 1, cfg)!;
        expect(report.end.ok).toBe(false);
        expect(report.end.message).toContain('3.35');
    });

    it('avisa si un extremo queda en el aire', () => {
        const report = checkLevelLink(ramp, [ramp], 1, cfg)!;
        expect(report.start.ok).toBe(false);
        expect(report.start.message).toContain('no toca ninguna plataforma');
    });

    it('detecta que invade una escalera vecina y un poste dentro del layout', () => {
        const stair = el('stair', 'stair', rect(5, -0.5, 8, 0.5));
        const pole = el('pole', 'pole', rect(2.9, -0.1, 3.1, 0.1));
        const report = checkLevelLink(ramp, [ramp, stair, pole], 1, cfg)!;
        expect(report.overlaps.map((o) => o.id)).toEqual(['stair']);
        expect(report.obstacles.map((o) => o.id)).toEqual(['pole']);
    });

    it('una rampa clásica sin tramos no se evalúa', () => {
        const classic: RampConfig = { kind: 'ramp', fromElevationM: 0, toElevationM: 1, widthM: 2 };
        expect(checkLevelLink(ramp, [ramp], 1, classic)).toBeNull();
    });
});


describe('site/domain/levelLink · acciones de conexión', () => {
    const low = el('low', 'terrace_platform', rect(-20, -10, 0.5, 10), { baseElevationM: 0, label: 'Baja' });
    const high = el('high', 'terrace_platform', rect(16, -10, 30, 10), { baseElevationM: 1, label: 'Alta' });

    it('la plataforma más cercana a un punto se elige sin mirar la cota', () => {
        const near = nearestPlatform({ x: 15, y: 0 }, [low, high], 1);
        expect(near?.platform.id).toBe('high');
        expect(near?.distanceM).toBeCloseTo(1);
    });

    it('propone las cotas de las plataformas vecinas de INICIO y FIN', () => {
        const report = checkLevelLink(ramp, [ramp, low, high], 1, { ...cfg, toElevationM: 9 })!;
        expect(suggestCotasFromPlatforms(report, [low, high], 1)).toEqual({
            fromElevationM: 0,
            toElevationM: 1,
        });
    });

    it('calcula el desplazamiento que lleva el FIN al borde de la plataforma de llegada', () => {
        const report = checkLevelLink(ramp, [ramp, low, high], 1, cfg)!;
        expect(report.end.ok).toBe(false); // el FIN queda a 2.5 m del borde
        const shift = shiftToReachArrival(report, [low, high], 1)!;
        expect(shift.x).toBeCloseTo(2.5, 1);
        expect(shift.y).toBeCloseTo(0, 1);
    });
});
