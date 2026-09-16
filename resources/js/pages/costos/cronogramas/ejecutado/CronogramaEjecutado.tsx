import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { nivelPartida } from '@/lib/partidaTree';
import CronogramaNavTabs from '../components/CronogramaNavTabs';
import { buildTreeItemsEjecutado } from './helpers/buildTreeItemsEjecutado';
import type { EjecutadoProps, ItemEjecutado } from './types';

interface ToastItem { id: number; text: string; type: 'success' | 'error' | 'info' }

const useToast = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const show = useCallback((text: string, type: ToastItem['type']) => {
        const id = ++counterRef.current;
        setToasts(p => [...p, { id, text, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    }, []);

    return { toasts, show };
};

const colorToast: Record<string, string> = {
    success: 'bg-emerald-900 border-emerald-600 text-emerald-100',
    error: 'bg-rose-900    border-rose-700    text-rose-100',
    info: 'bg-blue-900    border-blue-700    text-blue-100',
};

const fmtMonto = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nivel = nivelPartida;

type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export default function CronogramaEjecutado(props: EjecutadoProps) {
    const [items, setItems] = useState<ItemEjecutado[]>(props.items);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
    const { toasts, show: showToast } = useToast();

    const toggleCollapse = useCallback((code: string) => {
        setCollapsed(prev => {
            const n = new Set(prev);
            if (n.has(code)) n.delete(code); else n.add(code);
            return n;
        });
    }, []);

    const editarMetrado = useCallback((itemId: string, periodoKey: string, nuevoMetrado: number) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const metrado = Math.max(0, nuevoMetrado);
            const monto = Math.round(metrado * item.precio * 100) / 100;
            return {
                ...item,
                ejecucion: { ...item.ejecucion, [periodoKey]: { metrado, monto } },
            };
        }));
        // Se marca "pendiente" acá (en el handler del evento, no en el
        // efecto de abajo) para no disparar setState de forma sincrónica
        // dentro de un useEffect (cascading renders).
        setAutoSaveStatus('pending');
    }, []);

    const itemsFiltrados = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return items;
        return items.filter(i =>
            String(i.descripcion ?? '').toLowerCase().includes(q) ||
            String(i.item ?? '').toLowerCase().includes(q)
        );
    }, [items, searchTerm]);

    const treeItems = useMemo(
        () => buildTreeItemsEjecutado(itemsFiltrados, props.periodos, props.jerarquiaPresupuesto ?? {}),
        [itemsFiltrados, props.periodos, props.jerarquiaPresupuesto]
    );

    const childCodes = useMemo(() => {
        const set = new Set<string>();
        treeItems.forEach(item => {
            const parts = item.item.split('.');
            for (let i = 1; i < parts.length; i++) {
                set.add(parts.slice(0, i).join('.'));
            }
        });
        return set;
    }, [treeItems]);

    const visibleItems = useMemo(
        () => treeItems.filter(item => {
            const code = item.item || '';
            for (const col of collapsed) {
                if (code.startsWith(`${col}.`)) return false;
            }
            return true;
        }),
        [treeItems, collapsed]
    );

    const totalesPorPeriodo = useMemo(() => {
        const totales: Record<string, number> = {};
        let acumulado = 0;
        props.periodos.forEach(p => {
            const monto = items.reduce((acc, it) => acc + (it.ejecucion[p.key]?.monto ?? 0), 0);
            acumulado += monto;
            totales[p.key] = acumulado;
        });
        return totales;
    }, [items, props.periodos]);

    const totalEjecutado = useMemo(
        () => items.reduce(
            (acc, it) => acc + props.periodos.reduce((s, p) => s + (it.ejecucion[p.key]?.monto ?? 0), 0),
            0
        ),
        [items, props.periodos]
    );

    const persistirEjecucion = useCallback(async (itemsAGuardar: ItemEjecutado[]) => {
        return axios.post('/module/crono_ejecutado/save', {
            project_id: props.project,
            items: itemsAGuardar.map(i => ({
                item: i.item,
                descripcion: i.descripcion,
                metradoContratado: i.metradoContratado,
                precio: i.precio,
                ejecucion: Object.fromEntries(
                    props.periodos.map(p => [p.key, i.ejecucion[p.key] ?? { metrado: 0, monto: 0 }])
                ),
            })),
        });
    }, [props.project, props.periodos]);

    const handleSave = useCallback(async () => {
        if (!items.length) { showToast('⚠ No hay partidas para guardar.', 'info'); return; }
        setSaving(true);
        try {
            await persistirEjecucion(items);
            setAutoSaveStatus('saved');
            showToast('✅ Avance real guardado correctamente.', 'success');
        } catch (err: any) {
            setAutoSaveStatus('error');
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [items, persistirEjecucion, showToast]);

    // Auto-guardado con debounce — con miles de celdas, obligar a acordarse
    // de tocar "Guardar" antes de cambiar de pestaña pierde trabajo real
    // (reportado: se navega a Control Avance y al volver el metrado tecleado
    // ya no está). Espera una pausa de 1.5s sin cambios y guarda solo; no
    // bloquea la edición mientras tanto. Se salta el primer render (el
    // estado que ya llegó del servidor no necesita re-guardarse). El timer
    // vive en un ref para poder cancelarlo y disparar el guardado de
    // inmediato si el usuario navega ANTES de que venza el debounce (ver
    // flushPendingSave, usado por CronogramaNavTabs.onBeforeNavigate).
    const primerRender = useRef(true);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (primerRender.current) { primerRender.current = false; return; }
        if (!items.length) return;

        debounceTimerRef.current = setTimeout(async () => {
            debounceTimerRef.current = null;
            setAutoSaveStatus('saving');
            try {
                await persistirEjecucion(items);
                setAutoSaveStatus('saved');
            } catch {
                setAutoSaveStatus('error');
            }
        }, 1500);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [items, persistirEjecucion]);

    const flushPendingSave = useCallback(async () => {
        if (!debounceTimerRef.current) return;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        setAutoSaveStatus('saving');
        try {
            await persistirEjecucion(items);
            setAutoSaveStatus('saved');
        } catch {
            setAutoSaveStatus('error');
        }
    }, [items, persistirEjecucion]);

    // Última red de seguridad: breadcrumbs, botón atrás del navegador o
    // cerrar la pestaña no pasan por CronogramaNavTabs.onBeforeNavigate —
    // esto al menos avisa (mensaje genérico del navegador) si hay un
    // guardado pendiente/en curso cuando se intenta salir.
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (autoSaveStatus === 'pending' || autoSaveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [autoSaveStatus]);

    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Avance Real (Ejecutado)', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Avance Real — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                {!props.sinGantt && (
                    <CronogramaNavTabs
                        project={props.project}
                        modoCalculo={props.modoCalculo}
                        active="ejecutado"
                        estado={props.estado}
                        onBeforeNavigate={flushPendingSave}
                    />
                )}
                <div className="max-w-[1900px] mx-auto">

                    {props.sinGantt && (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-amber-200 p-16 text-center">
                            <span className="text-6xl">📋</span>
                            <h2 className="mt-4 text-lg font-black text-slate-700">Cronograma General no encontrado</h2>
                            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                                Primero debe guardar el Cronograma General (Gantt) con las fechas de inicio y fin de cada partida.
                            </p>
                        </div>
                    )}

                    {!props.sinGantt && (
                        <>
                            <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-sm">
                                <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
                                    <span className="px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
                                        🏗️ Avance Real Ejecutado
                                    </span>
                                    <span className="text-slate-500">
                                        Metrado realmente ejecutado en campo, por partida y periodo — independiente del programado.
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold">
                                        {autoSaveStatus === 'pending' && <span className="text-slate-400">● cambios sin guardar…</span>}
                                        {autoSaveStatus === 'saving' && <span className="text-blue-500">⏳ guardando automáticamente…</span>}
                                        {autoSaveStatus === 'saved' && <span className="text-emerald-600">✓ guardado automáticamente</span>}
                                        {autoSaveStatus === 'error' && <span className="text-rose-600">⚠ error al auto-guardar, usa "Guardar"</span>}
                                    </span>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-4 py-1.5 text-xs font-black rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all disabled:opacity-50"
                                    >
                                        {saving ? 'Guardando…' : 'Guardar avance real'}
                                    </button>
                                </div>
                            </div>

                            <div className="mb-4 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar partida..."
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white shadow-sm focus:border-emerald-400 focus:outline-none"
                                />
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                                <table className="min-w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                            <th className="px-3 py-2 text-left sticky left-0 bg-slate-100 z-10">Item</th>
                                            <th className="px-3 py-2 text-left min-w-[220px]">Descripción</th>
                                            <th className="px-2 py-2 text-center">Und</th>
                                            <th className="px-2 py-2 text-right">Metrado Contratado</th>
                                            {props.periodos.map(p => (
                                                <th key={p.key} className="px-2 py-2 text-center min-w-[110px]">
                                                    <div>{p.label}</div>
                                                    <div className="text-[10px] font-normal normal-case text-slate-400">{p.labelCal}</div>
                                                </th>
                                            ))}
                                            <th className="px-2 py-2 text-right">Total Ejecutado (S/.)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleItems.map(item => {
                                            const n = nivel(item.item);
                                            const isLeaf = !childCodes.has(item.item);
                                            const isCollapsed = collapsed.has(item.item);
                                            const totalItem = props.periodos.reduce(
                                                (acc, p) => acc + (item.ejecucion[p.key]?.monto ?? 0), 0
                                            );
                                            const metradoEjecAcum = props.periodos.reduce(
                                                (acc, p) => acc + (item.ejecucion[p.key]?.metrado ?? 0), 0
                                            );
                                            const sobreejecutado = isLeaf && metradoEjecAcum > item.metradoContratado + 0.0001;
                                            const rowBg = !isLeaf
                                                ? (n === 0 ? 'bg-slate-800 text-white' : n === 1 ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-800')
                                                : '';

                                            return (
                                                <tr key={item.id} className={`border-t border-slate-100 ${rowBg} ${isLeaf ? 'hover:bg-slate-50' : ''}`}>
                                                    <td
                                                        className={`px-3 py-1.5 font-semibold sticky left-0 z-10 ${rowBg || 'bg-white text-slate-700'}`}
                                                        style={{ paddingLeft: `${8 + n * 18}px` }}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            {!isLeaf ? (
                                                                <button
                                                                    onClick={() => toggleCollapse(item.item)}
                                                                    className="shrink-0 opacity-70 hover:opacity-100"
                                                                    title={isCollapsed ? 'Expandir' : 'Colapsar'}
                                                                >
                                                                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                                </button>
                                                            ) : (
                                                                <span className="w-[13px] shrink-0" />
                                                            )}
                                                            {item.item}
                                                        </div>
                                                    </td>
                                                    <td className={`px-3 py-1.5 ${isLeaf ? 'italic text-slate-600' : `font-bold ${n <= 1 ? '' : 'text-slate-800'}`}`}>{item.descripcion}</td>
                                                    <td className="px-2 py-1.5 text-center text-slate-500">{item.und}</td>
                                                    <td className={`px-2 py-1.5 text-right font-mono ${sobreejecutado ? 'text-rose-600 font-bold' : ''}`}>
                                                        {isLeaf ? item.metradoContratado.toLocaleString('es-PE', { maximumFractionDigits: 4 }) : ''}
                                                    </td>
                                                    {props.periodos.map(p => {
                                                        const cell = item.ejecucion[p.key] ?? { metrado: 0, monto: 0 };
                                                        return (
                                                            <td key={p.key} className="px-1.5 py-1 text-center">
                                                                {isLeaf ? (
                                                                    <>
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            step="0.0001"
                                                                            value={cell.metrado || ''}
                                                                            onChange={e => editarMetrado(item.id, p.key, parseFloat(e.target.value) || 0)}
                                                                            className="w-20 px-1 py-1 text-right text-xs font-mono border border-slate-200 rounded bg-white text-slate-900 focus:border-emerald-400 focus:outline-none"
                                                                            placeholder="0"
                                                                        />
                                                                        <div className="text-[10px] text-slate-400 mt-0.5">S/. {fmtMonto(cell.monto)}</div>
                                                                    </>
                                                                ) : (
                                                                    cell.monto > 0 && <div className="text-[11px] font-mono font-semibold">S/. {fmtMonto(cell.monto)}</div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={`px-2 py-1.5 text-right font-mono font-bold ${isLeaf ? 'text-emerald-700' : ''}`}>
                                                        {fmtMonto(totalItem)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-700">
                                            <td className="px-3 py-2 sticky left-0 bg-slate-50 z-10" colSpan={4}>TOTAL ACUMULADO EJECUTADO</td>
                                            {props.periodos.map(p => (
                                                <td key={p.key} className="px-2 py-2 text-center font-mono text-[11px]">
                                                    S/. {fmtMonto(totalesPorPeriodo[p.key] ?? 0)}
                                                    <div className="text-[10px] font-normal text-slate-400">
                                                        {props.totalPresupuesto > 0
                                                            ? `${((totalesPorPeriodo[p.key] ?? 0) / props.totalPresupuesto * 100).toFixed(2)}%`
                                                            : '—'}
                                                    </div>
                                                </td>
                                            ))}
                                            <td className="px-2 py-2 text-right font-mono text-emerald-700">
                                                {fmtMonto(totalEjecutado)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl ${colorToast[t.type] || colorToast.info}`}
                    >
                        {t.text}
                    </div>
                ))}
            </div>
        </AppLayout>
    );
}
