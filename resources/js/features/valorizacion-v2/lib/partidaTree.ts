import type Decimal from 'decimal.js';
import type { PartidaInput } from '../types/partida';
import { D } from './money';

/**
 * Árbol de partidas compartido por PRESUPUESTO, calendarios, METRADOS,
 * VAL. MENSUAL, PROG VS. EJEC y RESUMEN VAL. Se construye desde la lista plana
 * (parentId + orden) y cada hoja le cuelga sus valores por id.
 */
export interface PartidaNode {
    id: string;
    codigo: string;
    descripcion: string;
    unidad: string | null;
    /** 1 = obra, 2 = componente, 3 = subcomponente… (profundidad real). */
    nivel: number;
    parentId: string | null;
    /** Sin hijos = partida (lleva unidad/metrado/P.U.). */
    esHoja: boolean;
    children: PartidaNode[];
    input: PartidaInput;
}

export interface PartidaTree {
    roots: PartidaNode[];
    /** Recorrido en preorden (orden de ítem). */
    ordered: PartidaNode[];
    byId: Map<string, PartidaNode>;
    /** Problemas a corregir (partidas sin datos, padres faltantes…). */
    issues: string[];
}

/** "01.02.03" → "01.02" (solo para importar desde códigos). */
export const padreDe = (codigo: string): string | null => {
    const index = codigo.lastIndexOf('.');

    return index === -1 ? null : codigo.slice(0, index);
};

const tieneDatos = (input: PartidaInput): boolean => Boolean(input.unidad) || input.metrado !== null || input.precioUnitario !== null;

export function buildPartidaTree(partidas: PartidaInput[]): PartidaTree {
    const issues: string[] = [];
    const byId = new Map<string, PartidaNode>();

    for (const input of partidas) {
        if (byId.has(input.id)) {
            issues.push(`Fila repetida ${input.codigo}: se ignoró la segunda aparición.`);
            continue;
        }
        byId.set(input.id, {
            id: input.id,
            codigo: input.codigo,
            descripcion: input.descripcion.trim(),
            unidad: input.unidad,
            nivel: 1,
            parentId: input.parentId,
            esHoja: true,
            children: [],
            input,
        });
    }

    const roots: PartidaNode[] = [];
    for (const node of byId.values()) {
        const parent = node.parentId ? byId.get(node.parentId) : undefined;
        if (parent && parent !== node) {
            parent.children.push(node);
        } else {
            if (node.parentId) {
                issues.push(`${node.codigo} apunta a un título que no existe; se muestra en la raíz.`);
            }
            roots.push(node);
        }
    }

    const ordered: PartidaNode[] = [];
    const visited = new Set<string>();
    const visit = (nodes: PartidaNode[], nivel: number) => {
        for (const node of nodes) {
            if (visited.has(node.id)) {
                continue;
            }
            visited.add(node.id);
            node.nivel = nivel;
            node.esHoja = node.children.length === 0;
            if (node.esHoja) {
                const faltan = [!node.input.unidad && 'unidad', node.input.metrado === null && 'metrado', node.input.precioUnitario === null && 'precio unitario'].filter(Boolean);
                if (faltan.length > 0) {
                    issues.push(`${node.codigo} ${node.descripcion}: falta ${faltan.join(', ')}.`);
                }
            } else if (tieneDatos(node.input)) {
                issues.push(`${node.codigo} tiene subpartidas y además unidad/metrado/P.U.: esos datos no se suman.`);
            }
            ordered.push(node);
            visit(node.children, nivel + 1);
        }
    };
    visit(roots, 1);

    if (visited.size < byId.size) {
        issues.push(`${byId.size - visited.size} filas forman un ciclo de padres y no se muestran.`);
    }

    return { roots, ordered, byId, issues };
}

/** Suma valores de hojas hacia sus títulos (exacto, con Decimal). */
export function rollup(tree: PartidaTree, leafValue: (node: PartidaNode) => Decimal | null): Map<string, Decimal> {
    const result = new Map<string, Decimal>();
    const visit = (node: PartidaNode): Decimal => {
        const value = node.esHoja ? (leafValue(node) ?? D(0)) : node.children.reduce((acc, child) => acc.add(visit(child)), D(0));
        result.set(node.id, value);

        return value;
    };
    tree.roots.forEach(visit);

    return result;
}

/** Ids de los ancestros de un nodo, del padre hacia la raíz. */
export function ancestorIds(tree: PartidaTree, id: string): string[] {
    const result: string[] = [];
    let current = tree.byId.get(id)?.parentId ?? null;
    while (current && !result.includes(current)) {
        result.push(current);
        current = tree.byId.get(current)?.parentId ?? null;
    }

    return result;
}

const normalize = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Ids visibles según títulos colapsados y búsqueda. Con búsqueda se ignora el
 * colapso y se muestran: coincidencias, sus ancestros y, si coincide un título,
 * todo su contenido.
 */
export function visibleIds(tree: PartidaTree, collapsed: ReadonlySet<string>, query: string): Set<string> {
    const visible = new Set<string>();
    const needle = normalize(query.trim());

    if (needle === '') {
        for (const node of tree.ordered) {
            if (!ancestorIds(tree, node.id).some((id) => collapsed.has(id))) {
                visible.add(node.id);
            }
        }

        return visible;
    }

    const addSubtree = (node: PartidaNode) => {
        visible.add(node.id);
        node.children.forEach(addSubtree);
    };
    for (const node of tree.ordered) {
        if (normalize(`${node.codigo} ${node.descripcion}`).includes(needle)) {
            addSubtree(node);
            ancestorIds(tree, node.id).forEach((id) => visible.add(id));
        }
    }

    return visible;
}
