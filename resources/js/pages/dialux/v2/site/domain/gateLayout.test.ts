import { describe, expect, it } from 'vitest';
import {
    accessLaneRect,
    boothRect,
    entrancePreset,
    gateEntrance,
    gateLightsPowerW,
    DEFAULT_BOOTH,
    gateFrame,
    gateSpanM,
    inwardNormal,
    isSpanGate,
} from './gateLayout';

const a = { x: 0, y: 0 };
const b = { x: 10, y: 0 }; // tramo horizontal de 10 unidades

describe('site/domain/gateLayout', () => {
    it('un portón de 2 puntos es un tramo y su ancho es la distancia × escala', () => {
        const gate = { type: 'gate' as const, vertices: [a, b], config: undefined };
        expect(isSpanGate(gate)).toBe(true);
        expect(gateSpanM(gate, 0.5)).toBeCloseTo(5);
        const point = { type: 'gate' as const, vertices: [a, b, a, b], config: undefined };
        expect(isSpanGate(point)).toBe(false);
        expect(gateSpanM(point, 1)).toBe(4);
    });

    it('la normal izquierda de un tramo hacia el Este apunta al Norte (Y hacia abajo → −y)', () => {
        const n = inwardNormal(gateFrame(a, b, 1), 'left');
        expect(n.x).toBeCloseTo(0);
        expect(n.y).toBeCloseTo(-1);
        const r = inwardNormal(gateFrame(a, b, 1), 'right');
        expect(r.y).toBeCloseTo(1);
    });

    it('el carril de acceso se extiende hacia adentro la profundidad pedida', () => {
        const lane = accessLaneRect(a, b, 0.5, 'right', 6); // 6 m con escala 0.5 → 12 unidades
        expect(lane).toHaveLength(4);
        expect(lane[2].y).toBeCloseTo(12);
        expect(lane[3].y).toBeCloseTo(12);
        expect(lane[2].x).toBeCloseTo(10);
    });

    it('el puesto queda al costado del vano, separado y retranqueado hacia adentro', () => {
        const rect = boothRect(a, b, 1, 'right', { ...DEFAULT_BOOTH, enabled: true });
        const xs = rect.map((p) => p.x);
        const ys = rect.map((p) => p.y);
        // Vano de 10 m centrado en x=5: el puesto empieza 0.8 m después de x=10.
        expect(Math.min(...xs)).toBeCloseTo(10.8);
        expect(Math.max(...xs)).toBeCloseTo(13.3);
        expect(Math.min(...ys)).toBeCloseTo(1);
        expect(Math.max(...ys)).toBeCloseTo(3.5);
    });

    it('con el puesto en el extremo a queda del lado opuesto', () => {
        const rect = boothRect(a, b, 1, 'right', { ...DEFAULT_BOOTH, end: 'a' });
        expect(Math.max(...rect.map((p) => p.x))).toBeCloseTo(-0.8);
    });

    it('la plantilla de servicio activa muros, cubierta y luces; la peatonal las apaga', () => {
        const service = entrancePreset('service');
        expect(service.variant).toBe('open');
        expect(service.canopy?.enabled).toBe(true);
        expect(service.sideWalls?.enabled).toBe(true);
        expect(service.lights?.enabled).toBe(true);
        const ped = entrancePreset('pedestrian');
        expect(ped.canopy?.enabled).toBe(false);
        expect(ped.lights?.enabled).toBe(false);
    });

    it('un portón previo sin cubierta/muros/luces usa defaults apagados y no aporta potencia', () => {
        const e = gateEntrance(undefined);
        expect(e.canopy.enabled).toBe(false);
        expect(gateLightsPowerW({ type: 'gate', config: undefined })).toBe(0);
    });

    it('la potencia del ingreso es cantidad × vatios cuando las luces están activas', () => {
        const cfg = { kind: 'gate' as const, variant: 'open' as const, state: 'closed' as const, openAngleDeg: 0, widthM: 4, lights: { enabled: true, count: 4, heightM: 3, lumens: 1500, wattage: 12 } };
        expect(gateLightsPowerW({ type: 'gate', config: cfg })).toBe(48);
    });
});
