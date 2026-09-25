import { describe, expect, it } from 'vitest';
import {
    DEFAULT_AUTO_CIRCUIT_RULES,
    nearestNeighbourChain,
    planAutoCircuits,
    sweepOrder,
} from './siteAutoCircuit';
import { analyzeSiteOutputs } from './siteOutputs';
import type { SiteCircuit, SiteData, SiteElement } from './types';

const SETTINGS = {
    nominalVoltageV: 380,
    phases: 3 as const,
    connectionType: 'star' as const,
    defaultPowerFactor: 0.9,
    designFactor: 1.25,
};

const box = (x: number, y: number, half = 0.3) => [
    { x: x - half, y: y - half },
    { x: x + half, y: y - half },
    { x: x + half, y: y + half },
    { x: x - half, y: y + half },
];

const tg = (id = 'tg', x = 0, y = 0): SiteElement => ({
    id,
    type: 'tg_location',
    label: id.toUpperCase(),
    vertices: box(x, y, 0.5),
    config: { kind: 'tg', mount: 'floor', widthM: 1.2, depthM: 0.4, heightM: 2 },
    style: { fillColor: '#000', strokeColor: '#000' },
});

const pole = (id: string, x: number, y: number, wattage = 100): SiteElement => ({
    id,
    type: 'pole',
    label: id,
    vertices: box(x, y),
    config: { kind: 'pole', heightM: 6, armLengthM: 0, armDirectionDeg: 0, fixtures: 1, wattage },
    style: { fillColor: '#000', strokeColor: '#000' },
});

const outlet = (id: string, x: number, y: number): SiteElement => ({
    id,
    type: 'outlet',
    label: id,
    vertices: box(x, y),
    config: { kind: 'outlet', heightM: 0.4, powerW: 180 },
    style: { fillColor: '#000', strokeColor: '#000' },
});

const site = (elements: SiteElement[], circuits: SiteCircuit[] = []): SiteData => ({
    schemaVersion: 1,
    terrainScaleM: 1,
    gridSizeM: 1,
    canvasWidth: 400,
    canvasHeight: 400,
    elements,
    feederPaths: [],
    circuits,
    layers: [],
});

/** 30 postes de 100 W en un anillo de 40 m alrededor del TG + 6 tomacorrientes. */
function campus() {
    const poles = Array.from({ length: 30 }, (_, i) => {
        const a = (i / 30) * 2 * Math.PI;
        return pole(`p${i}`, 40 * Math.cos(a), 40 * Math.sin(a));
    });
    const outlets = Array.from({ length: 6 }, (_, i) => outlet(`o${i}`, 10 + i * 3, 5));
    return site([tg(), ...poles, ...outlets]);
}

