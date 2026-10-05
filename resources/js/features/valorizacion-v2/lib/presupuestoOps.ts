import type { PartidaInput, PartidaRow } from '../types/partida';
import { padreDe } from './partidaTree';

/**
 * Operaciones inmutables sobre el árbol de partidas. Todas devuelven la lista
 * plana NORMALIZADA: preorden, `parentId` coherente, códigos renumerados por
 * posición y títulos sin unidad/metrado/P.U. La identidad (`id`) nunca cambia.
 */

interface Branch {
    item: PartidaInput;
    children: Branch[];
}

interface Located {
    branch: Branch;
    siblings: Branch[];
    index: number;
    parent: Branch | null;
}

export type PartidaPatch = Partial<Pick<PartidaInput, 'descripcion' | 'unidad' | 'metrado' | 'precioUnitario'>>;

export function newPartidaId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();

    return uuid ? `p-${uuid}` : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toForest(partidas: PartidaInput[]): Branch[] {
    const branches = new Map<string, Branch>();
    partidas.forEach((item) => branches.set(item.id, { item, children: [] }));

    const roots: Branch[] = [];
    for (const item of partidas) {
        const branch = branches.get(item.id)!;
        const parent = item.parentId ? branches.get(item.parentId) : undefined;
        (parent && parent !== branch ? parent.children : roots).push(branch);
    }

    return roots;
}

const pad = (n: number): string => String(n).padStart(2, '0');

function flatten(forest: Branch[]): PartidaInput[] {
    const result: PartidaInput[] = [];
    const visit = (branches: Branch[], parent: PartidaInput | null) => {
        branches.forEach((branch, index) => {
            const codigo = parent ? `${parent.codigo}.${pad(index + 1)}` : pad(index + 1);
            const esTitulo = branch.children.length > 0;
            const item: PartidaInput = {
                ...branch.item,
                parentId: parent?.id ?? null,
                codigo,
                ...(esTitulo ? { unidad: null, metrado: null, precioUnitario: null } : {}),
            };
            result.push(item);
            visit(branch.children, item);
        });
    };
    visit(forest, null);

    return result;
}

function locate(forest: Branch[], id: string): Located | null {
    const search = (siblings: Branch[], parent: Branch | null): Located | null => {
        for (let index = 0; index < siblings.length; index++) {
            const branch = siblings[index];
            if (branch.item.id === id) {
                return { branch, siblings, index, parent };
            }
            const found = search(branch.children, branch);
            if (found) {
                return found;
            }
        }

        return null;
    };

    return search(forest, null);
}

/** Aplica una mutación sobre una copia del bosque y devuelve la lista normalizada. */
function mutate(partidas: PartidaInput[], change: (forest: Branch[]) => void): PartidaInput[] {
    const forest = toForest(partidas);
    change(forest);

    return flatten(forest);
}

export const normalizePartidas = (partidas: PartidaInput[]): PartidaInput[] => mutate(partidas, () => undefined);

const blank = (descripcion: string): PartidaInput => ({
    id: newPartidaId(),
    parentId: null,
    codigo: '',
    descripcion,
    unidad: null,
    metrado: null,
    precioUnitario: null,
});

/** Agrega un hijo al final de `parentId` (null = raíz). Si el padre era partida, pasa a título. */
export function addChild(partidas: PartidaInput[], parentId: string | null, descripcion = 'NUEVA PARTIDA'): { partidas: PartidaInput[]; id: string } {
    const nueva = blank(descripcion);
    const next = mutate(partidas, (forest) => {
        const target = parentId ? locate(forest, parentId) : null;
        (target ? target.branch.children : forest).push({ item: nueva, children: [] });
    });

    return { partidas: next, id: nueva.id };
}

export function addSibling(partidas: PartidaInput[], refId: string, position: 'before' | 'after', descripcion = 'NUEVA PARTIDA'): { partidas: PartidaInput[]; id: string } {
    const nueva = blank(descripcion);
    const next = mutate(partidas, (forest) => {
        const ref = locate(forest, refId);
        if (ref) {
            ref.siblings.splice(position === 'before' ? ref.index : ref.index + 1, 0, { item: nueva, children: [] });
        }
    });

    return { partidas: next, id: nueva.id };
}

/** Elimina el nodo con todo su contenido. */
export const removeNode = (partidas: PartidaInput[], id: string): PartidaInput[] =>
    mutate(partidas, (forest) => {
        const ref = locate(forest, id);
        ref?.siblings.splice(ref.index, 1);
    });

