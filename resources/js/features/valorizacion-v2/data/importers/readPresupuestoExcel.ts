import { parsePresupuestoRows } from '../../lib/import/parsePresupuestoRows';
import type { ParsedPresupuesto } from '../../lib/import/parsePresupuestoRows';

export interface PresupuestoExcelResult extends ParsedPresupuesto {
    sheetName: string;
}

/**
 * Lee un .xlsx/.xls y devuelve el presupuesto de la hoja PRESUPUESTO (o de la
 * primera hoja que tenga la cabecera ITEM/DESCRIPCIÓN). SheetJS se carga bajo
 * demanda para no engordar el bundle de la página.
 */
export async function readPresupuestoExcel(data: ArrayBuffer): Promise<PresupuestoExcelResult> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(data, { type: 'array' });

    const ordered = [
        ...workbook.SheetNames.filter((name) => name.trim().toUpperCase() === 'PRESUPUESTO'),
        ...workbook.SheetNames.filter((name) => name.trim().toUpperCase() !== 'PRESUPUESTO'),
    ];

    let firstAttempt: PresupuestoExcelResult | null = null;
    for (const sheetName of ordered) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null });
        const parsed = { ...parsePresupuestoRows(rows), sheetName };
        if (parsed.partidas.length > 0) {
            return parsed;
        }
        firstAttempt ??= parsed;
    }

    return firstAttempt ?? { partidas: [], parametros: { gastosGenerales: null, utilidad: null, igv: null }, excel: { costoDirecto: null, total: null }, warnings: ['El archivo no tiene hojas.'], sheetName: '' };
}