describe('auto-circuitado de la planta (E1)', () => {
    it('agrupa sin superar potencia ni puntos, separando alumbrado y tomas', () => {
        const plan = planAutoCircuits(campus(), 'tg', SETTINGS);
        const lighting = plan.groups.filter((g) => g.kind === 'lighting');
        const outlets = plan.groups.filter((g) => g.kind === 'outlets');
        expect(lighting.flatMap((g) => g.loadIds)).toHaveLength(30);
        expect(outlets.flatMap((g) => g.loadIds)).toHaveLength(6);
        for (const group of lighting) {
            expect(group.powerW).toBeLessThanOrEqual(DEFAULT_AUTO_CIRCUIT_RULES.maxLightingW);
            expect(group.loadIds.length).toBeLessThanOrEqual(DEFAULT_AUTO_CIRCUIT_RULES.maxLightingPoints);
            expect(group.loadIds.every((id) => id.startsWith('p'))).toBe(true);
        }
        // 30 postes / máx. 12 puntos → 3 circuitos de alumbrado.
        expect(lighting).toHaveLength(3);
        // 6 tomas × 180 W = 1080 W ≤ 1800 W → un circuito.
        expect(outlets).toHaveLength(1);
    });

    it('cada carga queda en exactamente un circuito y los cables forman una cadena desde el tablero', () => {
        const plan = planAutoCircuits(campus(), 'tg', SETTINGS);
        const all = plan.groups.flatMap((g) => g.loadIds);
        expect(new Set(all).size).toBe(all.length);
        expect(plan.circuits).toHaveLength(36);
        const roots = plan.circuits.filter((c) => c.sourceId === 'tg');
        expect(roots).toHaveLength(plan.groups.length);
        expect(roots.every((c) => c.phase)).toBe(true);
    });

    it('reparte las fases: la diferencia entre fases no supera la mayor salida', () => {
        const plan = planAutoCircuits(campus(), 'tg', SETTINGS);
        const load = { R: 0, S: 0, T: 0 };
        for (const group of plan.groups) load[group.phase] += group.powerW;
        const values = Object.values(load);
        const biggest = Math.max(...plan.groups.map((g) => g.powerW));
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(biggest);
        expect(new Set(plan.groups.map((g) => g.phase)).size).toBe(3);
    });

    it('la sección elegida deja la ΔU dentro del límite del motor CT de la V1 (verificado al aplicar)', () => {
        const base = campus();
        const plan = planAutoCircuits(base, 'tg', SETTINGS);
        expect(plan.groups.every((g) => g.ok)).toBe(true);
        const applied = site(base.elements, plan.circuits.map((c, i) => ({ ...c, id: `c${i}`, calculatedLengthM: 0 })));
        const rows = analyzeSiteOutputs(applied, SETTINGS).rows.filter((r) => r.panelElementId === 'tg');
        expect(rows).toHaveLength(plan.groups.length);
        for (const row of rows) {
            expect(row.voltageDropOk).toBe(true);
            expect(row.capacityConforms).toBe(true);
        }
        // Cada fila usa la fase que eligió el auto-circuitado.
        expect(new Set(rows.map((r) => r.phaseBalance))).toEqual(new Set(plan.groups.map((g) => g.phase)));
    });

    it('recorridos largos suben la sección', () => {
        const far = site([tg(), ...Array.from({ length: 10 }, (_, i) => pole(`p${i}`, 120 + i * 25, 0, 150))]);
        const plan = planAutoCircuits(far, 'tg', SETTINGS);
        expect(plan.groups[0].sectionMm2).toBeGreaterThan(2.5);
    });

    it('no toca cargas ya cableadas y asigna cada carga al tablero más cercano', () => {
        const base = site([tg('tg', 0, 0), tg('tg2', 100, 0), pole('a', 10, 0), pole('b', 90, 0), pole('c', 5, 5)], [
            { id: 'x', sourceId: 'tg', targetId: 'c', waypoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }], calculatedLengthM: 7, wireCount: 3 },
        ]);
        const plan = planAutoCircuits(base, 'tg', SETTINGS);
        expect(plan.groups.flatMap((g) => g.loadIds)).toEqual(['a']);
    });

    it('agrega salidas al TG si faltan libres', () => {
        const many = site([tg(), ...Array.from({ length: 70 }, (_, i) => pole(`p${i}`, 30 * Math.cos(i), 30 * Math.sin(i)))]);
        const plan = planAutoCircuits(many, 'tg', SETTINGS);
        expect(plan.groups.length).toBeGreaterThan(5);
        expect(plan.tgOutputs!.length).toBeGreaterThanOrEqual(plan.groups.length);
        expect(new Set(plan.groups.map((g) => g.tgOutputId)).size).toBe(plan.groups.length);
    });

    it('barrido angular empieza tras el mayor hueco; cadena por vecino más cercano', () => {
        const order = sweepOrder({ x: 0, y: 0 }, [
            { id: 'a', at: { x: 1, y: 0.1 } },
            { id: 'b', at: { x: 1, y: -0.1 } },
            { id: 'c', at: { x: -1, y: 0 } },
        ]);
        expect(order.map((p) => p.id)).toEqual(['c', 'b', 'a']);
        expect(
            nearestNeighbourChain({ x: 0, y: 0 }, [
                { id: 'far', at: { x: 10, y: 0 } },
                { id: 'near', at: { x: 1, y: 0 } },
                { id: 'mid', at: { x: 5, y: 0 } },
            ]),
        ).toEqual(['near', 'mid', 'far']);
    });

    it('un tomacorriente antiguo sin altura usa 0,4 m (sin NaN en la ΔU)', () => {
        const legacy: SiteElement = { ...outlet('old', 8, 0), config: { kind: 'outlet' } as SiteElement['config'] };
        const plan = planAutoCircuits(site([tg(), legacy]), 'tg', SETTINGS);
        expect(Number.isFinite(plan.groups[0].voltageDropPct)).toBe(true);
        expect(plan.groups[0].ok).toBe(true);
    });
});
