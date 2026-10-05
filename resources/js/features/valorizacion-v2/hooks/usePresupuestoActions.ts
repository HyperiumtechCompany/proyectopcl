import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, CornerDownRight, IndentDecrease, IndentIncrease, Trash2 } from 'lucide-react';
import type { PartidaNode } from '../lib/partidaTree';
import { addChild, addSibling, indent, moveSibling, nodeContext, outdent, removeNode, updatePartida, wouldLoseData } from '../lib/presupuestoOps';
import type { PartidaPatch } from '../lib/presupuestoOps';
import type { TreeMenuEntry } from '../shared/tree/TreeContextMenu';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';
import type { PartidaInput } from '../types';

interface Options {
    /** Se llama con el id recién creado (para mostrarlo y editarlo). */
    onCreated: (id: string) => void;
}

const LOSS_MESSAGE = (codigo: string) => `${codigo} pasará a ser título: se borrarán su unidad, metrado y precio unitario. ¿Continuar?`;

const PATCH_LABEL: Record<keyof PartidaPatch, string> = { descripcion: 'descripción', unidad: 'unidad', metrado: 'metrado', precioUnitario: 'precio unitario' };

/**
 * Acciones estructurales del presupuesto (agregar, mover, cambiar de nivel,
 * eliminar) y las entradas del menú contextual. La lógica vive en
 * lib/presupuestoOps; aquí solo se confirma y se aplica al store (con etiqueta
 * para el historial deshacer/rehacer).
 */
export function usePresupuestoActions({ onCreated }: Options) {
    const partidas = useValorizacionStore((state) => state.input.presupuesto.partidas);
    const updatePartidas = useValorizacionStore((state) => state.updatePartidas);

    const apply = (next: PartidaInput[], label: string) => updatePartidas(() => next, label);
    const confirmLoss = (id: string | null, codigo: string): boolean => !wouldLoseData(partidas, id) || window.confirm(LOSS_MESSAGE(codigo));

    const add = (result: { partidas: PartidaInput[]; id: string }, label: string) => {
        apply(result.partidas, label);
        onCreated(result.id);
    };

    const actions = {
        update: (node: PartidaNode, patch: PartidaPatch) => {
            const campo = PATCH_LABEL[Object.keys(patch)[0] as keyof PartidaPatch] ?? 'partida';
            apply(updatePartida(partidas, node.id, patch), `Editar ${campo} de ${node.codigo}`);
        },
        addRoot: () => add(addChild(partidas, null, 'NUEVO COMPONENTE'), 'Agregar componente'),
        addChild: (node: PartidaNode) => {
            if (confirmLoss(node.id, node.codigo)) {
                add(addChild(partidas, node.id), `Agregar hijo en ${node.codigo}`);
            }
        },
        addSibling: (node: PartidaNode, position: 'before' | 'after') =>
            add(addSibling(partidas, node.id, position), `Agregar hermano ${position === 'before' ? 'arriba' : 'abajo'} de ${node.codigo}`),
        indent: (node: PartidaNode, prevCodigo: string | null, prevId: string | null) => {
            if (confirmLoss(prevId, prevCodigo ?? '')) {
                apply(indent(partidas, node.id), `Bajar nivel de ${node.codigo}`);
            }
        },
        outdent: (node: PartidaNode) => apply(outdent(partidas, node.id), `Subir nivel de ${node.codigo}`),
        move: (node: PartidaNode, delta: -1 | 1) => apply(moveSibling(partidas, node.id, delta), `Mover ${node.codigo} ${delta < 0 ? 'arriba' : 'abajo'}`),
        remove: (node: PartidaNode, subtreeSize: number) => {
            const detalle = subtreeSize > 1 ? ` y sus ${subtreeSize - 1} filas internas` : '';
            if (window.confirm(`¿Eliminar ${node.codigo} ${node.descripcion}${detalle}? Puedes deshacerlo con Ctrl+Z.`)) {
                apply(removeNode(partidas, node.id), `Eliminar ${node.codigo}`);
            }
        },
    };

    const menuEntries = (node: PartidaNode): TreeMenuEntry[] => {
        const ctx = nodeContext(partidas, node.id);
        if (!ctx) {
            return [];
        }
        const prevCodigo = partidas.find((partida) => partida.id === ctx.prevId)?.codigo ?? null;

        return [
            {
                label: node.esHoja ? 'Agregar hijo (pasa a título)' : 'Agregar hijo',
                icon: CornerDownRight,
                onSelect: () => actions.addChild(node),
            },
            { label: 'Agregar hermano arriba', icon: ArrowUpToLine, onSelect: () => actions.addSibling(node, 'before') },
            { label: 'Agregar hermano abajo', icon: ArrowDownToLine, onSelect: () => actions.addSibling(node, 'after') },
            'separator',
            { label: 'Subir nivel', hint: 'sale de su título', icon: IndentDecrease, disabled: !ctx.hasParent, onSelect: () => actions.outdent(node) },
            { label: 'Bajar nivel', hint: prevCodigo ? `dentro de ${prevCodigo}` : undefined, icon: IndentIncrease, disabled: !ctx.hasPrev, onSelect: () => actions.indent(node, prevCodigo, ctx.prevId) },
            { label: 'Mover arriba', icon: ChevronUp, disabled: !ctx.hasPrev, onSelect: () => actions.move(node, -1) },
            { label: 'Mover abajo', icon: ChevronDown, disabled: !ctx.hasNext, onSelect: () => actions.move(node, 1) },
            'separator',
            {
                label: ctx.subtreeSize > 1 ? `Eliminar con su contenido (${ctx.subtreeSize})` : 'Eliminar',
                icon: Trash2,
                danger: true,
                onSelect: () => actions.remove(node, ctx.subtreeSize),
            },
        ];
    };

    return { actions, menuEntries };
}
