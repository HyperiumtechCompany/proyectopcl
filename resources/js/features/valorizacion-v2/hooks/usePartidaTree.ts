import { useState } from 'react';
import { ancestorIds, visibleIds } from '../lib/partidaTree';
import type { PartidaTree } from '../lib/partidaTree';

export interface PartidaTreeState {
    collapsed: ReadonlySet<string>;
    visible: Set<string>;
    query: string;
    maxNivel: number;
    setQuery: (query: string) => void;
    toggle: (id: string) => void;
    /** Muestra hasta el nivel indicado (1 = solo la obra). */
    expandToLevel: (nivel: number) => void;
    expandAll: () => void;
    /** Abre los ancestros de un nodo (y el propio) para que quede visible. */
    reveal: (id: string) => void;
}

/** Estado de expansión/búsqueda de un árbol de partidas; lo usan todas las hojas con árbol. */
export function usePartidaTree(tree: PartidaTree): PartidaTreeState {
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
    const [query, setQuery] = useState('');

    const toggle = (id: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    const expandToLevel = (nivel: number) => {
        setCollapsed(new Set(tree.ordered.filter((node) => node.children.length > 0 && node.nivel >= nivel).map((node) => node.id)));
    };

    return {
        collapsed,
        visible: visibleIds(tree, collapsed, query),
        query,
        maxNivel: tree.ordered.reduce((max, node) => Math.max(max, node.nivel), 1),
        setQuery,
        toggle,
        expandToLevel,
        expandAll: () => setCollapsed(new Set()),
        reveal: (id) =>
            setCollapsed((current) => {
                const next = new Set(current);
                [id, ...ancestorIds(tree, id)].forEach((c) => next.delete(c));

                return next;
            }),
    };
}
