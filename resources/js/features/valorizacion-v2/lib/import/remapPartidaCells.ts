import type { PartidaInput } from '../../types';
import type { CellMap } from '../cellMap';

/** Conserva las conexiones por código cuando una importación reemplaza los IDs del árbol. */
export function remapPartidaCells(
    cells: CellMap,
    anteriores: PartidaInput[],
    siguientes: PartidaInput[],
): CellMap {
    const oldById = new Map(
        anteriores.map((partida) => [partida.id, partida.codigo]),
    );
    const titulos = new Set(siguientes.map((partida) => partida.parentId));
    const nextByCode = new Map(
        siguientes
            .filter((partida) => !titulos.has(partida.id))
            .map((partida) => [partida.codigo, partida.id]),
    );
    const result: CellMap = {};
    for (const [id, porMes] of Object.entries(cells)) {
        const nextId = nextByCode.get(oldById.get(id) ?? '');
        if (nextId) {
            result[nextId] = porMes;
        }
    }

    return result;
}
