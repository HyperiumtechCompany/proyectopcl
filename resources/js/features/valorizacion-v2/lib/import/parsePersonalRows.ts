import type { PersonalInput } from '../../types';
import { key, numberString, text } from './cells';
import type { Cell } from './cells';

/** Personal y faltas explícitas de RH-EM; los totales de asistencia siguen calculándose. */
export function parsePersonalRows(
    rows: Cell[][],
    actual: PersonalInput,
    mes: string,
    residente: string,
): { personal: PersonalInput; warnings: string[] } | null {
    const header = rows.findIndex(
        (row) =>
            row.some((cell) => key(cell) === 'DNI') &&
            row.some((cell) => key(cell) === 'CIP'),
    );
    if (header < 0) return null;
    const nombres = rows[header].map(key);
    const dni = nombres.indexOf('DNI');
    const cip = nombres.indexOf('CIP');
    const nombre = nombres.findIndex((label) =>
        label.startsWith('PROFESIONAL'),
    );
    const cargo = nombres.indexOf('CARGO');
    if (nombre < 0 || cargo < 0) return null;
    const personal: PersonalInput = { personas: [], faltas: {} };
    const warnings: string[] = [];
    for (const row of rows.slice(header + 2)) {
        if (!/^\d+$/.test(text(row[0])) || !text(row[nombre])) continue;
        const vinculo =
            key(row[nombre]) === key(residente) &&
            key(row[cargo]).includes('RESIDENTE');
        const anterior = actual.personas.find(
            (persona) =>
                key(persona.cargo) === key(row[cargo]) &&
                (key(persona.nombre) === key(row[nombre]) ||
                    (vinculo && persona.vinculoFT === 'residente')),
        );
        const id = anterior?.id ?? `rh-excel-${text(row[0])}`;
        const cantidad = rows.find(
            (candidate, index) =>
                index < header && key(candidate[1]) === key(row[nombre]),
        );
        personal.personas.push({
            id,
            nombre: vinculo ? '' : text(row[nombre]),
            cargo: text(row[cargo]),
            cantidad: Number(numberString(cantidad?.[3]) ?? '1'),
            dni: text(row[dni]) ? text(row[dni]).padStart(8, '0') : '',
            cip: text(row[cip]),
            ...(vinculo ? { vinculoFT: 'residente' as const } : {}),
        });
        const faltas = (actual.faltas[id] ?? []).filter(
            (fecha) => !fecha.startsWith(mes),
        );
        (rows[header + 1] ?? []).forEach((day, col) => {
            const num = typeof day === 'number' ? day : 0;
            if (num < 1 || num > 31) return;
            const mark = key(row[col]);
            if (['F', 'FALTA', 'NO', '0'].includes(mark))
                faltas.push(`${mes}-${String(num).padStart(2, '0')}`);
            else if (mark && !['1', 'X', 'A', 'ASISTIO', 'SI'].includes(mark))
                warnings.push(
                    `RH-EM: marca de asistencia "${text(row[col])}" no reconocida para ${text(row[nombre])}, día ${num}.`,
                );
        });
        if (faltas.length) personal.faltas[id] = faltas;
    }

    return personal.personas.length ? { personal, warnings } : null;
}