/** Bajar nivel: pasa a ser el último hijo de su hermano anterior. */
export const indent = (partidas: PartidaInput[], id: string): PartidaInput[] =>
    mutate(partidas, (forest) => {
        const ref = locate(forest, id);
        if (ref && ref.index > 0) {
            ref.siblings.splice(ref.index, 1);
            ref.siblings[ref.index - 1].children.push(ref.branch);
        }
    });

/** Subir nivel: sale de su padre y queda como hermano, justo debajo de él. */
export const outdent = (partidas: PartidaInput[], id: string): PartidaInput[] =>
    mutate(partidas, (forest) => {
        const ref = locate(forest, id);
        if (!ref?.parent) {
            return;
        }
        const parentRef = locate(forest, ref.parent.item.id)!;
        ref.siblings.splice(ref.index, 1);
        parentRef.siblings.splice(parentRef.index + 1, 0, ref.branch);
    });

/** Mover entre hermanos: -1 arriba, +1 abajo. */
export const moveSibling = (partidas: PartidaInput[], id: string, delta: -1 | 1): PartidaInput[] =>
    mutate(partidas, (forest) => {
        const ref = locate(forest, id);
        const target = ref ? ref.index + delta : -1;
        if (ref && target >= 0 && target < ref.siblings.length) {
            [ref.siblings[ref.index], ref.siblings[target]] = [ref.siblings[target], ref.siblings[ref.index]];
        }
    });

export const updatePartida = (partidas: PartidaInput[], id: string, patch: PartidaPatch): PartidaInput[] =>
    partidas.map((partida) => (partida.id === id ? { ...partida, ...patch } : partida));

export interface NodeContext {
    hasParent: boolean;
    hasPrev: boolean;
    hasNext: boolean;
    /** Filas que se borrarían (el nodo + su contenido). */
    subtreeSize: number;
    /** Id del hermano anterior (destino al bajar nivel). */
    prevId: string | null;
}

export function nodeContext(partidas: PartidaInput[], id: string): NodeContext | null {
    const forest = toForest(partidas);
    const ref = locate(forest, id);
    if (!ref) {
        return null;
    }
    const size = (branch: Branch): number => 1 + branch.children.reduce((acc, child) => acc + size(child), 0);

    return {
        hasParent: ref.parent !== null,
        hasPrev: ref.index > 0,
        hasNext: ref.index < ref.siblings.length - 1,
        subtreeSize: size(ref.branch),
        prevId: ref.index > 0 ? ref.siblings[ref.index - 1].item.id : null,
    };
}

/** ¿Convertir esta partida en título borraría datos cargados? */
export function wouldLoseData(partidas: PartidaInput[], id: string | null): boolean {
    if (!id) {
        return false;
    }
    const item = partidas.find((partida) => partida.id === id);
    if (!item || partidas.some((partida) => partida.parentId === id)) {
        return false;
    }
    const conValor = (value: string | null) => value !== null && Number(value) !== 0;

    return conValor(item.metrado) || conValor(item.precioUnitario);
}

/**
 * Desde filas con código (Excel/fixture): asigna id estable y parentId por
 * prefijo de código (al ancestro existente más cercano) y normaliza. Reporta
 * los códigos que cambian al renumerar (huecos o saltos en el expediente).
 */
export function fromCodigos(rows: PartidaRow[]): { partidas: PartidaInput[]; renumerados: Array<{ antes: string; despues: string }> } {
    const ids = new Map<string, string>();
    const partidas: PartidaInput[] = [];
    for (const row of rows) {
        if (ids.has(row.codigo)) {
            continue;
        }
        const id = `p-${row.codigo}`;
        ids.set(row.codigo, id);
        let ancestro = padreDe(row.codigo);
        while (ancestro && !ids.has(ancestro)) {
            ancestro = padreDe(ancestro);
        }
        partidas.push({ ...row, id, parentId: ancestro ? ids.get(ancestro)! : null });
    }

    const normalizadas = normalizePartidas(partidas);
    const original = new Map(partidas.map((partida) => [partida.id, partida.codigo]));
    const renumerados = normalizadas
        .filter((partida) => original.get(partida.id) !== partida.codigo)
        .map((partida) => ({ antes: original.get(partida.id)!, despues: partida.codigo }));

    return { partidas: normalizadas, renumerados };
}
