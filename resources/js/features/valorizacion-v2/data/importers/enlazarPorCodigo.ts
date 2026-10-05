import type { CellMap } from '../../lib/cellMap';
import type { PartidaInput } from '../../types';

/**
 * Convierte valores por CÓDIGO (como vienen del Excel) en valores por `id`
 * estable de partida, contra el presupuesto cargado. Reporta códigos que no
 * existen y valores puestos en títulos (no se importan).
 */
export function enlazarPorCodigo(porCodigo: CellMap, partidas: PartidaInput[]): { valores: CellMap; enlazadas: number; warnings: string[] } {
    const partidaPorCodigo = new Map(partidas.map((partida) => [partida.codigo, partida]));
    const titulos = new Set(partidas.map((partida) => partida.parentId).filter(Boolean));
    const valores: CellMap = {};
    const sinPartida: string[] = [];
    const enTitulo: string[] = [];

    for (const [codigo, porMes] of Object.entries(porCodigo)) {
        const partida = partidaPorCodigo.get(codigo);
        if (!partida) {
            sinPartida.push(codigo);
        } else if (titulos.has(partida.id)) {
            enTitulo.push(codigo);
        } else {
            valores[partida.id] = porMes;
        }
    }

    const warnings: string[] = [];
    if (sinPartida.length > 0) {
        warnings.push(`${sinPartida.length} códigos con valores no existen en el presupuesto: ${sinPartida.slice(0, 6).join(', ')}${sinPartida.length > 6 ? '…' : ''}.`);
    }
    if (enTitulo.length > 0) {
        warnings.push(`${enTitulo.length} valores están en títulos y se omitieron: ${enTitulo.slice(0, 6).join(', ')}.`);
    }

    return { valores, enlazadas: Object.keys(valores).length, warnings };
}
