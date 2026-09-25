import { describe, expect, it } from 'vitest';
import {
    calculateShortCircuits,
    defaultTransformerUkPercent,
    thermalConstantK,
} from './shortCircuit';
import type { ElectricalEdge, ElectricalNetworkData } from './types';

const edge = (
    id: string,
    source: string,
    target: string,
    lengthM: number,
    sectionMm2: number,
    conductorType = 'N2XOH',
): ElectricalEdge => ({
    id,
    sourceNodeId: source,
    targetNodeId: target,
    lengthMode: 'manual',
    horizontalLengthM: lengthM,
    verticalLengthM: 0,
    conductorType,
    conductorMaterial: 'copper',
    sectionMm2,
    wireConfiguration: '3F+N+T',
});

function network(edges: ElectricalEdge[]): ElectricalNetworkData {
    return {
        schemaVersion: 1,
        rootNodeId: 'service',
        settings: {
            nominalVoltageV: 380,
            phases: 3,
            connectionType: 'star',
            frequencyHz: 60,
            conductorMaterial: 'copper',
            workingTemperatureC: 40,
            defaultPowerFactor: 0.9,
            feederDropLimitPercent: 2.5,
            totalDropLimitPercent: 4,
        },
        nodes: [
            {
                id: 'service',
                type: 'service',
                label: 'Suministro',
                position: { x: 0, y: 0 },
                transformerKva: 400,
                transformerUkPercent: 4,
                upstreamShortCircuitMva: 500,
            },
            { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 }, breakingCapacityKa: 10 },
            { id: 'td', type: 'site_panel', label: 'TD', position: { x: 0, y: 0 }, phases: 1, nominalVoltageV: 220 },
        ],
        edges,
    };
}

// ─── Caso a mano (IEC 60909-0) ────────────────────────────────────────────
// Un = 380 V, U0 = 219,39 V, c = 1,05.
// Red: Z_Q = 1,05·380² / 500 MVA = 3,0324e-4 Ω → X_Q = 3,0172e-4, R_Q = 3,0172e-5.
// Trafo 400 kVA, uk 4 %: Z_T = 0,04·380² / 400 kVA = 0,01444 Ω (reactancia pura).
const U0 = 380 / Math.sqrt(3);
const ZQ = (1.05 * 380 * 380) / 500e6;
const SOURCE = { r: 0.1 * 0.995 * ZQ, x: 0.995 * ZQ + 0.01444 };
const RHO20 = 1 / 58; // excelCopperResistivity(20)

