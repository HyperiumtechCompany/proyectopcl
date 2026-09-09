import type { DelphinRow, ResumenPresupuesto } from '../types';
import { exportDelphinExcel } from './exportDelphinExcel';
import { exportDelphinPdf } from './exportDelphinPdf';
import { exportDelphinMSP } from './exportDelphinMSP';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import type { GanttCalendarSettings } from '../../cronogramas/v2/types/calendar';
import {
    flattenMonomiosForExport,
    flattenNodes,
    sumNode,
    type FormulaMonomio,
} from './formulaPolinomicaTree';

// ── Tipos públicos ────────────────────────────────────────────────────────────
export type DelphinExportContent = 'budget_only' | 'budget_gantt' | 'gantt_only' | 'formula_polinomica' | 'formula_polinomica_agrupamiento';
export type DelphinExportFormat = 'excel' | 'pdf' | 'msp';

// backward-compat alias (modal anterior usaba DelphinExportType)
export type DelphinExportType = DelphinExportContent;

type MonomioExport = FormulaMonomio;

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
        terms: monomiosConCoef.map((monomio) => ({
            nomenclatura: monomio.nomenclatura,
            coeficiente: monomio.coeficienteTotal,
        })),
        monomios: tableData,
        totalK: totalK,
        hasData: true,
    };

    
    return result;
}

// ── Tipos de agrupamiento ─────────────────────────────────────────────────────
export interface AgrupamientoRow {
    codigo: string;
    descripcion: string;
    nomenclatura: string;
    coeficiente: number;
    porcentaje: number;
    agrupamiento: string;
}

export interface AgrupamientoData {
    rows: AgrupamientoRow[];
    totalCoeficiente: number;
    hasData: boolean;
}

// ── Construir agrupamientoData desde monomios ─────────────────────────────────
function buildAgrupamientoData(monomios: FormulaMonomio[]): AgrupamientoData {
    if (!monomios || monomios.length === 0) {
        return { rows: [], totalCoeficiente: 0, hasData: false };
    }

    const totalK = monomios.reduce((s, m) => s + sumNode(m.root), 0);
    const rowMap = new Map<string, AgrupamientoRow>();

    monomios.forEach((monomio) => {
        const allNodes = flattenNodes(monomio.root);
        const leafNodes = allNodes.filter((n) => n.children.length === 0);
        const siblingCodes = leafNodes.map((n) => n.code);

        leafNodes.forEach((leaf) => {
            const existing = rowMap.get(leaf.code);
            const coef = leaf.coefDefinido;

            if (existing) {
                existing.coeficiente += coef;
                existing.porcentaje += totalK > 0 ? (coef / totalK) * 100 : 0;
                if (monomio.nomenclatura && !existing.nomenclatura.includes(monomio.nomenclatura)) {
                    existing.nomenclatura += `+${monomio.nomenclatura}`;
                }
            } else {
                // Agrupamiento: códigos de los demás índices en el mismo monomio
                const agrupamiento = leafNodes.length > 1
                    ? siblingCodes.filter((c) => c !== leaf.code).join('+')
                    : '';

                rowMap.set(leaf.code, {
                    codigo: leaf.code,
                    descripcion: leaf.descripcion,
                    nomenclatura: monomio.nomenclatura,
                    coeficiente: coef,
                    porcentaje: totalK > 0 ? (coef / totalK) * 100 : 0,
                    agrupamiento,
                });
            }
        });
    });

    // Ordenar por código INEI numérico
    const rows = Array.from(rowMap.values()).sort((a, b) => {
        const na = parseInt(a.codigo, 10);
        const nb = parseInt(b.codigo, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.codigo.localeCompare(b.codigo);
    });

    return { rows, totalCoeficiente: totalK, hasData: rows.length > 0 };
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
    resumenPresupuesto?: ResumenPresupuesto,
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

    // ── FÓRMULA POLINÓMICA AGRUPAMIENTO ────────────────────────────────────
    if (content === 'formula_polinomica_agrupamiento') {
        const agrupamientoData = buildAgrupamientoData(formulaMonomios);

        if (format === 'excel') {
            return exportDelphinExcel(content, rows, projectName, projectData, selectedSpecialties, agrupamientoData);
        } else if (format === 'pdf') {
            return exportDelphinPdf(content, rows, projectName, projectData, selectedSpecialties, agrupamientoData);
        } else {
            throw new Error(`Formato ${format} no soportado para Agrupamiento`);
        }
    }

    // ── OTROS CONTENIDOS ─────────────────────────────────────────────────────
    switch (format) {
        case 'excel':
            return exportDelphinExcel(content, rows, projectName, projectData, selectedSpecialties, undefined, resumenPresupuesto);
        case 'pdf':
            return exportDelphinPdf(content, rows, projectName, projectData, selectedSpecialties, undefined, resumenPresupuesto);
        case 'msp':
            return exportDelphinMSP(ganttTasks, projectName, calendarSettings);
        default:
            throw new Error(`Formato no soportado: ${format}`);
    }
}
