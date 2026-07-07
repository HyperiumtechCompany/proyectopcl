import type { ApiNodo, LayoutPosition, TreeContent, TreeNode } from './types';

export const NODE_W = 232;
export const NODE_H = 80;
export const X_GAP = 96;
export const Y_GAP = 54;

function toTreeContent(nodo: ApiNodo): TreeContent {
    const content = nodo.content;

    if (!content) {
        return '';
    }

    if (nodo.type === 'table') {
        return { headers: content.headers ?? [], rows: content.rows ?? [] };
    }

    if (nodo.type === 'image' || nodo.type === 'video') {
        return { url: content.url ?? '', caption: content.caption ?? '' };
    }

    return content.text ?? '';
}

/** Arma el arbol anidado (TreeNode[]) a partir de la lista plana que devuelve el backend. */
export function buildTree(apiNodos: ApiNodo[]): TreeNode[] {
    const byParent = new Map<number | null, ApiNodo[]>();

    for (const nodo of apiNodos) {
        const siblings = byParent.get(nodo.parent_id) ?? [];
        siblings.push(nodo);
        byParent.set(nodo.parent_id, siblings);
    }

    for (const siblings of byParent.values()) {
        siblings.sort((a, b) => a.order - b.order);
    }

    const build = (nodo: ApiNodo): TreeNode => ({
        id: String(nodo.id),
        title: nodo.title,
        type: nodo.type,
        shape: nodo.shape,
        color: nodo.color,
        status: nodo.status,
        content: toTreeContent(nodo),
        children: (byParent.get(nodo.id) ?? []).map(build),
    });

    return (byParent.get(null) ?? []).map(build);
}

export function layoutTree(
    node: TreeNode,
    expanded: Record<string, boolean>,
    depth: number,
    rowRef: { current: number },
    positions: Record<string, LayoutPosition>,
    parentId: string | null,
    rootId: string,
    column = 0,
    lane: 'main' | 'detail' = 'main',
): void {
    const isExpanded = expanded[node.id] === true;
    const row = rowRef.current;

    positions[node.id] = {
        x: column * (NODE_W + X_GAP),
        y: row * (NODE_H + Y_GAP),
        node,
        parentId,
        rootId,
        depth,
        lane,
        hasChildren: node.children.length > 0,
        expanded: isExpanded,
    };

    if (!isExpanded) {
        rowRef.current = row + 1;
        return;
    }

    if (parentId === null) {
        node.children.forEach((child, index) => {
            layoutTree(child, expanded, depth + 1, { current: row + index + 1 }, positions, node.id, rootId, column, 'main');
        });
        rowRef.current = row + node.children.length + 1;
        return;
    }

    if (node.children.length > 0) {
        node.children.forEach((child, index) => {
            layoutTree(child, expanded, depth + 1, { current: row + index }, positions, node.id, rootId, column + 1, 'detail');
        });
    }
}
