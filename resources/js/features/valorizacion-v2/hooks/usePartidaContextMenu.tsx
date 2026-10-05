import { EllipsisVertical } from 'lucide-react';
import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { PartidaNode } from '../lib/partidaTree';
import { TreeContextMenu } from '../shared/tree/TreeContextMenu';
import { usePresupuestoActions } from './usePresupuestoActions';

interface MenuState {
    x: number;
    y: number;
    node: PartidaNode;
}

/**
 * Menú de clic derecho / botón ⋮ sobre el árbol de partidas, el mismo en
 * todas las hojas (Presupuesto, calendarios, Metrados, VAL. MENSUAL). Siempre
 * edita el PRESUPUESTO —la fuente única de ítems y descripciones—, así lo que
 * se agrega o mueve en cualquier hoja aparece en todas.
 */
export function usePartidaContextMenu({ onCreated }: { onCreated: (id: string) => void }) {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const { actions, menuEntries } = usePresupuestoActions({ onCreated });

    const onRowContextMenu = (row: { node: PartidaNode }, event: MouseEvent) => setMenu({ node: row.node, x: event.clientX, y: event.clientY });

    const rowActions = (row: { node: PartidaNode }): ReactNode => (
        <button
            type="button"
            className="rounded p-1 text-stone-400 opacity-60 group-hover:opacity-100 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            aria-label={`Acciones de ${row.node.codigo}`}
            onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setMenu({ node: row.node, x: rect.left - 230, y: rect.bottom + 4 });
            }}
        >
            <EllipsisVertical className="size-3.5" />
        </button>
    );

    const element = menu ? (
        <TreeContextMenu x={menu.x} y={menu.y} title={menu.node.codigo} subtitle={menu.node.descripcion} entries={menuEntries(menu.node)} onClose={() => setMenu(null)} />
    ) : null;

    return { actions, activeId: menu?.node.id ?? null, onRowContextMenu, rowActions, element };
}
