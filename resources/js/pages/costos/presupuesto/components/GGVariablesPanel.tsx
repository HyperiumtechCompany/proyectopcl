import { Loader2, Plus, Trash2, Save, RefreshCw, Users, Link2, CheckCircle2, Clock, LayoutTemplate, Zap } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import type { GGVariableNode } from '../stores/ggVariablesStore';
import { useGGVariablesStore } from '../stores/ggVariablesStore';
import { useProjectParamsStore } from '../stores/projectParamsStore';
import { useRemuneracionesStore } from '../stores/remuneracionesStore';
import { GGVARIABLES_TEMPLATES } from '../utils/ggTemplates';
import { PlazoDisplay } from './PlazoDisplay';

interface GGVariablesPanelProps {
    loading: boolean;
    nodes: GGVariableNode[];
    onSave: (data: GGVariableNode[]) => Promise<any>;
    projectId: number;
}

const fmt = (n: number) => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function GGVariablesPanel({ loading, nodes, onSave, projectId }: GGVariablesPanelProps) {
    const { updateNode, addNode, removeNode, getTotal, isDirty, setNodes, setDirty, syncFromRemuneraciones, addPersonalWithBenefits } = useGGVariablesStore();
    const remuneracionesRows = useRemuneracionesStore(state => state.rows);
    const remLoading = useRemuneracionesStore(state => state.loading);
    const duracionMeses = useProjectParamsStore(s => s.getDuracionMeses());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{ type: 'synced' | 'pending' | 'manual'; message: string } | null>(null);
    const checkAndSyncRemuneraciones = useGGVariablesStore(s => s.checkAndSyncRemuneraciones);

    // Verificar si hay datos de remuneraciones vinculados
    const hasRemuneracionesLinked = nodes.some(n => n._fromRemuneraciones);

    // Sincronización automática cuando cambian las remuneraciones
    const handleAutoSync = useCallback(() => {
        if (remuneracionesRows.length > 0 && !loading) {
            syncFromRemuneraciones(remuneracionesRows, duracionMeses);
            setSyncStatus({ 
                type: 'synced', 
                message: `✓ Sincronizado automáticamente con ${remuneracionesRows.length} personal(es)` 
            });
            setTimeout(() => setSyncStatus(null), 3000);
        }
    }, [remuneracionesRows, duracionMeses, loading, syncFromRemuneraciones]);

    // Efecto para detectar cambios en remuneraciones y sincronizar automáticamente
    useEffect(() => {
        if (!loading && remuneracionesRows.length > 0) {
            const synced = checkAndSyncRemuneraciones();
            if (synced) {
                setSyncStatus({ 
                    type: 'synced', 
                    message: `✓ Sincronizado: ${remuneracionesRows.length} personal(es) y beneficios actualizados.` 
                });
                setTimeout(() => setSyncStatus(null), 3500);
            }
        }
    }, [remuneracionesRows, loading, checkAndSyncRemuneraciones]);

    // Early return BEFORE any other hooks or callbacks that depend on loading
    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900/50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                    <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">Cargando G.G. Variables...</span>
                </div>
            </div>
        );
    }

    // Sincronización manual (botón)
    const handleManualSync = () => {
        if (remuneracionesRows.length === 0) {
            setSyncStatus({ type: 'manual', message: '⚠️ No hay remuneraciones para sincronizar' });
            setTimeout(() => setSyncStatus(null), 3000);
            return;
        }
        handleAutoSync();
    };

    // Sincronizar duración (meses)
    const handleSyncDuration = () => {
        if (duracionMeses <= 0) {
            setSyncStatus({ type: 'manual', message: '⚠️ No se puede sincronizar: el proyecto no tiene fechas configuradas.' });
            setTimeout(() => setSyncStatus(null), 5000);
            return;
        }

        const newNodes = nodes.map(node => {
            if (node.tipo_fila === 'detalle' && node.unidad?.toLowerCase().includes('mes')) {
                const cantidad_tiempo = duracionMeses;
                const parcial = (node.cantidad_descripcion || 0) * cantidad_tiempo * ((node.participacion || 100) / 100) * (node.precio || 0);
                return { ...node, cantidad_tiempo, parcial };
            }
            return node;
        });

        setNodes(newNodes);
        setDirty(true);
        setSyncStatus({ type: 'synced', message: `✓ ${newNodes.filter(n => n.tipo_fila === 'detalle' && n.unidad?.toLowerCase().includes('mes')).length} ítems sincronizados a ${duracionMeses} meses` });
        setTimeout(() => setSyncStatus(null), 4000);
    };

    const total = getTotal();

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(nodes);
        } finally {
            setIsSaving(false);
        }
    };

    const getRowStyle = (node: GGVariableNode) => {
        if (node.tipo_fila === 'seccion') return 'bg-amber-900/20 border-l-2 border-amber-500 font-bold';
        if (node.tipo_fila === 'grupo') return 'bg-slate-800/50 font-semibold';
        return node._fromRemuneraciones ? 'bg-emerald-950/10 hover:bg-emerald-950/20' : 'hover:bg-slate-800/30';
    };

    const getIndent = (node: GGVariableNode) => {
        if (node.tipo_fila === 'seccion') return 'pl-3';
        if (node.tipo_fila === 'grupo') return 'pl-7';
        return 'pl-11';
    };

    const getTextColor = (node: GGVariableNode) => {
        if (node.tipo_fila === 'seccion') return 'text-amber-300';
        if (node.tipo_fila === 'grupo') return 'text-slate-200';
        return node._fromRemuneraciones ? 'text-emerald-300' : 'text-slate-300';
    };

    return (
        <div className="flex h-full flex-col bg-slate-900" onClick={() => setContextMenu(null)}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-4 py-3">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                        02) Gastos Generales Variables
                    </h2>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-tight">
                        Administración · Equipamiento · Alquileres · Vehículos
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <PlazoDisplay variant="compact" color="amber" />

                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Total G.G. Variables</span>
                        <span className="font-mono text-sm font-bold text-amber-400">S/. {fmt(total)}</span>
                    </div>
                </div>
            </div>

            {/* Sync Status */}
            {syncStatus && (
                <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs ${
                    syncStatus.type === 'synced' 
                        ? 'border-emerald-800/40 bg-emerald-950/30 text-emerald-300'
                        : syncStatus.type === 'pending'
                        ? 'border-amber-800/40 bg-amber-950/30 text-amber-300'
                        : 'border-red-800/40 bg-red-950/30 text-red-300'
                }`}>
                    {syncStatus.type === 'synced' ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    <span>{syncStatus.message}</span>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="min-w-[1100px]">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-md">
                            <tr>
                                <th className="border-b border-slate-700 p-2 w-24">ÍTEM</th>
                                <th className="border-b border-slate-700 p-2">DESCRIPCIÓN</th>
                                <th className="border-b border-slate-700 p-2 w-16 text-center">UNID.</th>
                                <th className="border-b border-slate-700 p-2 w-20 text-right">CANT. DESC.</th>
                                <th className="border-b border-slate-700 p-2 w-20 text-right">CANT. (N°)</th>
                                <th className="border-b border-slate-700 p-2 w-20 text-right">PARTIC. %</th>
                                <th className="border-b border-slate-700 p-2 w-28 text-right">PRECIO</th>
                                <th className="border-b border-slate-700 p-2 w-28 text-right bg-amber-950/40">PARCIAL</th>
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
                                        <input
                                            type="text"
                                            value={node.item_codigo ?? ''}
                                            onChange={e => updateNode(index, 'item_codigo', e.target.value)}
                                            className={`w-full border-none bg-transparent p-1 font-mono text-[11px] ${getTextColor(node)} focus:bg-slate-700/50 focus:outline-none rounded`}
                                            placeholder={node.tipo_fila === 'seccion' ? '02.01.00' : ''}
                                        />
                                    </td>

                                    {/* DESCRIPCIÓN */}
                                    <td className="p-1">
                                        <div className="flex items-center gap-1">
                                            {node._fromRemuneraciones && (
                                                <Users className="h-3 w-3 text-emerald-500/60 shrink-0" />
                                            )}
                                            <input
                                                type="text"
                                                value={node.descripcion ?? ''}
                                                onChange={e => updateNode(index, 'descripcion', e.target.value)}
                                                readOnly={node._fromRemuneraciones}
                                                className={`w-full border-none bg-transparent p-1.5 ${getTextColor(node)} ${node.tipo_fila !== 'detalle' || node._fromRemuneraciones ? 'font-semibold text-[11px] tracking-wide uppercase' : 'text-[11px]'} focus:bg-slate-700/50 focus:outline-none rounded ${node._fromRemuneraciones ? 'cursor-default' : ''}`}
                                            />
                                        </div>
                                    </td>

                                    {/* UNIDAD */}
                                    <td className="p-1">
                                        {node.tipo_fila === 'detalle' ? (
                                            <input
                                                type="text"
                                                value={node.unidad ?? ''}
                                                onChange={e => updateNode(index, 'unidad', e.target.value)}
                                                readOnly={node._fromRemuneraciones}
                                                className="w-full border-none bg-transparent p-1 text-center text-slate-400 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                            />
                                        ) : node.tipo_fila === 'grupo' && node._fromRemuneraciones && node.descripcion.includes('Beneficios') ? (
                                            <div className="text-center text-sky-400 font-bold text-[10px]">
                                                {(node.cantidad_tiempo ?? 0).toFixed(2)}%
                                            </div>
                                        ) : null}
                                    </td>

                                    {/* CANT DESC */}
                                    <td className="p-1">
                                        {node.tipo_fila === 'detalle' && (
                                            <input
                                                type="number"
                                                value={node.cantidad_descripcion ?? ''}
                                                onChange={e => updateNode(index, 'cantidad_descripcion', parseFloat(e.target.value) || 0)}
                                                readOnly={node._fromRemuneraciones}
                                                className="w-full border-none bg-transparent p-1 text-right font-mono text-slate-300 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                            />
                                        )}
                                    </td>

                                    {/* CANT TIEMPO */}
                                    <td className="p-1">
                                        {node.tipo_fila === 'detalle' && (
                                            <input
                                                type="number"
                                                value={node.cantidad_tiempo ?? ''}
                                                onChange={e => updateNode(index, 'cantidad_tiempo', parseFloat(e.target.value) || 0)}
                                                readOnly={node._fromRemuneraciones}
                                                className="w-full border-none bg-transparent p-1 text-right font-mono text-slate-300 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                            />
                                        )}
                                    </td>

                                    {/* PARTICIPACIÓN */}
                                    <td className="p-1">
                                        {node.tipo_fila === 'detalle' && (
                                            <div className="flex items-center">
                                                <input
                                                    type="number"
                                                    value={node.participacion ?? ''}
                                                    onChange={e => updateNode(index, 'participacion', parseFloat(e.target.value) || 0)}
                                                    readOnly={node._fromRemuneraciones}
                                                    className="w-full border-none bg-transparent p-1 text-right font-mono text-slate-300 focus:bg-slate-700/50 focus:outline-none rounded text-[11px]"
                                                />
                                                <span className="text-slate-500 text-[10px] pr-1">%</span>
                                            </div>
                                        )}
                                    </td>

                                    {/* PRECIO */}
                                    <td className="p-1">
                                        {node.tipo_fila === 'detalle' && (
                                            <input
                                                type="number"
                                                value={node.precio ?? ''}
                                                onChange={e => updateNode(index, 'precio', parseFloat(e.target.value) || 0)}
                                                readOnly={node._fromRemuneraciones}
                                                className={`w-full border-none bg-transparent p-1 text-right font-mono focus:bg-slate-700/50 focus:outline-none rounded text-[11px] ${node._fromRemuneraciones ? 'text-emerald-400/80' : 'text-amber-400/80'}`}
                                            />
                                        )}
                                    </td>

                                    {/* PARCIAL */}
                                    <td className="p-2 text-right font-mono font-semibold bg-amber-950/10">
                                        {node.tipo_fila === 'detalle' ? (
                                            <span className={`text-[11px] ${node._fromRemuneraciones ? 'text-emerald-300' : 'text-slate-200'}`}>
                                                S/. {fmt(node.parcial)}
                                            </span>
                                        ) : node.tipo_fila === 'seccion' ? (
                                            <span className="text-amber-400 text-xs font-bold">
                                                S/. {fmt(
                                                    nodes
                                                        .filter(n => n.tipo_fila === 'detalle')
                                                        .filter(n => {
                                                            const grupo = nodes.find(g => g.id === n.parent_id);
                                                            const isDirectChild = n.parent_id === node.id && node.id !== undefined;
                                                            const isGrandChild = grupo?.parent_id === node.id && node.id !== undefined;
                                                            return isDirectChild || isGrandChild;
                                                        })
                                                        .reduce((sum, n) => sum + (Number(n.parcial) || 0), 0)
                                                )}
                                            </span>
                                        ) : null}
                                    </td>

                                    {/* ACTIONS */}
                                    <td className="p-1 text-center">
                                        {!node._fromRemuneraciones && (
                                            <button
                                                onClick={() => removeNode(index)}
                                                className="rounded p-1.5 text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-900/20 hover:text-red-400"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {nodes.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-500 italic">
                                        No hay ítems. Usa los botones para añadir conceptos.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-800/80 border-t-2 border-amber-800/50">
                                <td colSpan={7} className="p-3 text-right text-[10px] font-bold tracking-widest text-slate-300 uppercase">
                                    TOTAL GASTOS VARIABLES
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-amber-400 text-sm bg-amber-950/30">
                                    S/. {fmt(total)}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-700 bg-slate-800/40 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => addNode(nodes.length - 1, 'seccion')}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-900/30 px-3 py-1.5 text-[10px] font-bold text-amber-300 transition-all hover:bg-amber-900/50 border border-amber-800/40"
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
                    <div className="w-px h-5 bg-slate-700" />
                    {/* Botón de sincronización automática - ahora es un indicador */}
                    <button
                        onClick={handleManualSync}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all border ${
                            hasRemuneracionesLinked 
                                ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/50'
                                : 'bg-slate-700/50 text-slate-400 border-slate-600/40 hover:bg-slate-700'
                        }`}
                        title="Sincronizar automáticamente desde Remuneraciones"
                    >
                        <Link2 className="h-3.5 w-3.5" />
                        {hasRemuneracionesLinked ? 'Vinculado' : 'Vincular'}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="flex items-center gap-1.5 rounded-lg bg-sky-900/40 px-3 py-1.5 text-[10px] font-bold text-sky-200 transition-all hover:bg-sky-900/60 border border-sky-800/40 shadow-lg"
                        >
                            <LayoutTemplate className="h-3.5 w-3.5" /> Estructura Sugerida
                        </button>
                        
                        {showTemplates && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)} />
                                <div className="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                                    <div className="px-3 py-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-2">
                                        <Zap className="w-3 h-3 text-amber-500" /> Carga Rápida de Datos
                                    </div>
                                    <div className="grid gap-1">
                                        {Object.entries(GGVARIABLES_TEMPLATES).map(([key, t]) => (
                                            <button
                                                key={key}
                                                className="w-full text-left p-3 rounded-lg hover:bg-slate-700/50 transition-colors group border border-transparent hover:border-slate-600/50"
                                                onClick={() => {
                                                    useGGVariablesStore.getState().applyTemplate(t.nodes as any);
                                                    setShowTemplates(false);
                                                }}
                                            >
                                                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400">{t.label}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{t.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isDirty && (
                        <span className="flex animate-pulse items-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-500 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Cambios pendientes
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className={`flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold text-white shadow-lg transition-all ${isDirty
                                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20 active:scale-95'
                                : 'bg-slate-700 cursor-not-allowed opacity-60'
                            }`}
                    >
                        <Save className="h-3.5 w-3.5" />
                        {isSaving ? 'Guardando...' : 'Guardar G.G. Variables'}
                    </button>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 min-w-[200px] rounded-lg border border-slate-700 bg-slate-800 py-1 text-xs text-slate-300 shadow-2xl"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">Añadir después</div>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-amber-900/30 hover:text-amber-300"
                            onClick={() => { addNode(contextMenu.index, 'seccion'); setContextMenu(null); }}
                        >
                            Nueva Sección (02.XX.00)
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-slate-200"
                            onClick={() => { addNode(contextMenu.index, 'grupo'); setContextMenu(null); }}
                        >
                            Nuevo Grupo
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-slate-200 flex items-center gap-2"
                            onClick={() => { addNode(contextMenu.index, 'detalle'); setContextMenu(null); }}
                        >
                            Nuevo Ítem (detalle)
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-emerald-900/30 hover:text-emerald-300 flex items-center gap-2"
                            onClick={() => { addPersonalWithBenefits(contextMenu.index); setContextMenu(null); }}
                        >
                            <Users className="w-3.5 h-3.5" /> Personal (+ Beneficios)
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
