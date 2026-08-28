import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    CornerDownRight,
    GripVertical,
    LogOut,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Swal from 'sweetalert2';
import {
    buildInitialMonomios,
    canMoveNode,
    deriveMonomioSymbol,
    flattenNodes,
    moveNode,
    moveNodeWithinSiblings,
    reconcileMonomiosWithCatalog,
    reorderNodeAmongSiblings,
    sumNode,
    type FormulaMonomio,
    type FormulaNode,
} from '../helpers/formulaPolinomicaTree';

const MAX_MONOMIOS = 8;
interface Props {
    parentMap: Map<string, number>;
    budgetTotal: number;
    codeToDesc: Map<string, string>;
    sortedCodes: string[];
    persistedMonomios?: FormulaMonomio[] | null;
    isLoading?: boolean;
    onMonomiosChange?: (monomios: FormulaMonomio[]) => void;
}
const fmt = (value: number) => value.toFixed(3);
const nextSymbol = (items: FormulaMonomio[], description: string) => {
    const used = new Set(items.map((item) => item.nomenclatura));
    const preferred = deriveMonomioSymbol(description);
    if (!used.has(preferred)) return preferred;
    let suffix = 2;
    while (used.has(`${preferred}${suffix}`)) suffix++;
    return `${preferred}${suffix}`;
};
function updateNode(
    node: FormulaNode,
    id: string,
    update: (node: FormulaNode) => FormulaNode,
): FormulaNode {
    if (node.id === id) return update(node);
    return {
        ...node,
        children: node.children.map((child) => updateNode(child, id, update)),
    };
}
function detachChild(
    node: FormulaNode,
    id: string,
): { node: FormulaNode; detached: FormulaNode | null } {
    let detached: FormulaNode | null = null;
    const children = node.children
        .filter((child) => {
            if (child.id !== id) return true;
            detached = child;
            return false;
        })
        .map((child) => {
            const result = detachChild(child, id);
            if (result.detached) detached = result.detached;
            return result.node;
        });
    return { node: { ...node, children }, detached };
}
function FormulaBar({ monomios }: { monomios: FormulaMonomio[] }) {
    return (
        <div className="shrink-0 overflow-x-auto border-b border-slate-700 bg-slate-950 px-3 py-2">
            <div className="flex min-w-max items-center gap-1 text-[11px]">
                <span className="mr-1 font-bold text-slate-300">K =</span>
                {monomios.map((monomio, index) => (
                    <React.Fragment key={monomio.id}>
                        {index > 0 && (
                            <span className="mx-1.5 text-slate-600">+</span>
                        )}
                        <span className="font-mono font-semibold text-amber-300">
                            {fmt(sumNode(monomio.root))}
                        </span>
                        <span className="mx-1 text-slate-600">·</span>
                        <span className="font-mono font-bold text-sky-300">
                            {monomio.nomenclatura}r/{monomio.nomenclatura}o
                        </span>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

export function FormulaPolinomicaBuilder({
    parentMap,
    codeToDesc,
    sortedCodes,
    persistedMonomios,
    isLoading = false,
    onMonomiosChange,
}: Props) {
    const initial = useCallback(
        () => buildInitialMonomios(parentMap, sortedCodes, codeToDesc),
        [parentMap, sortedCodes, codeToDesc],
    );
    const [monomios, setMonomios] = useState<FormulaMonomio[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [editingCoef, setEditingCoef] = useState<string | null>(null);
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [reorderOverId, setReorderOverId] = useState<string | null>(null);
    const [reorderPlacement, setReorderPlacement] = useState<
        'before' | 'after'
    >('before');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const groupDragIdRef = useRef<string | null>(null);
    const reorderDragIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (isLoading) return;
        const restored = persistedMonomios
            ? reconcileMonomiosWithCatalog(persistedMonomios, codeToDesc)
            : initial();
        setMonomios(restored);
        setExpanded(
            new Set(
                restored
                    .flatMap((item) => flattenNodes(item.root))
                    .filter((node) => node.children.length > 0)
                    .map((node) => node.id),
            ),
        );
    }, [codeToDesc, initial, isLoading, persistedMonomios]);
    useEffect(() => onMonomiosChange?.(monomios), [monomios, onMonomiosChange]);

    const allNodes = useMemo(
        () => monomios.flatMap((item) => flattenNodes(item.root)),
        [monomios],
    );
    const usedCodes = useMemo(
        () => new Set(allNodes.map((node) => node.code)),
        [allNodes],
    );
    const totalInsumo = useMemo(
        () =>
            Array.from(parentMap.values()).reduce(
                (sum, value) => sum + value,
                0,
            ),
        [parentMap],
    );
    const available = useMemo(
        () =>
            sortedCodes
                .filter(
                    (code) =>
                        !usedCodes.has(code) && (parentMap.get(code) ?? 0) > 0,
                )
                .map((code) => {
                    const calculated = (parentMap.get(code) ?? 0) / totalInsumo;
                    return {
                        id: `i-${code}`,
                        code,
                        descripcion: codeToDesc.get(code) ?? `Índice ${code}`,
                        coefCalculado: calculated,
                        coefDefinido: Number(calculated.toFixed(3)),
                        children: [],
                    } satisfies FormulaNode;
                }),
        [sortedCodes, usedCodes, parentMap, totalInsumo, codeToDesc],
    );
    const total = monomios.reduce((sum, item) => sum + sumNode(item.root), 0);
    const totalOk = Math.abs(total - 1) < 0.005;

    const toggle = (id: string) =>
        setExpanded((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    const saveCoef = (id: string, raw: string) => {
        const value = Number(raw);
        if (Number.isFinite(value))
            setMonomios((current) =>
                current.map((item) => ({
                    ...item,
                    root: updateNode(item.root, id, (node) => ({
                        ...node,
                        coefDefinido: Math.max(0, Math.min(1, value)),
                    })),
                })),
            );
        setEditingCoef(null);
    };
    const extract = (nodeId: string) =>
        setMonomios((current) => {
            let detached: FormulaNode | null = null;
            const updated = current.map((item) => {
                const result = detachChild(item.root, nodeId);
                if (result.detached) detached = result.detached;
                return { ...item, root: result.node };
            });
            const extracted = detached as FormulaNode | null;
            return extracted
                ? [
                      ...updated,
                      {
                          id: `m-${nodeId}`,
                          nomenclatura: nextSymbol(
                              updated,
                              extracted.descripcion,
                          ),
                          root: extracted,
                      },
                  ]
                : current;
        });
    const groupNode = (sourceId: string, targetId: string) => {
        const target = allNodes.find((node) => node.id === targetId);
        if (target && target.children.length >= 2) {
            void Swal.fire({
                icon: 'warning',
                title: 'Límite de monomios',
                text: 'Este monomio ya contiene los dos monomios permitidos. Agrupa el nuevo monomio dentro de uno de sus hijos.',
                confirmButtonText: 'Entendido',
            });
            return;
        }
        if (!canMoveNode(monomios, sourceId, targetId)) return;
        setMonomios((current) => moveNode(current, sourceId, targetId));
        setExpanded((current) => new Set(current).add(targetId));
        setSelectedNodeId(null);
    };
    const drop = (event: React.DragEvent, targetId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceId = groupDragIdRef.current;
        if (sourceId) groupNode(sourceId, targetId);
        groupDragIdRef.current = null;
        setDragNodeId(null);
        setDragOverId(null);
    };
    const dropReorder = (event: React.DragEvent, targetId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceId = reorderDragIdRef.current;
        if (sourceId) {
            setMonomios((current) =>
                reorderNodeAmongSiblings(
                    current,
                    sourceId,
                    targetId,
                    reorderPlacement,
                ),
            );
        }
        reorderDragIdRef.current = null;
        setReorderOverId(null);
    };

    const renderNode = (
        node: FormulaNode,
        monomio: FormulaMonomio,
        depth: number,
        root: boolean,
    ): React.ReactNode => {
        const nodeTotal = sumNode(node);
        const activeSourceId = dragNodeId ?? selectedNodeId;
        const canReceive = Boolean(
            activeSourceId && canMoveNode(monomios, activeSourceId, node.id),
        );
        const isFullTarget = Boolean(
            selectedNodeId &&
            selectedNodeId !== node.id &&
            node.children.length >= 2,
        );
        const isExpanded = expanded.has(node.id);
        const siblingIds = root
            ? monomios.map((item) => item.root.id)
            : (allNodes
                  .find((candidate) =>
                      candidate.children.some((child) => child.id === node.id),
                  )
                  ?.children.map((child) => child.id) ?? []);
        const siblingIndex = siblingIds.indexOf(node.id);
        const canMoveUp = siblingIndex > 0;
        const canMoveDown =
            siblingIndex >= 0 && siblingIndex < siblingIds.length - 1;
        return (
            <React.Fragment key={node.id}>
                <tr
                    onDragOver={(event) => {
                        const reorderSourceId = reorderDragIdRef.current;
                        if (reorderSourceId && reorderSourceId !== node.id) {
                            if (!siblingIds.includes(reorderSourceId)) {
                                event.dataTransfer.dropEffect = 'none';
                                return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = 'move';
                            const rect =
                                event.currentTarget.getBoundingClientRect();
                            setReorderPlacement(
                                event.clientY < rect.top + rect.height / 2
                                    ? 'before'
                                    : 'after',
                            );
                            setReorderOverId(node.id);
                            return;
                        }
                        if (!activeSourceId || activeSourceId === node.id)
                            return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = canReceive
                            ? 'move'
                            : 'none';
                        setDragOverId(node.id);
                    }}
                    onDrop={(event) =>
                        reorderDragIdRef.current
                            ? dropReorder(event, node.id)
                            : drop(event, node.id)
                    }
                    className={`border-b border-slate-700/60 ${root ? 'border-t-2 border-t-slate-600 bg-slate-800' : 'bg-slate-900'} ${dragOverId === node.id ? 'ring-2 ring-sky-500 ring-inset' : ''} ${reorderOverId === node.id ? `ring-2 ring-inset ${reorderPlacement === 'before' ? 'ring-emerald-400' : 'ring-teal-500'}` : ''} ${selectedNodeId === node.id ? 'bg-violet-950/60 ring-1 ring-violet-500 ring-inset' : ''}`}
                >
                    <td className="p-1 text-center">
                        <div
                            className="flex items-center justify-center gap-0.5"
                            style={{ paddingLeft: depth * 10 }}
                        >
                            <span
                                draggable
                                title="Arrastrar para ordenar dentro de este nivel"
                                onDragStart={(event) => {
                                    event.stopPropagation();
                                    event.dataTransfer.effectAllowed = 'move';
                                    reorderDragIdRef.current = node.id;
                                    groupDragIdRef.current = null;
                                    setSelectedNodeId(null);
                                    setDragNodeId(null);
                                }}
                                onDragEnd={() => {
                                    reorderDragIdRef.current = null;
                                    setReorderOverId(null);
                                }}
                                className="cursor-grab rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-emerald-300 active:cursor-grabbing"
                            >
                                <GripVertical size={11} />
                            </span>
                            {node.children.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => toggle(node.id)}
                                    className="text-amber-400"
                                >
                                    {isExpanded ? (
                                        <ChevronDown size={12} />
                                    ) : (
                                        <ChevronRight size={12} />
                                    )}
                                </button>
                            ) : (
                                <span className="w-3" />
                            )}
                        </div>
                    </td>
                    <td
                        className="py-1.5 pr-1"
                        style={{ paddingLeft: 6 + depth * 22 }}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className="rounded bg-slate-700 px-1 py-0.5 font-mono text-[9px] font-bold text-sky-400">
                                {node.code}
                            </span>
                            <span className="font-bold text-amber-300">
                                {node.descripcion}
                            </span>
                            <span className="rounded bg-violet-900/50 px-1 text-[8px] font-semibold text-violet-300">
                                MONOMIO
                                {node.children.length > 0
                                    ? ` +${node.children.length}`
                                    : ''}
                            </span>
                            {canReceive && (
                                <span className="text-[8px] text-sky-300">
                                    soltar aquí
                                </span>
                            )}
                        </div>
                    </td>
                    <td className="p-1 text-center">
                        {root ? (
                            <span
                                className="font-mono font-bold text-emerald-300"
                                title="Nomenclatura técnica asignada según el concepto representativo"
                            >
                                {monomio.nomenclatura}
                            </span>
                        ) : (
                            '—'
                        )}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono font-bold text-slate-200">
                        {fmt(nodeTotal)}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-slate-400">
                        {sumNode(monomio.root) > 0
                            ? ((nodeTotal / sumNode(monomio.root)) * 100).toFixed(2)
                            : '0.00'}
                    </td>
                    <td className="p-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                            <button
                                type="button"
                                disabled={!canMoveUp}
                                onClick={() =>
                                    setMonomios((current) =>
                                        moveNodeWithinSiblings(
                                            current,
                                            node.id,
                                            -1,
                                        ),
                                    )
                                }
                                title="Subir dentro de este nivel"
                                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-20"
                            >
                                <ArrowUp size={11} />
                            </button>
                            <button
                                type="button"
                                disabled={!canMoveDown}
                                onClick={() =>
                                    setMonomios((current) =>
                                        moveNodeWithinSiblings(
                                            current,
                                            node.id,
                                            1,
                                        ),
                                    )
                                }
                                title="Bajar dentro de este nivel"
                                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-20"
                            >
                                <ArrowDown size={11} />
                            </button>
                            {isFullTarget ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        groupNode(selectedNodeId!, node.id)
                                    }
                                    title="Este monomio ya tiene dos hijos"
                                    className="rounded bg-amber-700 p-1 text-white hover:bg-amber-600"
                                >
                                    <AlertTriangle size={11} />
                                </button>
                            ) : canReceive && selectedNodeId ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        groupNode(selectedNodeId, node.id)
                                    }
                                    title="Agregar el monomio seleccionado dentro de este nodo"
                                    className="rounded bg-sky-600 p-1 text-white hover:bg-sky-500"
                                >
                                    <CornerDownRight size={11} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                        event.stopPropagation();
                                        event.dataTransfer.effectAllowed =
                                            'move';
                                        groupDragIdRef.current = node.id;
                                        reorderDragIdRef.current = null;
                                        setDragNodeId(node.id);
                                    }}
                                    onDragEnd={() => {
                                        groupDragIdRef.current = null;
                                        setDragNodeId(null);
                                        setDragOverId(null);
                                    }}
                                    onClick={() =>
                                        setSelectedNodeId((current) =>
                                            current === node.id
                                                ? null
                                                : node.id,
                                        )
                                    }
                                    title={
                                        selectedNodeId === node.id
                                            ? 'Cancelar agrupación'
                                            : 'Arrastrar o seleccionar para agrupar'
                                    }
                                    className={`rounded p-1 ${selectedNodeId === node.id ? 'bg-violet-600 text-white' : 'cursor-grab text-slate-500 hover:bg-slate-700 hover:text-violet-300 active:cursor-grabbing'}`}
                                >
                                    {selectedNodeId === node.id ? (
                                        <X size={11} />
                                    ) : (
                                        <GripVertical size={11} />
                                    )}
                                </button>
                            )}
                            {root ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setMonomios((current) =>
                                            current.filter(
                                                (item) =>
                                                    item.id !== monomio.id,
                                            ),
                                        )
                                    }
                                    title="Eliminar monomio"
                                    className="text-slate-600 hover:text-red-400"
                                >
                                    <Trash2 size={12} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => extract(node.id)}
                                    title="Extraer subárbol como monomio"
                                    className="text-slate-600 hover:text-violet-400"
                                >
                                    <LogOut size={11} />
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
                <tr className="border-b border-slate-800 bg-slate-950">
                    <td className="py-1 text-center text-slate-600">
                        <CornerDownRight size={10} className="ml-auto" />
                    </td>
                    <td
                        className="py-1.5 pr-1 text-slate-300"
                        style={{ paddingLeft: 28 + depth * 22 }}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-sky-400">
                                {node.code}
                            </span>
                            <span>{node.descripcion}</span>
                            <span className="text-[8px] text-slate-600 uppercase">
                                índice
                            </span>
                        </div>
                    </td>
                    <td className="p-1 text-center text-slate-700">—</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                        {editingCoef === node.id ? (
                            <input
                                autoFocus
                                defaultValue={fmt(node.coefDefinido)}
                                className="w-20 rounded border border-emerald-500 bg-slate-900 px-1 text-right"
                                onBlur={(event) =>
                                    saveCoef(node.id, event.target.value)
                                }
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setEditingCoef(node.id)}
                            >
                                {fmt(node.coefDefinido)}
                            </button>
                        )}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-slate-500">
                        {sumNode(monomio.root) > 0
                            ? (
                                  (node.coefDefinido / sumNode(monomio.root)) *
                                  100
                              ).toFixed(2)
                            : '0.00'}
                    </td>
                    <td />
                </tr>
                {isExpanded &&
                    node.children.map((child) =>
                        renderNode(child, monomio, depth + 1, false),
                    )}
            </React.Fragment>
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-[11px]">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    Fórmula Polinómica
                </span>
                <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${monomios.length > MAX_MONOMIOS ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-800 text-slate-400'}`}
                >
                    {monomios.length}/{MAX_MONOMIOS} monomios
                </span>
                <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${totalOk ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}
                >
                    Σ = {fmt(total)}
                </span>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={() => {
                        setMonomios(initial());
                        setExpanded(new Set());
                    }}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700"
                >
                    <RefreshCw size={10} /> Restablecer sin agrupar
                </button>
            </div>
            {monomios.length > MAX_MONOMIOS && (
                <div className="flex items-center gap-1.5 border-b border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-[9px] text-amber-400">
                    <AlertTriangle size={11} /> Máximo normativo: {MAX_MONOMIOS}
                    . Cada nodo admite hasta dos hijos.
                </div>
            )}
            <FormulaBar monomios={monomios} />
            {selectedNodeId && (
                <div className="flex shrink-0 items-center gap-2 border-b border-violet-700 bg-violet-950/50 px-3 py-1.5 text-[10px] text-violet-200">
                    <CornerDownRight size={12} />
                    <span>
                        Monomio seleccionado. Pulsa el botón azul del monomio
                        donde deseas agruparlo.
                    </span>
                    <button
                        type="button"
                        onClick={() => setSelectedNodeId(null)}
                        className="ml-auto rounded p-0.5 hover:bg-violet-800"
                        title="Cancelar"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-800 text-[10px] font-semibold text-slate-400">
                            <th className="w-8 py-1.5" />
                            <th className="py-1.5 text-left">
                                Monomio / descripción
                            </th>
                            <th className="w-20 py-1.5">Nomen.</th>
                            <th className="w-28 py-1.5 text-right">
                                Coeficiente
                            </th>
                            <th className="w-20 py-1.5 text-right">
                                % Monomio
                            </th>
                            <th className="w-16" />
                        </tr>
                    </thead>
                    <tbody>
                        {monomios.map((item) =>
                            renderNode(item.root, item, 0, true),
                        )}
                    </tbody>
                    <tfoot className="sticky bottom-0">
                        <tr
                            className={
                                totalOk
                                    ? 'bg-emerald-950/50'
                                    : 'bg-amber-950/40'
                            }
                        >
                            <td
                                colSpan={3}
                                className="border-t-2 border-slate-600 py-1.5 pr-2 text-right font-bold"
                            >
                                TOTAL
                            </td>
                            <td className="border-t-2 border-slate-600 pr-2 text-right font-mono font-bold">
                                {fmt(total)}
                            </td>
                            <td
                                colSpan={2}
                                className="border-t-2 border-slate-600"
                            />
                        </tr>
                    </tfoot>
                </table>
            </div>
            {available.length > 0 && (
                <div className="shrink-0 border-t border-slate-700 bg-slate-900 px-3 py-2">
                    <p className="mb-1 text-[9px] text-slate-500 uppercase">
                        Sin asignar ({available.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {available.map((node) => (
                            <button
                                key={node.id}
                                type="button"
                                onClick={() =>
                                    setMonomios((current) => [
                                        ...current,
                                        {
                                            id: `m-${node.code}-${Date.now()}`,
                                            nomenclatura: nextSymbol(
                                                current,
                                                node.descripcion,
                                            ),
                                            root: node,
                                        },
                                    ])
                                }
                                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:border-sky-600"
                            >
                                <Plus size={9} /> {node.code} {node.descripcion}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-3 py-1 text-center text-[8px] text-slate-500">
                Asa izquierda o ↑ ↓: ordenar entre hermanos · asa derecha:
                agrupar · máximo 2 hijos directos por nodo · profundidad
                ilimitada
            </div>
        </div>
    );
}
