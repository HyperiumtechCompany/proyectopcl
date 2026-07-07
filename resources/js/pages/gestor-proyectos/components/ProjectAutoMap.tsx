import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useGestorProyectoNodos, type NodoFormValues } from '@/hooks/gestor-proyectos/useGestorProyectoNodos';
import { AutoMapCanvas } from './AutoMapCanvas';
import { AutoMapToolbar } from './AutoMapToolbar';
import { layoutTree } from './layout';
import { NodeDetailPanel } from './NodeDetailPanel';
import { NodeFormDialog } from './NodeFormDialog';
import type { ApiNodo, ApiNodoContent, LayoutPosition, TreeNode } from './types';

interface ProjectAutoMapProps {
    gestorProyectoId: number;
    nombre: string;
    initialNodos: ApiNodo[];
    cantidadModulos: number | null;
}

type FormState = { mode: 'create'; parentId: string } | { mode: 'edit'; node: TreeNode };

function nodeToFormValues(node: TreeNode): NodoFormValues {
    const content = node.content;
    let apiContent: ApiNodoContent;

    if (typeof content !== 'string' && 'headers' in content) {
        apiContent = { headers: content.headers, rows: content.rows };
    } else if (typeof content !== 'string' && 'url' in content) {
        apiContent = { url: content.url, caption: content.caption };
    } else {
        apiContent = { text: typeof content === 'string' ? content : '' };
    }

    return {
        title: node.title,
        type: node.type,
        shape: node.shape ?? 'square',
        color: node.color,
        status: node.status,
        content: apiContent,
        peso: node.peso,
        dias: node.dias,
    };
}

export default function ProjectAutoMap({ gestorProyectoId, nombre, initialNodos, cantidadModulos }: ProjectAutoMapProps) {
    const { tree, isSaving, createNodo, updateNodo, deleteNodo } = useGestorProyectoNodos(gestorProyectoId, initialNodos);

    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const root = initialNodos.find((n) => n.parent_id === null);
        return root ? { [String(root.id)]: true } : {};
    });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [scale, setScale] = useState(0.85);
    const [pan, setPan] = useState({ x: 64, y: 48 });
    const [formState, setFormState] = useState<FormState | null>(null);

    const positions = useMemo(() => {
        const pos: Record<string, LayoutPosition> = {};
        const yRef = { current: 0 };

        tree.forEach((root) => {
            layoutTree(root, expanded, 0, yRef, pos, null, root.id);
            yRef.current += 2;
        });

        return pos;
    }, [tree, expanded]);

    const toggle = useCallback((id: string) => {
        setExpanded((current) => ({ ...current, [id]: !current[id] }));
    }, []);

    const resetView = useCallback(() => {
        setScale(0.85);
        setPan({ x: 64, y: 48 });
    }, []);

    const handleSelectNode = useCallback((node: TreeNode) => {
        setSelectedId(node.id);
    }, []);

    const handleAddChildRequest = useCallback((parentId: string) => {
        setFormState({ mode: 'create', parentId });
    }, []);

    const handleEditRequest = useCallback((node: TreeNode) => {
        setFormState({ mode: 'edit', node });
    }, []);

    const handleDeleteRequest = useCallback(
        async (node: TreeNode) => {
            const result = await Swal.fire({
                title: 'Eliminar nodo?',
                html: `<p class="text-sm text-gray-400">Se eliminara <strong>${node.title}</strong> y todos sus nodos hijos.<br/>Esta accion no se puede deshacer.</p>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Si, eliminar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626',
            });

            if (!result.isConfirmed) {
                return;
            }

            const success = await deleteNodo(Number(node.id));
            if (success && selectedId === node.id) {
                setSelectedId(null);
            }
        },
        [deleteNodo, selectedId],
    );

    const handleFormSubmit = useCallback(
        async (values: NodoFormValues) => {
            if (!formState) {
                return;
            }

            if (formState.mode === 'create') {
                const created = await createNodo(Number(formState.parentId), values);
                if (created) {
                    setExpanded((current) => ({ ...current, [formState.parentId]: true }));
                    setSelectedId(String(created.id));
                    setFormState(null);
                }
                return;
            }

            const updated = await updateNodo(Number(formState.node.id), values);
            if (updated) {
                setFormState(null);
            }
        },
        [formState, createNodo, updateNodo],
    );

    const nodeList = Object.values(positions);
    const mainNodes = nodeList.filter((position) => position.lane === 'main').sort((a, b) => a.y - b.y);
    const flowEdges = mainNodes.slice(1).map((position, index) => ({ from: mainNodes[index], to: position }));
    const detailEdges = nodeList.flatMap((position) => {
        if (position.lane !== 'detail' || !position.parentId || !positions[position.parentId]) {
            return [];
        }

        return [{ from: positions[position.parentId], to: position }];
    });
    const edges = [...flowEdges, ...detailEdges];

    const selected = selectedId ? (positions[selectedId]?.node ?? null) : null;
    const selectedPosition = selected ? positions[selected.id] : null;
    const selectedChildrenLabel = selectedPosition?.parentId === null ? 'Hijos directos' : 'Descendencias';
    const isSelectedProtected = selectedPosition?.parentId === null || selected?.role === 'head' || selected?.role === 'tail';

    const maxX = nodeList.length > 0 ? Math.max(...nodeList.map((position) => position.x)) + 232 : 232;
    const maxY = nodeList.length > 0 ? Math.max(...nodeList.map((position) => position.y)) + 80 : 80;

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0c10] text-zinc-200 shadow-2xl">
            <AutoMapToolbar
                title={nombre}
                subtitle="Mapa del gestor de proyectos"
                scale={scale}
                onZoomIn={() => setScale((current) => Math.min(2, current + 0.15))}
                onZoomOut={() => setScale((current) => Math.max(0.3, current - 0.15))}
                onReset={resetView}
            />

            <AutoMapCanvas
                nodeList={nodeList}
                edges={edges}
                maxX={maxX}
                maxY={maxY}
                scale={scale}
                pan={pan}
                setScale={setScale}
                setPan={setPan}
                selectedId={selectedId}
                onSelectNode={handleSelectNode}
                onToggleNode={toggle}
                onAddChildNode={handleAddChildRequest}
            >
                {selected && (
                    <NodeDetailPanel
                        selected={selected}
                        isProtected={isSelectedProtected}
                        selectedChildrenLabel={selectedChildrenLabel}
                        depth={selectedPosition?.depth ?? 0}
                        cantidadModulos={cantidadModulos}
                        onClose={() => setSelectedId(null)}
                        onSelectChild={handleSelectNode}
                        onRequestAddChild={() => handleAddChildRequest(selected.id)}
                        onRequestEdit={() => handleEditRequest(selected)}
                        onRequestDelete={() => handleDeleteRequest(selected)}
                    />
                )}
            </AutoMapCanvas>

            <NodeFormDialog
                open={formState !== null}
                mode={formState?.mode ?? 'create'}
                initialValues={formState?.mode === 'edit' ? nodeToFormValues(formState.node) : undefined}
                isSaving={isSaving}
                onClose={() => setFormState(null)}
                onSubmit={handleFormSubmit}
            />
        </div>
    );
}
