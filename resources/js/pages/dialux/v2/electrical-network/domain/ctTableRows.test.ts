import { describe, expect, it } from 'vitest';
import type { PanelCircuitSummary } from '@/pages/dialux/hooks/wireLengthCalculations';
import { rowsForDistributionPanel, type ModuleCtCircuit } from './ctTableRows';

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