describe('calculateShortCircuits (R3: IEC 60909-0)', () => {
    it('en bornes del transformador: I″k3 = c·U0 / |Z_Q + Z_T| ≈ 15,6 kA', () => {
        const { nodes } = calculateShortCircuits(network([]), [], []);
        const service = nodes.get('service')!;
        const expected = (1.05 * U0) / Math.hypot(SOURCE.r, SOURCE.x) / 1000;
        expect(service.ikKa).toBeCloseTo(expected, 9);
        expect(service.ikKa).toBeCloseTo(15.63, 1);
        expect(service.kind).toBe('3F');
    });

    it('en el TG, tras 50 m de 35 mm² Cu: se suma la impedancia de fase del cable', () => {
        const { nodes } = calculateShortCircuits(
            network([edge('e1', 'service', 'tg', 50, 35)]),
            [],
            [],
        );
        const z = { r: SOURCE.r + (RHO20 * 50) / 35, x: SOURCE.x + 0.08e-3 * 50 };
        const tg = nodes.get('tg')!;
        expect(tg.ikKa).toBeCloseTo((1.05 * U0) / Math.hypot(z.r, z.x) / 1000, 9);
        expect(tg.ikKa).toBeCloseTo(7.44, 1);
        // Poder de corte 10 kA ≥ 7,44 kA.
        expect(tg.breakingCapacityOk).toBe(true);
    });

    it('un tablero alimentado en 1Φ reporta la falla fase-neutro (lazo 2·Z_L)', () => {
        const { nodes } = calculateShortCircuits(
            network([edge('e1', 'service', 'tg', 50, 35), edge('e2', 'tg', 'td', 20, 10)]),
            [],
            [],
        );
        const zTg = { r: SOURCE.r + (RHO20 * 50) / 35, x: SOURCE.x + 0.08e-3 * 50 };
        const zTd = { r: zTg.r + 2 * ((RHO20 * 20) / 10), x: zTg.x + 2 * 0.08e-3 * 20 };
        const td = nodes.get('td')!;
        expect(td.kind).toBe('1F');
        // El TD declara 220 V: la falla se evalúa con SU tensión (no U0 = 219,39 V).
        expect(td.ikKa).toBeCloseTo((1.05 * 220) / Math.hypot(zTd.r, zTd.x) / 1000, 9);
        expect(td.ikKa).toBeLessThan(nodes.get('tg')!.ikKa);
    });

    it('verificación térmica: S ≥ I″k·√t / k con la I″k del origen del cable', () => {
        const { nodes, edges } = calculateShortCircuits(
            network([
                edge('xlpe', 'service', 'tg', 50, 35, 'N2XOH'),
                edge('pvc', 'tg', 'td', 20, 2.5, 'THW-90'),
            ]),
            [],
            [],
        );
        const ikService = nodes.get('service')!.ikKa;
        const xlpe = edges.get('xlpe')!;
        expect(xlpe.k).toBe(143);
        expect(xlpe.minSectionMm2).toBeCloseTo((ikService * 1000 * Math.sqrt(0.1)) / 143, 9);
        expect(xlpe.ok).toBe(true); // ≈ 34,6 mm² ≤ 35
        const pvc = edges.get('pvc')!;
        expect(pvc.k).toBe(115);
        expect(pvc.ikAtOriginKa).toBeCloseTo(nodes.get('tg')!.ikKa, 12);
        expect(pvc.ok).toBe(false); // ≈ 20 mm² > 2,5
    });

    it('sin potencia de transformador (ni fijada ni con demanda) no calcula esa raíz', () => {
        const net = network([]);
        net.nodes[0] = { ...net.nodes[0], transformerKva: undefined };
        const result = calculateShortCircuits(net, [], []);
        expect(result.rootsWithoutSource).toEqual(['service']);
        expect(result.nodes.size).toBe(0);
    });

    it('uk por defecto (IEC 60076-5) y k (IEC 60364-4-43)', () => {
        expect([400, 630, 1000, 2000].map(defaultTransformerUkPercent)).toEqual([4, 4, 5, 6]);
        expect(thermalConstantK({ ...edge('a', 'x', 'y', 1, 1, 'N2XOH'), conductorMaterial: 'aluminium' })).toBe(94);
        expect(thermalConstantK({ ...edge('a', 'x', 'y', 1, 1, 'THW-90'), conductorMaterial: 'aluminium' })).toBe(76);
    });

    it('I″k3 no depende de estrella/delta (c·Un/√3|Z|) — auditoría R6', () => {
        const star = calculateShortCircuits(network([]), [], []).nodes.get('service')!.ikKa;
        const delta = network([]);
        delta.settings = { ...delta.settings, connectionType: 'delta' };
        expect(calculateShortCircuits(delta, [], []).nodes.get('service')!.ikKa).toBeCloseTo(star, 12);
    });

    it('un tablero 1Φ usa su propia tensión declarada', () => {
        const base = network([edge('e1', 'service', 'tg', 50, 35), edge('e2', 'tg', 'td', 20, 10)]);
        const at220 = calculateShortCircuits(base, [], []).nodes.get('td')!.ikKa;
        base.nodes[2] = { ...base.nodes[2], nominalVoltageV: 230 };
        const at230 = calculateShortCircuits(base, [], []).nodes.get('td')!.ikKa;
        expect(at230 / at220).toBeCloseTo(230 / 220, 9);
    });
});
