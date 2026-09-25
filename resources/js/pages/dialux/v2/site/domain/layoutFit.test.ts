import { describe, expect, it } from 'vitest';
import { fitRampToBox, layoutExtent, polygonForLayout, stairRunDirection } from './layoutFit';
import { stairAsRampConfig } from './rampLayout';
import { buildStraightRampLayout } from './rampLayout';
import { planStairFlights } from './siteNorms';
import type { RampConfig } from './types';

/** Rampa en zigzag de 3 tramos hacia el Este con vueltas en U (como la del proyecto). */
function zigzag(lengthM = 10, widthM = 3): RampConfig {
    return {
        kind: 'ramp',
        fromElevationM: 0,
        toElevationM: 1.5,
        widthM,
        flights: [
            { id: 'f1', direction: 'east', lengthM, riseM: 0.5, turnAfterDeg: 180 },
            { id: 'f2', direction: 'east', lengthM, riseM: 0.5, turnAfterDeg: -180 },
            { id: 'f3', direction: 'east', lengthM, riseM: 0.5 },
        ],
    };
}

describe('site/domain/layoutFit', () => {
    it('si ya cabe en el espacio no toca nada', () => {
        const cfg = zigzag();
        const e = layoutExtent(buildStraightRampLayout(cfg));
        const fit = fitRampToBox(cfg, e.width + 1, e.depth + 1);
        expect(fit.changed).toBe(false);
        expect(fit.config).toBe(cfg);
    });

    it('si sobresale, estrecha/acorta hasta que cabe en la caja dibujada', () => {
        const cfg = zigzag();
        const before = layoutExtent(buildStraightRampLayout(cfg));
        const boxW = before.width * 0.8;
        const boxD = before.depth * 0.8;
        const fit = fitRampToBox(cfg, boxW, boxD);
        expect(fit.changed).toBe(true);
        expect(fit.overflowXM).toBe(0);
        expect(fit.overflowZM).toBe(0);
        const after = layoutExtent(buildStraightRampLayout(fit.config));
        expect(after.width).toBeLessThanOrEqual(boxW + 0.05);
        expect(after.depth).toBeLessThanOrEqual(boxD + 0.05);
        // La cota de cada tramo no cambia (solo largo/ancho).
        expect(fit.config.flights?.map((f) => f.riseM)).toEqual([0.5, 0.5, 0.5]);
    });

    it('prefiere conservar el ancho: solo acorta el largo si el ancho ya cabe', () => {
        const cfg = zigzag(10, 3);
        const before = layoutExtent(buildStraightRampLayout(cfg));
        const fit = fitRampToBox(cfg, before.width * 0.7, before.depth + 1);
        expect(fit.config.widthM).toBeCloseTo(3);
        expect(fit.config.flights![0].lengthM).toBeLessThan(10);
    });

    it('con un espacio imposible informa lo que sobresale', () => {
        const fit = fitRampToBox(zigzag(), 3, 2);
        expect(fit.overflowXM + fit.overflowZM).toBeGreaterThan(0);
    });

    it('con lockLengths (escaleras) solo cambia el ancho', () => {
        const cfg = zigzag(6, 3);
        const before = layoutExtent(buildStraightRampLayout(cfg));
        const fit = fitRampToBox(cfg, before.width + 1, before.depth * 0.7, {
            lockLengths: true,
            minWidthM: 0.9,
        });
        expect(fit.config.flights!.map((f) => f.lengthM)).toEqual([6, 6, 6]);
        expect(fit.config.widthM).toBeLessThan(3);
    });

    it('una rampa clásica de un solo tramo (sin flights) no se ajusta', () => {
        const cfg: RampConfig = { kind: 'ramp', fromElevationM: 0, toElevationM: 1, widthM: 2 };
        expect(fitRampToBox(cfg, 1, 1).changed).toBe(false);
    });

    it('escalera vertical (sur): al ensanchar, el polígono crece en HORIZONTAL y no en vertical', () => {
        const poly = [
            { x: 0, y: 0 },
            { x: 1.2, y: 0 },
            { x: 1.2, y: 8 },
            { x: 0, y: 8 },
        ];
        const stair = { kind: 'stair' as const, fromElevationM: 0, toElevationM: 2.1, widthM: 3, run: 'straight' as const, direction: 'south' as const, fitToPolygon: false };
        const before = layoutExtent(buildStraightRampLayout(stairAsRampConfig({ ...stair, widthM: 1.2 }, 'south')));
        const rect = polygonForLayout({ vertices: poly }, 1, stairAsRampConfig(stair, 'south'), 'x')!;
        const w = Math.max(...rect.map((p) => p.x)) - Math.min(...rect.map((p) => p.x));
        const h = Math.max(...rect.map((p) => p.y)) - Math.min(...rect.map((p) => p.y));
        expect(w).toBeCloseTo(3, 1); // el ancho pedido, en horizontal
        expect(h).toBeGreaterThanOrEqual(8 - 1e-6); // el largo no se encoge
        expect(h).toBeCloseTo(Math.max(8, before.depth), 1); // y con descansos fijos no crece por ensanchar
    });

    it('el sentido elegido manda sobre la forma del polígono', () => {
        const wide = { vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 0, y: 2 }] };
        expect(stairRunDirection(undefined, wide, 1)).toBe('east');
        expect(stairRunDirection({ direction: 'south' }, wide, 1)).toBe('south');
    });

    it('el fondo del descanso configurado no depende del ancho', () => {
        const auto = planStairFlights(3.5, 4, 10);
        const fixed = planStairFlights(3.5, 4, 10, 'straight', false, 1.5);
        expect(auto[0].landingLengthM).toBe(4);
        expect(fixed[0].landingLengthM).toBe(1.5);
    });
});
