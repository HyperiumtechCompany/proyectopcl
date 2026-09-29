import { describe, expect, it } from 'vitest';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import { conductorResistivity } from '../../electrical-network/domain/feederVoltageDrop';
import type { ModuleElectricalPort } from '../../electrical-network/domain/types';
import {
    blockFeedOrigin,
    buildingFeedRows,
    buildingsCrossed,
    reachablePassThroughs,
    moduleWorstCircuit,
    proposeBlockCableRoute,
    suggestFeederSection,
} from './blockConnection';
import type { SiteData, SiteElement } from './types';
import { buildingEntryPoint, resolveWireEndpoints } from './wireAnchors';

const block = (id: string, x0: number, y0: number, w: number, h: number): SiteElement => ({
    id,
    type: 'building_block',
    label: id,
    vertices: [
        { x: x0, y: y0 },
        { x: x0 + w, y: y0 },
        { x: x0 + w, y: y0 + h },
        { x: x0, y: y0 + h },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
});

describe('acometida del edificio', () => {
    it('el cable llega a la FACHADA más cercana, no al centro del bloque', () => {
        const edificio = block('m1', 10, 0, 10, 10);
        expect(buildingEntryPoint(edificio, { x: 0, y: 5 })).toEqual({ x: 10, y: 5 });
        const tg: SiteElement = { ...block('tg', -1, 4, 2, 2), type: 'tg_location' };
        const resolved = resolveWireEndpoints(
            [{ x: 0, y: 5 }, { x: 15, y: 5 }],
            'tg',
            'm1',
            (id) => (id === 'm1' ? edificio : id === 'tg' ? tg : undefined),
            1,
        );
        expect(resolved[resolved.length - 1]).toEqual({ x: 10, y: 5 });
    });
});

describe('recorrido propuesto tablero → edificio', () => {
    it('recto si no hay edificios en medio', () => {
        const route = proposeBlockCableRoute({ x: 0, y: 5 }, block('m1', 10, 0, 10, 10), [], 1);
        expect(route.waypoints).toEqual([{ x: 0, y: 5 }, { x: 10, y: 5 }]);
        expect(route.crossings).toBe(0);
    });

    it('rodea en L un edificio que está en la línea recta', () => {
        const target = block('m1', 20, 20, 10, 10);
        const obstacle = block('otro', 8, 8, 6, 6);
        const elements = [target, obstacle];
        const direct = [{ x: 0, y: 0 }, buildingEntryPoint(target, { x: 0, y: 0 })];
        expect(buildingsCrossed(direct, elements, new Set(['m1']), 1)).toBe(1);
        const route = proposeBlockCableRoute({ x: 0, y: 0 }, target, elements, 1);
        expect(route.crossings).toBe(0);
        expect(route.waypoints).toHaveLength(3);
        // Termina en la fachada del edificio destino.
        const last = route.waypoints[route.waypoints.length - 1];
        expect(last.x === 20 || last.y === 20).toBe(true);
    });
});

describe('sección sugerida del alimentador al edificio (C3)', () => {
    // Caso a mano (IEC 60364-5-52 Anexo G): 3Φ 380 V, I = 40 A, L = 120 m,
    // cos φ = 0,9, cobre a 70 °C, λ = 0,08 mΩ/m.
    // ΔU% = √3·I·L·(ρ·cosφ/S + λ·senφ) / 380 · 100
    const rho = conductorResistivity('cobre', 70);
    const hand = (section: number) =>
        ((Math.sqrt(3) * 40 * 120 * ((rho * 0.9) / section + 0.08e-3 * Math.sqrt(1 - 0.81))) / 380) * 100;
    const base = {
        currentA: 40,
        lengthM: 120,
        voltageV: 380,
        phases: 3 as const,
        powerFactor: 0.9,
        material: 'cobre' as const,
        temperatureC: 70,
        feederLimitPercent: 2.5,
        totalLimitPercent: 4,
    };

    it('elige la menor sección normalizada que cumple el límite propio Y el de punta a punta', () => {
        const upstream = 0.8;
        const downstream = 1.5;
        const result = suggestFeederSection({ ...base, upstreamPercent: upstream, downstreamPercent: downstream })!;
        const expected = [2.5, 4, 6, 10, 16, 25, 35, 50].find(
            (s) => hand(s) <= 2.5 && upstream + hand(s) + downstream <= 4,
        );
        expect(result.sectionMm2).toBe(expected);
        expect(result.ownPercent).toBeCloseTo(hand(result.sectionMm2), 9);
        expect(result.totalPercent).toBeCloseTo(upstream + hand(result.sectionMm2) + downstream, 9);
        // La inmediata inferior no cumplía.
        const previous = [2.5, 4, 6, 10, 16, 25, 35, 50][[2.5, 4, 6, 10, 16, 25, 35, 50].indexOf(result.sectionMm2) - 1];
        expect(hand(previous) > 2.5 || upstream + hand(previous) + downstream > 4).toBe(true);
    });

    it('respeta la sección mínima por ampacidad y avisa si nada cumple', () => {
        expect(suggestFeederSection({ ...base, upstreamPercent: 0, downstreamPercent: 0, minSectionMm2: 70 })?.sectionMm2).toBe(70);
        // Lo de aguas arriba + el módulo ya agotan el 4 %: ninguna sección alcanza.
        expect(suggestFeederSection({ ...base, upstreamPercent: 2, downstreamPercent: 2.1 })).toBeNull();
    });
});

describe('filas edificio → alimentador → punta a punta', () => {
    it('una fila por cable a un edificio de módulo, con el circuito más desfavorable', () => {
        const edificio = { ...block('m1', 10, 0, 10, 10), moduleId: 8, moduleName: 'Módulo 1' };
        const tg: SiteElement = { ...block('tg', -1, 4, 2, 2), type: 'tg_location', label: 'TG' };
        const site = {
            schemaVersion: 1,
            terrainScaleM: 1,
            elements: [edificio, tg],
            circuits: [{ id: 'c1', sourceId: 'tg', targetId: 'm1', waypoints: [], wireCount: 4, wastePct: 0, interiorLengthM: 6 }],
        } as unknown as SiteData;
        const feeds = {
            c1: {
                edgeId: 'e',
                fromLabel: 'TG',
                toLabel: 'TD-01',
                moduleName: 'Módulo 1',
                sectionMm2: 10,
                conductorType: 'N2XOH',
                calculation: { accumulatedVoltageDropPercent: 1.1, lengthM: 42 } as EdgeCalculation,
            },
        };
        const ports = [
            {
                moduleId: 8,
                panelLabel: 'TD-01',
                circuits: [
                    { code: 'C-1', cumulativeVoltageDropPct: 0.9 },
                    { code: 'C-4', cumulativeVoltageDropPct: 2.4 },
                ],
            },
        ] as unknown as ModuleElectricalPort[];
        expect(moduleWorstCircuit(ports, 8)).toEqual({ code: 'C-4', panelLabel: 'TD-01', percent: 2.4 });
        const [row] = buildingFeedRows(site, feeds, ports, { feederPercent: 2.5, totalPercent: 4 });
        expect(row).toMatchObject({ blockLabel: 'm1', panelLabel: 'TD-01', interiorLengthM: 6, feederPercent: 1.1, withinLimits: true });
        expect(row.totalPercent).toBeCloseTo(3.5, 9);
        expect(buildingFeedRows(site, feeds, ports, { feederPercent: 2.5, totalPercent: 3 })[0].withinLimits).toBe(false);
    });
});

describe('cables por cajas de pase', () => {
    const box = (id: string, x: number, y: number): SiteElement => ({
        id,
        type: 'pull_box',
        label: id,
        vertices: [{ x, y }],
        style: { fillColor: '#000', strokeColor: '#000' },
    });
    const tg: SiteElement = { id: 'tg', type: 'tg_location', label: 'TG', vertices: [{ x: 0, y: 0 }], style: { fillColor: '#000', strokeColor: '#000' } };
    const cable = (id: string, sourceId: string, targetId: string, points: Array<[number, number]>) => ({
        id,
        sourceId,
        targetId,
        waypoints: points.map(([x, y]) => ({ x, y })),
        calculatedLengthM: 0,
        wireCount: 4,
        wastePct: 0,
    });

    it('el punto dibujado sobre OTRA caja de pase se conserva (el cable pasa por ella); si no, sigue al objeto', () => {
        const elements = [tg, box('A', 20, 0), box('B', 20, 10)];
        const byId = (id: string) => elements.find((element) => element.id === id);
        // Dibujado TG → caja A, pero guardado con destino caja B: pasa por A y sigue a B.
        expect(resolveWireEndpoints([{ x: 0, y: 0 }, { x: 20, y: 0 }], 'tg', 'B', byId, 1, undefined, elements)).toEqual([
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
        ]);
        // Punto viejo que no es una caja (el objeto se movió): se reemplaza como siempre.
        expect(resolveWireEndpoints([{ x: 0, y: 0 }, { x: 25, y: 3 }], 'tg', 'B', byId, 1, undefined, elements)).toEqual([
            { x: 0, y: 0 },
            { x: 20, y: 10 },
        ]);
    });

    it('conectar un edificio sale de la caja de pase alcanzable más cercana, no del tablero', () => {
        const edificio = block('m1', 40, -5, 10, 10);
        const site = {
            schemaVersion: 1,
            terrainScaleM: 1,
            elements: [tg, box('A', 20, 0), box('B', 36, 0), box('suelta', 39, 0), edificio],
            circuits: [cable('c1', 'tg', 'A', [[0, 0], [20, 0]]), cable('c2', 'A', 'B', [[20, 0], [36, 0]])],
        } as unknown as SiteData;
        expect(reachablePassThroughs(site, 'tg').map((element) => element.id).sort()).toEqual(['A', 'B']);
        // "suelta" está más cerca pero no está cableada desde el TG: no cuenta.
        const origin = blockFeedOrigin(site, 'tg', edificio, 1)!;
        expect(origin.element.id).toBe('B');
        expect(origin.viaPassThrough).toBe(true);
        expect(origin.distanceM).toBeCloseTo(4, 6);
    });
});
