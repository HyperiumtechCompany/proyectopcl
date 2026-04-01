import type { TableRowNode, TGRow, ATSRow, TGTableRow } from '@/types/caida-tension';
import { evalFormula } from './tdTreeManager';

// Cálculos eléctricos TG/ATS 

export function calcCorriente(maxDemanda: number, sistema: string): number {
    const v = parseFloat(sistema) || 380;
    const val = v === 220 ? maxDemanda / (v * 0.9) : maxDemanda / (v * 0.9 * 1.732);
    return parseFloat(val.toFixed(2));
}

export function calcCorrienteDiseno(corrienteA: number): number {
    return parseFloat((corrienteA * 1.25).toFixed(2));
}

export function calcCaidaTension(corrienteDiseno: number, longitud: number, seccion: number, sistema: string, tgCaidaPct = 0): { caidaTension: number; caidaTensionPorcentaje: number } {
    const v = parseFloat(sistema) || 380;
    const factor = v === 220 ? 1 : 1.732;
    const sec = seccion <= 0 ? 1 : seccion;
    const caida = factor * corrienteDiseno * 0.0175 * longitud / sec;
    return {
        caidaTension: isNaN(caida) ? 0 : parseFloat(caida.toFixed(2)),
        caidaTensionPorcentaje: isNaN(caida) ? 0 : parseFloat(((caida / v * 100) + tgCaidaPct).toFixed(2)),
    };
}

// Construir lista de filas TG desde el árbol TD 

export function buildTGRowsFromTree(tree: TableRowNode[]): TGRow[] {
    const rows: TGRow[] = [buildStaticTGRow()];
    let circuitCounter = 1;

    tree.forEach((mainGroup) => {
        if (!mainGroup.children?.length) return;
        mainGroup.children.forEach((subGroup) => {
            const d = subGroup.data;
            const mainRow: TGRow = {
                id: `c${circuitCounter}-main`,
                alimentador: `C-${circuitCounter}`,
                tablero: d.tablero || `TD-${String(circuitCounter).padStart(2, '0')}`,
                sistema: subGroup.voltage || '380',
                potenciaInstalada: d.maximaDemanda || 0,
                factorSimultaniedad: d.factorDemanda || 0.8,
                maximaDemanda: 0,
                corrienteA: 0,
                corrienteDiseno: 0,
                longitudConductor: parseFloat(String(d.longitudConductor)) || 0,
                longitudFormula: d.longitudFormula || '',
                seccion: d.seccion || 0,
                caidaTension: 0,
                caidaTensionPorcentaje: 0,
                interruptor: d.interruptor || '',
                tipoConductor: d.tipoConductor || '',
                ducto: d.ducto || '',
                isMainRow: true,
                isStaticTG: false,
                rowspan: 1,
            };

            const subRows: TGRow[] = (subGroup.children || [])
                .filter((c) => ['subsubgroup', 'subgroup'].includes(c.type))
                .map((child) => {
                    const cd = child.data;
                    return {
                        id: `${mainRow.id}-sub-${child.id}`,
                        alimentador: mainRow.alimentador,
                        tablero: cd.tablero || '',
                        sistema: child.voltage || mainRow.sistema,
                        potenciaInstalada: cd.maximaDemanda || 0,
                        factorSimultaniedad: cd.factorDemanda || 0.8,
                        maximaDemanda: 0,
                        corrienteA: 0,
                        corrienteDiseno: 0,
                        longitudConductor: parseFloat(String(cd.longitudConductor)) || 0,
                        longitudFormula: cd.longitudFormula || '',
                        seccion: cd.seccion || 0,
                        caidaTension: 0,
                        caidaTensionPorcentaje: 0,
                        interruptor: cd.interruptor || '',
                        tipoConductor: cd.tipoConductor || '',
                        ducto: cd.ducto || '',
                        isMainRow: false,
                        isStaticTG: false,
                        rowspan: 0,
                    };
                });

            mainRow.rowspan = 1 + subRows.length;
            rows.push(mainRow, ...subRows);
            circuitCounter++;
        });
    });

    return rows;
}

function buildStaticTGRow(): TGRow {
    return {
        id: 'tg-static',
        alimentador: '',
        tablero: 'TG',
        sistema: '380',
        potenciaInstalada: 0,
        factorSimultaniedad: 1.0,
        maximaDemanda: 0,
        corrienteA: 0,
        corrienteDiseno: 0,
        longitudConductor: 0,
        longitudFormula: '',
        seccion: 16,
        caidaTension: 0,
        caidaTensionPorcentaje: 0,
        interruptor: '4x120',
        tipoConductor: 'N2XOH',
        ducto: '35',
        isMainRow: false,
        isStaticTG: true,
        rowspan: 1,
    };
}

// Recalcular todas las filas TG 

