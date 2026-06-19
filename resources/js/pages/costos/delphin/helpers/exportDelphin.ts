import type { DelphinRow } from '../types';
import { exportDelphinExcel } from './exportDelphinExcel';
import { exportDelphinPdf } from './exportDelphinPdf';
import { exportDelphinMSP } from './exportDelphinMSP';

// ── Tipos públicos ────────────────────────────────────────────────────────────
export type DelphinExportContent = 'budget_only' | 'budget_gantt' | 'gantt_only';
export type DelphinExportFormat = 'excel' | 'pdf' | 'msp';

// backward-compat alias (modal anterior usaba DelphinExportType)
export type DelphinExportType = DelphinExportContent;

// ── Entry point ───────────────────────────────────────────────────────────────
export async function exportDelphin(
    content: DelphinExportContent,
    format: DelphinExportFormat,
    rows: DelphinRow[],
    projectName: string,
    projectData?: any,
    selectedSpecialties?: string[]
): Promise<void> {
    console.log('📦 projectData en exportDelphin:', projectData);
    console.log('📦 selectedSpecialties en exportDelphin:', selectedSpecialties);

    switch (format) {
        case 'excel':
            return exportDelphinExcel(content, rows, projectName, projectData, selectedSpecialties);
        case 'pdf':
            return exportDelphinPdf(content, rows, projectName, projectData, selectedSpecialties);
        case 'msp':
            return exportDelphinMSP(rows, projectName);
    }
}
