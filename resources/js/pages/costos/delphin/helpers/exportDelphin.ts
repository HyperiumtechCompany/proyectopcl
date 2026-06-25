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

// ── Construir formulaData desde monomios ──────────────────────────────────────
function buildFormulaData(monomios: any[]): any {
    console.log('📊 buildFormulaData - monomios recibidos:', monomios);

    if (!monomios || monomios.length === 0) {
        return {
            formula: 'K = No hay monomios configurados',
            monomios: [],
            totalK: 0,
            hasData: false,
        };
    }

    // Calcular coeficiente total de cada monomio
    const monomiosConCoef = monomios.map((m: any) => {
        const coef = m.indices.reduce((s: number, i: any) => s + (i.coefDefinido || 0), 0);
        return {
            ...m,
            coeficienteTotal: coef,
        };
    });

    // Construir la fórmula K
    const parts = monomiosConCoef
        .filter((m: any) => m.coeficienteTotal > 0)
        .map((m: any) => {
            const coef = m.coeficienteTotal;
            return `${coef.toFixed(3)} ${m.nomenclatura}r`;
        });

    const formulaStr = parts.length > 0 ? `K = ${parts.join(' + ')}` : 'K = (sin datos)';

    // Datos para la tabla
    const tableData = monomiosConCoef.map((m: any, index: number) => ({
        nro: index + 1,
        esPadre: true,
        descripcion: m.indices[0]?.descripcion || 'Monomio',
        monomio: m.nomenclatura || '',
        coeficiente: m.coeficienteTotal,
        incidencia: m.coeficienteTotal * 100,
        indices: m.indices.map((i: any) => ({
            code: i.code || '',
            descripcion: i.descripcion || '',
            coefDefinido: i.coefDefinido || 0,
        })),
    }));

    const totalK = monomiosConCoef.reduce((s: number, m: any) => s + m.coeficienteTotal, 0);

    const result = {
        formula: formulaStr,
        monomios: tableData,
        totalK: totalK,
        hasData: true,
    };

    console.log('📊 buildFormulaData - resultado:', result);
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// exportDelphin - FUNCIÓN PRINCIPAL (AGREGAR ESTO)
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportDelphin(
    content: DelphinExportContent,
    format: DelphinExportFormat,
    rows: DelphinRow[],
    projectName: string,
    projectData?: any,
    selectedSpecialties: string[] = [],
    formulaMonomios: MonomioExport[] = [],
) {
    
    // ── FÓRMULA POLINÓMICA ──────────────────────────────────────────────────
    if (content === 'formula_polinomica') {
        const formulaData = buildFormulaData(formulaMonomios);
        console.log('📊 exportDelphin - formulaData construido');

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
            return exportDelphinMSP(rows, projectName);
        default:
            throw new Error(`Formato no soportado: ${format}`);
    }
}