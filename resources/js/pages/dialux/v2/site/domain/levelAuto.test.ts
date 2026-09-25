import { describe, expect, it } from 'vitest';
import { layoutExtent } from './layoutFit';
import {
    applyAutoLinkToRamp,
    autoLinkLevels,
    autoLinkStairFromPolygon,
    naturalFootprint,
    platformAtPoint,
} from './levelAuto';
import { buildStraightRampLayout } from './rampLayout';
import type { RampConfig, SiteElement } from './types';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
];
const platform = (id: string, verts: SiteElement['vertices'], cota: number): SiteElement => ({
    id,
    type: 'terrace_platform',
    label: id,
    vertices: verts,
    baseElevationM: cota,
    style: { fillColor: '#000', strokeColor: '#000' },
});

/** Escalera-rampa recta al Este de 12 m (INICIO x≈-6.75, FIN x≈+6.75 con descanso). */
const cfg: RampConfig = {
    kind: 'ramp',
    fromElevationM: 0,
    toElevationM: 3.35,
    widthM: 2,
    arrivalLandingM: 1.5,
    fitToPolygon: false,
    flights: [{ id: 'f1', direction: 'east', lengthM: 12, riseM: 3.35 }],
};
const poly = { vertices: rect(-7, -1, 7, 1) };

describe('site/domain/levelAuto', () => {
    it('con plataformas anidadas elige la más ALTA que contiene el punto', () => {
        const low = platform('low', rect(-50, -50, 50, 50), 0);
        const high = platform('high', rect(5, -10, 30, 10), 3.35);
        const at = platformAtPoint({ x: 10, y: 0 }, [low, high], 1);
        expect(at?.platform.id).toBe('high');
        expect(at?.elevationM).toBe(3.35);
    });

    it('deduce origen bajo y destino alto, sin invertir cuando INICIO cae en la baja', () => {
        const low = platform('low', rect(-30, -10, -6, 10), 0);
        const high = platform('high', rect(6, -10, 30, 10), 3.35);
        const link = autoLinkLevels(poly, [low, high], 1, cfg)!;
        expect(link.fromElevationM).toBe(0);
        expect(link.toElevationM).toBe(3.35);
        expect(link.reversed).toBe(false);
    });

    it('invierte el recorrido si INICIO cae del lado de la plataforma alta', () => {
        const high = platform('high', rect(-30, -10, -6, 10), 3.35);
        const low = platform('low', rect(6, -10, 30, 10), 0);
        const link = autoLinkLevels(poly, [high, low], 1, cfg)!;
        expect(link.fromElevationM).toBe(0);
        expect(link.toElevationM).toBe(3.35);
        expect(link.reversed).toBe(true);
    });

    it('sin plataforma en un extremo, o con la misma cota, no deduce nada', () => {
        const low = platform('low', rect(-30, -10, -6, 10), 0);
        expect(autoLinkLevels(poly, [low], 1, cfg)).toBeNull();
        const same = platform('same', rect(6, -10, 30, 10), 0);
        expect(autoLinkLevels(poly, [low, same], 1, cfg)).toBeNull();
    });

    it('al cambiar el desnivel regenera los tramos; si no cambia, los respeta', () => {
        const link = { fromElevationM: 0, toElevationM: 1.5, reversed: false } as never;
        const changed = applyAutoLinkToRamp(cfg, link);
        expect(changed.toElevationM).toBe(1.5);
        expect(changed.flights!.reduce((s, f) => s + f.riseM, 0)).toBeCloseTo(1.5, 2);
        const same = applyAutoLinkToRamp(cfg, { fromElevationM: 0, toElevationM: 3.35, reversed: true } as never);
        expect(same.flights).toBe(cfg.flights);
        expect(same.reversed).toBe(true);
    });

    it('escalera: deduce cotas y sentido por los extremos del polígono, con plataformas anidadas', () => {
        const ground = platform('ground', rect(-100, -100, 100, 100), 0);
        const upper = platform('upper', rect(0, -10, 40, 10), 3.35);
        // Trazo de 20 m de largo (x de -10 a 10): el extremo este cae en la plataforma alta.
        const link = autoLinkStairFromPolygon({ vertices: rect(-10, -1, 10, 1) }, [ground, upper], 1)!;
        expect(link.fromElevationM).toBe(0);
        expect(link.toElevationM).toBe(3.35);
        expect(link.reversed).toBe(false);
        // Espejado: la alta queda al oeste → el recorrido se invierte.
        const upperW = platform('upperW', rect(-40, -10, 0, 10), 3.35);
        const back = autoLinkStairFromPolygon({ vertices: rect(-10, -1, 10, 1) }, [ground, upperW], 1)!;
        expect(back.reversed).toBe(true);
    });

    it('el rectángulo natural coincide con la caja del recorrido', () => {
        const rectPts = naturalFootprint(poly, 1, cfg)!;
        const ext = layoutExtent(buildStraightRampLayout(cfg));
        const xs = rectPts.map((p) => p.x);
        expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(ext.width, 5);
    });
});
