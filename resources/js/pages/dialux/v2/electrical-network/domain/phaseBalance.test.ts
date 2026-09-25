import { describe, expect, it } from 'vitest';
import type { EdgeCalculation } from './calculations';
import {
    calculatePhaseBalance,
    proposedPhasePatches,
    unbalancePercent,
} from './phaseBalance';
import type { ElectricalEdge, ElectricalNetworkData, ElectricalNode } from './types';

const CURRENTS = [30, 25, 20, 15, 10, 5];

function network(
    extraNodes: Partial<ElectricalNode>[] = [],
    tg: Partial<ElectricalNode> = {},
): { data: ElectricalNetworkData; calculations: EdgeCalculation[] } {
    const singles: ElectricalNode[] = CURRENTS.map((_, index) => ({
        id: `m${index + 1}`,
        type: 'site_panel',
        label: `TD-${index + 1}`,
        phases: 1,
        nominalVoltageV: 220,
        position: { x: 0, y: 0 },
        ...(extraNodes[index] ?? {}),
    }));
    const edges: ElectricalEdge[] = singles.map((node) => ({
        id: `e-${node.id}`,
        sourceNodeId: 'tg',
        targetNodeId: node.id,
        lengthMode: 'manual',
        horizontalLengthM: 10,
        verticalLengthM: 0,
        conductorType: 'N2XOH',
        conductorMaterial: 'copper',
        sectionMm2: 10,
        wireConfiguration: '1F+N+T',
    }));
    return {
        data: {
            schemaVersion: 1,
            rootNodeId: 'tg',
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
                { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 }, ...tg },
                ...singles,
            ],
            edges,
        },
        calculations: edges.map(
            (edge, index) => ({ edgeId: edge.id, currentA: CURRENTS[index] }) as EdgeCalculation,
        ),
    };
}

describe('calculatePhaseBalance (R4)', () => {
    it('LPT reparte 30/25/20/15/10/5 A en 35/35/35 A (desbalance 0 %)', () => {
        const { data, calculations } = network();
        const tg = calculatePhaseBalance(data, [], calculations).get('tg')!;
        expect(tg.currents).toEqual({ R: 35, S: 35, T: 35 });
        expect(tg.unbalancePercent).toBeCloseTo(0, 12);
        expect(tg.usesProposal).toBe(true);
        expect(tg.singlePhaseChildren.map((child) => child.phase)).toEqual([
            'R', 'S', 'T', 'T', 'S', 'R',
        ]);
    });

    it('una fase fijada por el usuario nunca se cambia; el resto se acomoda', () => {
        const { data, calculations } = network([{ phase: 'S' }]);
        const tg = calculatePhaseBalance(data, [], calculations).get('tg')!;
        const m1 = tg.singlePhaseChildren.find((child) => child.nodeId === 'm1')!;
        expect(m1.fixedPhase).toBe('S');
        expect(m1.phase).toBe('S');
        expect(tg.currents).toEqual({ R: 35, S: 35, T: 35 });
        expect(proposedPhasePatches(tg).map((patch) => patch.nodeId)).not.toContain('m1');
        expect(proposedPhasePatches(tg)).toHaveLength(5);
    });

    it('todo en una fase: desbalance = max|I − Ī| / Ī', () => {
        const fixed = CURRENTS.map(() => ({ phase: 'R' as const }));
        const { data, calculations } = network(fixed);
        const tg = calculatePhaseBalance(data, [], calculations).get('tg')!;
        expect(tg.currents).toEqual({ R: 105, S: 0, T: 0 });
        // Ī = 35; |105 − 35| / 35 = 200 %
        expect(tg.unbalancePercent).toBeCloseTo(200, 9);
        expect(tg.usesProposal).toBe(false);
    });

    it('el factor de simultaneidad del tablero escala sus hijos', () => {
        const { data, calculations } = network([], { simultaneityFactor: 0.5 });
        const tg = calculatePhaseBalance(data, [], calculations).get('tg')!;
        expect(tg.currents.R + tg.currents.S + tg.currents.T).toBeCloseTo(52.5, 9);
    });

    it('las salidas de la planta van en la fase de su fila CT', () => {
        const { data } = network();
        const onlyTg = { ...data, nodes: data.nodes.slice(0, 1), edges: [] };
        const tg = calculatePhaseBalance(onlyTg, [], [], [
            { nodeId: 'tg', phaseBalance: 'R', currentA: 10 },
            { nodeId: 'tg', phaseBalance: 'RST', currentA: 5 },
        ]).get('tg')!;
        expect(tg.currents).toEqual({ R: 15, S: 5, T: 5 });
    });

    it('unbalancePercent: 10/10/40 A → 100 %', () => {
        expect(unbalancePercent({ R: 10, S: 10, T: 40 })).toBeCloseTo(100, 12);
        expect(unbalancePercent({ R: 0, S: 0, T: 0 })).toBe(0);
    });
});
