import type { PeriodoValorizacion } from '../../types/valorizacion';
import { key } from './cells';
import type { Cell } from './cells';

const MESES = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
];

/** Lee el corte declarado en el título, sin tomar el último mes futuro del calendario. */
export function parsePeriodoRows(rows: Cell[][]): PeriodoValorizacion | null {
    for (const row of rows.slice(0, 8)) {
        for (const cell of row) {
            const match =
                /VALORIZACION\s+N[°ºO.\s]*(\d+).*?MES DE\s+(\w+)\s+(?:DE|DEL)\s+(\d{4})/.exec(
                    key(cell),
                );
            if (match) {
                const month = MESES.indexOf(match[2]);
                if (month >= 0 && Number(match[1]) > 0) {
                    return {
                        numero: Number(match[1]),
                        mes: `${match[3]}-${String(month + 1).padStart(2, '0')}-01`,
                    };
                }
            }
        }
    }

    return null;
}
