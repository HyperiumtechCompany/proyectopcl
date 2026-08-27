import type { DelphinRow } from '../types';

export interface OrderedAcuExport {
    acu: any;
    item: number;
    partidaDisplay: string;
}

export function normalizePartidaForExport(value: string): string {
    return value
        .split('.')
        .filter(Boolean)
        .map((part) => part.padStart(2, '0'))
        .join('.');
}

/** Usa el recorrido visible del presupuesto como fuente de verdad del orden. */
export function orderAcusForExport(acusData: any[], filteredRows: DelphinRow[]): OrderedAcuExport[] {
    const acusByPartida = new Map<string, any[]>();
    for (const acu of acusData) {
        const key = normalizePartidaForExport(String(acu.partida ?? ''));
        if (!key) continue;
        const matches = acusByPartida.get(key) ?? [];
        matches.push(acu);
        acusByPartida.set(key, matches);
    }

    const ordered: OrderedAcuExport[] = [];
    for (const row of filteredRows) {
        const key = normalizePartidaForExport(String(row.partida ?? ''));
        const matches = acusByPartida.get(key);
        if (!matches) continue;
        for (const acu of matches) {
            ordered.push({ acu, item: ordered.length + 1, partidaDisplay: String(row.partida ?? acu.partida ?? '') });
        }
        acusByPartida.delete(key);
    }

    // Si no existe un presupuesto visible (compatibilidad con exportaciones
    // antiguas), no se pierden ACUs: se usa un orden natural por partida.
    if (filteredRows.length === 0) {
        const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
        return [...acusData]
            .sort((left, right) => collator.compare(String(left.partida ?? ''), String(right.partida ?? '')))
            .map((acu, index) => ({ acu, item: index + 1, partidaDisplay: String(acu.partida ?? '') }));
    }

    return ordered;
}
