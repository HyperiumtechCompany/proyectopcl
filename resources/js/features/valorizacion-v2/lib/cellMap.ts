/** Valores por partida y mes: { [partidaId]: { [mes]: valor } }. */
export type CellMap = Record<string, Record<string, string>>;

/**
 * Fija (o borra con null) un valor sin mutar el original. Devuelve el mismo
 * objeto si no cambia nada, para no ensuciar el historial.
 */
export function setCell(map: CellMap, id: string, mes: string, value: string | null): CellMap {
    const fila = map[id] ?? {};
    if ((fila[mes] ?? null) === value) {
        return map;
    }
    const next = { ...fila };
    if (value === null) {
        delete next[mes];
    } else {
        next[mes] = value;
    }

    return { ...map, [id]: next };
}
