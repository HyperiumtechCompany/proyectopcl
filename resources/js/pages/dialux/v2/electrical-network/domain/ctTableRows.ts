import type { PanelCircuitSummary } from '@/pages/dialux/hooks/wireLengthCalculations';

export type ModuleCtCircuit = PanelCircuitSummary & {
    moduleId: number;
    moduleName: string;
};

export function rowsForDistributionPanel(
    circuits: ModuleCtCircuit[],
    moduleId: number,
    panelId: string | undefined,
): {
    outputRows: ModuleCtCircuit[];
    summaryRows: ModuleCtCircuit[];
} {
    const panelRows = circuits.filter(
        (circuit) =>
            circuit.moduleId === moduleId &&
            circuit.panelId === panelId &&
            circuit.panelType !== 'main_panel',
    );

    return {
        outputRows: panelRows.filter((circuit) => !circuit.isPanelSummary),
        summaryRows: panelRows.filter((circuit) => circuit.isPanelSummary),
    };
}
