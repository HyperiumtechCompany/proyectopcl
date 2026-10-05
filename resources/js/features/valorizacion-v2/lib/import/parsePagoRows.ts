import type { AjustesPago } from '../../types';
import { cellDate, key, numberString, text } from './cells';
import type { Cell } from './cells';

/** Solo entradas de A-K: nunca copia subtotales, retenciones ni el líquido calculado. */
export function parsePagoRows(rows: Cell[][]): Partial<AjustesPago> {
    const ajustes: Partial<AjustesPago> = {};
    let grupo = '';
    for (const row of rows) {
        const marker = text(row[0]);
        if (/^[A-K]$/.test(marker)) grupo = marker;
        const label = key(row[1]);
        let field: keyof AjustesPago | undefined;
        if (label === 'REAJUSTE DEL MES') field = 'reajusteMes';
        else if (label === 'REINTEGRO DEL MES ANTERIOR')
            field = 'reintegroMesAnterior';
        else if (label === 'POR ADELANTO DIRECTO' && grupo === 'D')
            field = 'deduccionReajusteDirecto';
        else if (label === 'POR ADELANTO DE MATERIALES' && grupo === 'D')
            field = 'deduccionReajusteMateriales';
        else if (label === 'POR ADELANTO DIRECTO' && grupo === 'E')
            field = 'amortizacionDirecto';
        else if (label === 'POR ADELANTO DE MATERIALES' && grupo === 'E')
            field = 'amortizacionMateriales';
        else if (label === 'POR ATRASO DE OBRA' && grupo === 'H')
            field = 'penalidadAtraso';
        else if (label === 'OTROS' && grupo === 'H') field = 'penalidadOtros';
        if (field) {
            const amount = numberString(row[3]);
            if (amount !== null) ajustes[field] = amount;
        }
    }

    return ajustes;
}

/** Comprobantes y ajustes por mes del contrato principal; no copia importes calculados. */
export function parseControlPagosRows(
    rows: Cell[][],
): Record<string, Partial<AjustesPago>> {
    const header = rows.findIndex(
        (row) => key(row[0]) === 'NRO' && key(row[1]) === 'MES',
    );
    const result: Record<string, Partial<AjustesPago>> = {};
    if (header < 0) return result;
    for (const row of rows.slice(header + 1)) {
        if (key(row[0]) === 'TOTAL') break;
        const date = cellDate(row[1]);
        if (!date || !/^\d+$/.test(text(row[0]))) continue;
        const ajustes: Partial<AjustesPago> = {};
        for (const [col, field] of [
            [3, 'reajusteMes'],
            [5, 'amortizacionDirecto'],
            [6, 'amortizacionMateriales'],
        ] as const) {
            const amount = numberString(row[col]);
            if (amount !== null) ajustes[field] = amount;
        }
        const penalidades = numberString(row[9]);
        if (penalidades !== null) {
            ajustes.penalidadAtraso = '0';
            ajustes.penalidadOtros = penalidades;
        }
        if (text(row[14])) ajustes.facturaNro = text(row[14]);
        if (text(row[15])) ajustes.comprobanteNro = text(row[15]);
        const pago = cellDate(row[16]);
        if (pago) ajustes.fechaPago = pago;
        result[date.slice(0, 7)] = ajustes;
    }

    return result;
}
