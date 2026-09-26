import { describe, expect, it } from 'vitest';
import type { PanelCircuitSummary } from '@/pages/dialux/hooks/wireLengthCalculations';
import {
    ctTreeOrder,
    rowsForDistributionPanel,
    type ModuleCtCircuit,
} from './ctTableRows';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
} from './types';

function circuit(
    values: Partial<PanelCircuitSummary> &
        Pick<
            PanelCircuitSummary,
            'panelId' | 'panelType' | 'isPanelSummary'
        > & {
            moduleId: number;
        },
): ModuleCtCircuit {
    return {
        moduleName: `Módulo ${values.moduleId}`,
        ...values,
    } as ModuleCtCircuit;
}

describe('filas CT multimódulo', () => {
    it('agrupa las salidas con su TD y deja fuera los TG locales repetidos', () => {
        const rows = [
            circuit({
                moduleId: 1,
                panelId: 'td-1',
                panelType: 'sub_panel',
                isPanelSummary: false,
                code: 'C-1',
            }),
            circuit({
                moduleId: 1,
                panelId: 'td-1',
                panelType: 'sub_panel',
                isPanelSummary: false,
                code: 'C-2',
            }),
            circuit({
                moduleId: 1,
                panelId: 'td-1',
                panelType: 'sub_panel',
                isPanelSummary: true,
                code: 'TD-1',
            }),
            circuit({
                moduleId: 1,
                panelId: 'tg-local',
                panelType: 'main_panel',
                isPanelSummary: true,
                code: 'TG',
            }),
            circuit({
                moduleId: 2,
                panelId: 'td-2',
                panelType: 'sub_panel',
                isPanelSummary: false,
                code: 'C-1',
            }),
        ];

        const td1 = rowsForDistributionPanel(rows, 1, 'td-1');

        expect(td1.outputRows.map((row) => row.code)).toEqual(['C-1', 'C-2']);
        expect(td1.summaryRows.map((row) => row.code)).toEqual(['TD-1']);
        expect([...td1.outputRows, ...td1.summaryRows]).not.toContainEqual(
            expect.objectContaining({ panelType: 'main_panel' }),
        );
        expect(
            rowsForDistributionPanel(rows, 2, 'td-2').outputRows,
        ).toHaveLength(1);
    });
});

describe('orden de la tabla CT como árbol (TG → TD → Sub‑TD)', () => {
    const node = (
        id: string,
        type: ElectricalNode['type'],
        label = id,
    ): ElectricalNode => ({
        id,
        type,
        label,
        position: { x: 0, y: 0 },
    });
    const edge = (sourceNodeId: string, targetNodeId: string): ElectricalEdge =>
        ({
            id: `${sourceNodeId}>${targetNodeId}`,
            sourceNodeId,
            targetNodeId,
        }) as ElectricalEdge;

    it('recorre en profundidad: cada TD seguido de sus Sub‑TD, atravesando el ATS', () => {
        const data = {
            nodes: [
                node('svc', 'service'),
                node('tg', 'main_panel', 'TG'),
                node('ats', 'ats'),
                node('td10', 'module_panel_port', 'TD-10'),
                node('td2', 'module_panel_port', 'TD-2'),
                node('std', 'module_panel_port', 'Sub-TD-2.1'),
                node('stp', 'site_panel', 'ST planta'),
                node('suelto', 'module_panel_port', 'TD-X'),
            ],
            edges: [
                edge('svc', 'tg'),
                edge('tg', 'td10'),
                edge('tg', 'ats'),
                edge('ats', 'td2'),
                edge('td2', 'std'),
                edge('tg', 'stp'),
            ],
        } as unknown as ElectricalNetworkData;
        const { blocks, unreachable } = ctTreeOrder(data);
        expect(
            blocks.map((block) => [
                block.nodeId,
                block.depth,
                block.parentPanelId,
            ]),
        ).toEqual([
            ['tg', 0, null],
            ['td2', 1, 'tg'],
            ['std', 2, 'td2'],
            ['stp', 1, 'tg'],
            ['td10', 1, 'tg'],
        ]);
        expect(blocks[0].edgeId).toBe('svc>tg');
        expect(unreachable).toEqual(['suelto']);
    });
});
