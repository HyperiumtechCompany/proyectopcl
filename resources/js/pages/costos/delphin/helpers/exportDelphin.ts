import type { DelphinRow } from '../types';
import { exportDelphinExcel } from './exportDelphinExcel';
import { exportDelphinPdf } from './exportDelphinPdf';
import { exportDelphinMSP } from './exportDelphinMSP';

// ── Tipos públicos ────────────────────────────────────────────────────────────
export type DelphinExportContent = 'budget_only' | 'budget_gantt' | 'gantt_only' | 'formula_polinomica';
export type DelphinExportFormat = 'excel' | 'pdf' | 'msp';

// backward-compat alias (modal anterior usaba DelphinExportType)
export type DelphinExportType = DelphinExportContent;

interface MonomioExport {
    nomenclatura: string;
    indices: {
        code: string;
        descripcion: string;
        coefCalculado: number;
        coefDefinido: number;
    }[];
}

// ── Fórmula Polinómica ──────────────────────────────────────────────────────
async function exportFormulaPolinomicaExcel(
    projectData: any,
    formulaMonomios: any,  
    rows: DelphinRow[],
    projectName: string,
) {

    const { exportDelphinExcel } = await import('./exportDelphinExcel');

  
    await exportDelphinExcel(
        'formula_polinomica',
        rows,
        projectName,
        projectData,
        [], 
        formulaMonomios  
    );
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function exportDelphin(
    content: DelphinExportContent,
    format: DelphinExportFormat,
    rows: DelphinRow[],
    projectName: string,
    projectData?: any,
    selectedSpecialties: string[] = [],
    formulaMonomios: MonomioExport[] = [],
) {
    if (content === 'formula_polinomica') {
        if (format === 'excel') {
            return exportFormulaPolinomicaExcel(projectData, formulaMonomios, rows, projectName);
        }
        if (format === 'pdf') {
            const { exportDelphinPdf } = await import('./exportDelphinPdf');
            const formulaData = { monomios: formulaMonomios || [] };
            return exportDelphinPdf(
                'formula_polinomica',
                rows,
                projectName,
                projectData,
                [],
                formulaData
            );
        }
        throw new Error('Exportación de fórmula polinómica solo disponible en Excel y PDF');
    }

    switch (format) {
        case 'excel':
            return exportDelphinExcel(content, rows, projectName, projectData, selectedSpecialties);
        case 'pdf':
            return exportDelphinPdf(content, rows, projectName, projectData, selectedSpecialties);
        case 'msp':
            return exportDelphinMSP(rows, projectName);
        default:
            throw new Error(`Formato no soportado: ${format}`);
    }
}
