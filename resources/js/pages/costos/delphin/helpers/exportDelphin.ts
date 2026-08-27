import type { DelphinRow } from '../types';
import { exportDelphinExcel } from './exportDelphinExcel';
import { exportDelphinPdf } from './exportDelphinPdf';
import { exportDelphinMSP } from './exportDelphinMSP';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import type { GanttCalendarSettings } from '../../cronogramas/v2/types/calendar';
import {
    flattenMonomiosForExport,
    sumNode,
    type FormulaMonomio,
} from './formulaPolinomicaTree';

// ── Tipos públicos ────────────────────────────────────────────────────────────
export type DelphinExportContent = 'budget_only' | 'budget_gantt' | 'gantt_only' | 'formula_polinomica';
export type DelphinExportFormat = 'excel' | 'pdf' | 'msp';

// backward-compat alias (modal anterior usaba DelphinExportType)
export type DelphinExportType = DelphinExportContent;

type MonomioExport = FormulaMonomio;

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

// ── Construir formulaData desde monomios ──────────────────────────────────────
function buildFormulaData(monomios: any[]): any {
    

    if (!monomios || monomios.length === 0) {
        return {
            formula: 'K = No hay monomios configurados',
            monomios: [],
            totalK: 0,
            hasData: false,
        };
    }

    const typedMonomios = monomios as FormulaMonomio[];
    const monomiosConCoef = typedMonomios.map((monomio) => ({
        ...monomio,
        coeficienteTotal: sumNode(monomio.root),
    }));

    // Construir la fórmula K
    const parts = monomiosConCoef
        .filter((m: any) => m.coeficienteTotal > 0)
        .map((m: any) => {
            const coef = m.coeficienteTotal;
            return `${coef.toFixed(3)} (${m.nomenclatura}r/${m.nomenclatura}o)`;
        });

    const formulaStr = parts.length > 0 ? `K = ${parts.join(' + ')}` : 'K = (sin datos)';

    // Recorrido preorden completo: refleja el árbol visible sin comprimirlo.
    const tableData = flattenMonomiosForExport(typedMonomios);

    const totalK = monomiosConCoef.reduce((s: number, m: any) => s + m.coeficienteTotal, 0);

    const result = {
        formula: formulaStr,
        monomios: tableData,
        totalK: totalK,
        hasData: true,
    };

    
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// exportDelphin - FUNCIÓN PRINCIPAL 
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportDelphin(
    content: DelphinExportContent,
    format: DelphinExportFormat,
    rows: DelphinRow[],
    projectName: string,
    projectData?: any,
    selectedSpecialties: string[] = [],
    formulaMonomios: MonomioExport[] = [],
    ganttTasks: GanttTask[] = [],
    calendarSettings?: GanttCalendarSettings,
) {
    
    // ── FÓRMULA POLINÓMICA ──────────────────────────────────────────────────
    if (content === 'formula_polinomica') {
        const formulaData = buildFormulaData(formulaMonomios);
        

        if (format === 'excel') {
            return exportDelphinExcel(
                content,
                rows,
                projectName,
                projectData,
                selectedSpecialties,
                formulaData
            );
        } else if (format === 'pdf') {
            return exportDelphinPdf(
                content,
                rows,
                projectName,
                projectData,
                selectedSpecialties,
                formulaData
            );
        } else {
            throw new Error(`Formato ${format} no soportado para Fórmula Polinómica`);
        }
    }

    // ── OTROS CONTENIDOS ─────────────────────────────────────────────────────
    switch (format) {
        case 'excel':
            return exportDelphinExcel(content, rows, projectName, projectData, selectedSpecialties);
        case 'pdf':
            return exportDelphinPdf(content, rows, projectName, projectData, selectedSpecialties);
        case 'msp':
            return exportDelphinMSP(ganttTasks, projectName, calendarSettings);
        default:
            throw new Error(`Formato no soportado: ${format}`);
    }
}