export function recalculateAllTGRows(flattenedData: TGRow[], atsData: ATSRow[], tgData: TGTableRow[]): { flattenedData: TGRow[]; atsData: ATSRow[]; tgData: TGTableRow[]; totals: { potenciaInstalada: number; maximaDemanda: number } } {
    // 1. Calcular tgData primero para obtener tgCaidaPct
    const newTgData = tgData.map((row) => recalcTGTableRow({ ...row }));
    const tgCaidaPct = newTgData[0]?.caidaTensionPorcentaje ?? 0;

    // 2. Calcular filas principales (flattenedData)
    const newFlattened = flattenedData.map((row) => {
        if (row.isStaticTG) return { ...row };
        return recalcMainRow({ ...row }, tgCaidaPct);
    });

    // 3. Obtener totales
    const mainRows = newFlattened.filter((r) => r.isMainRow);
    const totals = {
        potenciaInstalada: mainRows.reduce((s, r) => s + (r.potenciaInstalada || 0), 0),
        maximaDemanda: mainRows.reduce((s, r) => s + (r.maximaDemanda || 0), 0),
    };

    // 4. Actualizar fila estática TG
    const updatedFlattened = newFlattened.map((row) => {
        if (!row.isStaticTG) return row;
        const updated = {
            ...row,
            potenciaInstalada: totals.potenciaInstalada,
            maximaDemanda: totals.maximaDemanda,
            corrienteA: calcCorriente(totals.maximaDemanda, row.sistema),
        };
        return recalcMainRow(updated, tgCaidaPct);
    });

    // 5. Calcular ATS
    const newAtsData = atsData.map((row) => recalcATSRow({ ...row, maximademandaats: totals.maximaDemanda }));

    // 6. Actualizar tgData con totales
    const finalTgData = newTgData.map((row) => ({
        ...row,
        maximademandaTG: totals.maximaDemanda,
        corrienteA: calcCorriente(totals.maximaDemanda, row.sistema),
        corrienteDiseno: calcCorrienteDiseno(calcCorriente(totals.maximaDemanda, row.sistema)),
    }));

    return { flattenedData: updatedFlattened, atsData: newAtsData, tgData: finalTgData, totals };
}

function recalcMainRow(row: TGRow, tgCaidaPct: number): TGRow {
    const longitud = evalFormula(row.longitudFormula || String(row.longitudConductor));
    const md = row.potenciaInstalada * (row.factorSimultaniedad || 1);
    const ia = calcCorriente(row.potenciaInstalada, row.sistema);
    const id_ = calcCorrienteDiseno(ia);
    const { caidaTension, caidaTensionPorcentaje } = calcCaidaTension(id_, longitud, row.seccion, row.sistema, tgCaidaPct);
    return { ...row, longitudConductor: longitud, maximaDemanda: md, corrienteA: ia, corrienteDiseno: id_, caidaTension, caidaTensionPorcentaje };
}

function recalcATSRow(row: ATSRow): ATSRow {
    const longitud = evalFormula(row.longitudFormula || String(row.longitudConductor));
    const ia = calcCorriente(row.maximademandaats, row.sistema);
    const id_ = calcCorrienteDiseno(ia);
    const { caidaTension, caidaTensionPorcentaje } = calcCaidaTension(id_, longitud, row.seccion, row.sistema, 0);
    return { ...row, longitudConductor: longitud, corrienteA: ia, corrienteDiseno: id_, caidaTension, caidaTensionPorcentaje };
}

function recalcTGTableRow(row: TGTableRow): TGTableRow {
    const longitud = evalFormula(row.longitudFormula || String(row.longitudConductor));
    const ia = calcCorriente(row.maximademandaTG, row.sistema);
    const id_ = calcCorrienteDiseno(ia);
    const { caidaTension, caidaTensionPorcentaje } = calcCaidaTension(id_, longitud, row.seccion, row.sistema, 0);
    return { ...row, longitudConductor: longitud, corrienteA: ia, corrienteDiseno: id_, caidaTension, caidaTensionPorcentaje };
}

// Datos iniciales ATS y TG 

export function buildInitialATSData(totalMaxDemanda = 0): ATSRow[] {
    return [{
        id: 'ats-main',
        alimentador: '',
        tablero: 'ATS',
        sistema: '380',
        maximademandaats: totalMaxDemanda,
        corrienteA: 0,
        corrienteDiseno: 0,
        longitudConductor: 9.7,
        longitudFormula: '9.70',
        seccion: 16,
        caidaTension: 0,
        caidaTensionPorcentaje: 0,
        interruptor: '4x120',
        tipoConductor: 'N2XOH',
        ducto: '35',
    }];
}

export function buildInitialTGData(totalMaxDemanda = 0): TGTableRow[] {
    return [{
        id: 'tg-main',
        alimentador: '',
        tablero: 'TG',
        sistema: '380',
        maximademandaTG: totalMaxDemanda,
        corrienteA: 0,
        corrienteDiseno: 0,
        longitudConductor: 6.32,
        longitudFormula: '6.32',
        seccion: 16,
        caidaTension: 0,
        caidaTensionPorcentaje: 0,
        interruptor: '4x120',
        tipoConductor: 'N2XOH',
        ducto: '35',
    }];
}
