// components/GGFijosPanel.tsx
import { Loader2, Plus, Trash2, Save, Lock, ChevronDown, ChevronRight, MoreVertical } from 'lucide-react';
import React, { useState } from 'react';
import type { GGFijoNode} from '../stores/ggFijosStore';
import { useGGFijosStore, TipoFilaFijo } from '../stores/ggFijosStore';
import { PlazoDisplay } from './PlazoDisplay';

interface GGFijosPanelProps {
    loading: boolean;
    nodes: GGFijoNode[];
    onSave: (data: GGFijoNode[]) => Promise<any>;
    projectId: number;
    totalBudget?: number;
}

const fmt = (n: number) => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function GGFijosPanel({ loading, nodes, onSave, projectId, totalBudget = 0 }: GGFijosPanelProps) {
    const { updateNode, addNode, removeNode, getTotal, isDirty, applyTemplate, syncFromGlobals } = useGGFijosStore();
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isActive = true; // For the sync effect
    const total = getTotal();

    // 1. Auto-apply template if empty
    React.useEffect(() => {
        if (!loading && nodes.length === 0) {
            applyTemplate('standard_fijos');
        }
    }, [loading, nodes.length, applyTemplate]);

    // 2. Auto-sync from globals on load
    React.useEffect(() => {
        if (!loading && isActive) {
            syncFromGlobals(projectId);
        }
    }, [loading, projectId, isActive, syncFromGlobals]);

    // 3. Auto-save with debounce
    React.useEffect(() => {
        if (!isDirty || isSaving || loading) return;

        const timer = setTimeout(async () => {
            setIsSaving(true);
            try {
                await onSave(nodes);
            } catch (err) {
                console.error("Auto-save failed", err);
            } finally {
                setIsSaving(false);
            }
        }, 3000); // 3 seconds debounce

        return () => clearTimeout(timer);
    }, [isDirty, nodes, onSave, isSaving, loading]);

    const toggleSection = (id: number) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const getRowStyle = (node: GGFijoNode) => {
        if (node.tipo_fila === 'seccion') return 'bg-sky-900/30 border-l-2 border-sky-500 font-bold';
        if (node.tipo_fila === 'grupo') return 'bg-slate-800/50 font-semibold';
        return 'hover:bg-slate-800/30';
    };

    const getIndent = (node: GGFijoNode) => {
        if (node.tipo_fila === 'seccion') return 'pl-3';
        if (node.tipo_fila === 'grupo') return 'pl-7';
        return 'pl-11';
    };

    const getTextColor = (node: GGFijoNode) => {
        if (node.tipo_fila === 'seccion') return 'text-sky-300';
        if (node.tipo_fila === 'grupo') return 'text-slate-200';
        return 'text-slate-300';
    };

    // Auto-calculate Sencico if it exists in nodes
    React.useEffect(() => {
        const sencicoIndex = nodes.findIndex(n => n.descripcion.toLowerCase().includes('sencico'));
        if (sencicoIndex !== -1 && totalBudget > 0) {
            const calculatedSencico = totalBudget * 0.002;
            if (nodes[sencicoIndex].costo_unitario !== calculatedSencico) {
                updateNode(sencicoIndex, 'costo_unitario', calculatedSencico);
            }
        }
    }, [totalBudget, nodes.length]);

    // Early return AFTER all hooks are declared (including useEffect)
    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900/50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
                    <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">Cargando G.G. Fijos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-slate-900" onClick={() => setContextMenu(null)}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-4 py-3">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
                        01) Gastos Generales Fijos
                    </h2>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-tight">
                        Fianzas · Seguros · Impuestos y tributos
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <PlazoDisplay variant="compact" color="sky" />
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Total G.G. Fijos</span>
                        <span className="font-mono text-sm font-bold text-sky-400">S/. {fmt(total)}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-md">
                        <tr>
                            <th className="border-b border-slate-700 p-2 w-24">ÍTEM</th>
                            <th className="border-b border-slate-700 p-2">DESCRIPCIÓN</th>
                            <th className="border-b border-slate-700 p-2 w-20 text-center">UNIDAD</th>
                            <th className="border-b border-slate-700 p-2 w-20 text-right">CANT</th>
                            <th className="border-b border-slate-700 p-2 w-28 text-right">COSTO UNIT.</th>
                            <th className="border-b border-slate-700 p-2 w-28 text-right bg-sky-950/40">PARCIAL</th>
                            <th className="border-b border-slate-700 p-2 w-10 text-center" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                        {nodes.map((node, index) => (
                            <tr
                                key={index}
                                className={`group transition-colors ${getRowStyle(node)}`}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, index });
                                }}
                            >
                                {/* ÍTEM */}
                                <td className={`p-1 ${getIndent(node)}`}>
                                    <div className="flex items-center gap-1">
                                        {node.tipo_fila !== 'detalle' && (
                                            <button
                                                onClick={() => node.id && toggleSection(node.id)}
                                                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                                            >
                                                {node.tipo_fila === 'seccion'
                                                    ? <ChevronDown className="h-3 w-3" />
                                                    : <ChevronRight className="h-3 w-3" />
                                                }
                                            </button>
                                        )}
                                        <input
                                            type="text"
                                            value={node.item_codigo ?? ''}
                                            onChange={e => updateNode(index, 'item_codigo', e.target.value)}
                                            className={`w-full border-none bg-transparent p-1 font-mono text-[11px] ${getTextColor(node)} focus:bg-slate-700/50 focus:outline-none rounded`}
                                            placeholder="01.01.00"
                                        />
                                    </div>
                                </td>

                                {/* DESCRIPCIÓN */}
                                <td className="p-1">
                                    <input
                                        type="text"
                                        value={node.descripcion ?? ''}
                                        onChange={e => updateNode(index, 'descripcion', e.target.value)}
                                        className={`w-full border-none bg-transparent p-1.5 ${getTextColor(node)} ${node.tipo_fila !== 'detalle' ? 'font-semibold uppercase text-[11px] tracking-wide' : 'text-[11px]'} focus:bg-slate-700/50 focus:outline-none rounded`}
                                        placeholder={node.tipo_fila === 'seccion' ? 'Nombre de sección...' : node.tipo_fila === 'grupo' ? 'Nombre de grupo...' : 'Descripción del ítem...'}
                                    />
                                </td>

                                {/* UNIDAD */}
                                <td className="p-1">
                                    {node.tipo_fila === 'detalle' ? (
                                        <input
                                            type="text"
                                            value={node.unidad ?? ''}
                                            onChange={e => updateNode(index, 'unidad', e.target.value)}
                                            className="w-full border-none bg-transparent p-1 text-center text-slate-400 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                        />
                                    ) : null}
                                </td>

                                {/* CANTIDAD */}
                                <td className="p-1">
                                    {node.tipo_fila === 'detalle' ? (
                                        <input
                                            type="number"
                                            value={node.cantidad ?? ''}
                                            onChange={e => updateNode(index, 'cantidad', parseFloat(e.target.value) || 0)}
                                            className="w-full border-none bg-transparent p-1 text-right font-mono text-slate-300 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                        />
                                    ) : null}
                                </td>

                                {/* COSTO UNIT */}
                                <td className="p-1">
                                    {node.tipo_fila === 'detalle' ? (
                                        <input
                                            type="number"
                                            value={node.costo_unitario ?? ''}
                                            onChange={e => updateNode(index, 'costo_unitario', parseFloat(e.target.value) || 0)}
                                            className="w-full border-none bg-transparent p-1 text-right font-mono text-sky-400/80 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                        />
                                    ) : null}
                                </td>

                                {/* PARCIAL */}
                                <td className="p-2 text-right font-mono font-semibold bg-sky-950/20">
                                    {node.tipo_fila === 'detalle' ? (
                                        <span className="text-slate-200 text-[11px]">{fmt(node.parcial)}</span>
                                    ) : node.tipo_fila === 'grupo' ? (
                                        <span className="text-sky-300/60 text-[10px] italic">sub</span>
                                    ) : (
                                        <span className="text-sky-400 text-xs font-bold">
                                            {/* Section total */}
                                            {fmt(
                                                nodes
                                                    .filter(n => n.tipo_fila === 'detalle')
                                                    .filter(n => {
                                                        const grupo = nodes.find(g => g.id === n.parent_id);
                                                        return grupo?.parent_id === node.id;
                                                    })
                                                    .reduce((sum, n) => sum + (Number(n.parcial) || 0), 0)
                                            )}
                                        </span>
                                    )}
                                </td>

                                {/* ACTIONS */}
                                <td className="p-1 text-center">
                                    <button
                                        onClick={() => removeNode(index)}
                                        className="rounded p-1.5 text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-900/20 hover:text-red-400"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {nodes.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-500 italic">
                                    No hay ítems. Haz clic derecho o usa los botones para añadir fianzas, seguros e impuestos.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-800/80 border-t-2 border-sky-800/50">
                            <td colSpan={5} className="p-3 text-right text-[10px] font-bold tracking-widest text-slate-300 uppercase">
                                TOTAL GASTOS FIJOS
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-sky-400 text-sm bg-sky-950/30">
                                S/. {fmt(total)}
                            </td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-700 bg-slate-800/40 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => addNode(nodes.length - 1, 'seccion')}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-900/30 px-3 py-1.5 text-[10px] font-bold text-sky-300 transition-all hover:bg-sky-900/50 hover:text-sky-200 border border-sky-800/40"
                    >
                        <Plus className="h-3.5 w-3.5" /> Sección
                    </button>
                    <button
                        onClick={() => addNode(nodes.length - 1, 'grupo')}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5 text-[10px] font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
                    >
                        <Plus className="h-3.5 w-3.5" /> Grupo
                    </button>
                    <button
                        onClick={() => addNode(nodes.length - 1, 'detalle')}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5 text-[10px] font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
                    >
                        <Plus className="h-3.5 w-3.5" /> Ítem
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    {isSaving ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-sky-400 uppercase">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Guardando...
                        </span>
                    ) : isDirty ? (
                        <span className="flex animate-pulse items-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-500 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Sincronizando...
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
                             <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Sincronizado
                        </span>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 min-w-[180px] rounded-lg border border-slate-700 bg-slate-800 py-1 text-xs text-slate-300 shadow-2xl"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">Añadir después</div>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-sky-900/30 hover:text-sky-300"
                            onClick={() => { addNode(contextMenu.index, 'seccion'); setContextMenu(null); }}
                        >
                            Nueva Sección (01.XX.00)
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-slate-200"
                            onClick={() => { addNode(contextMenu.index, 'grupo'); setContextMenu(null); }}
                        >
                            Nuevo Grupo
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-slate-200"
                            onClick={() => { addNode(contextMenu.index, 'detalle'); setContextMenu(null); }}
                        >
                            Nuevo Ítem (detalle)
                        </button>
                        <div className="my-1 border-t border-slate-700" />
                        <button
                            className="w-full px-4 py-1.5 text-left text-red-400 hover:bg-red-900/30"
                            onClick={() => { removeNode(contextMenu.index); setContextMenu(null); }}
                        >
                            Eliminar fila
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
