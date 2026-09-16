import { Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

interface AdelantosProps {
    project:             string;
    projectName:         string;
    modoCalculo:         'calendario' | '30dias';
    adelantoDirecto:     number;
    adelantoMateriales:  number;
    montoContrato:       number;
    sinMontoContrato:    boolean;
    estado?:             CronogramaEstado;
}

type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface ToastItem { id: number; text: string; type: 'success' | 'error' }

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function Adelantos(props: AdelantosProps) {
    const [adelantoDirecto, setAdelantoDirecto] = useState(props.adelantoDirecto);
    const [adelantoMateriales, setAdelantoMateriales] = useState(props.adelantoMateriales);
    const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const showToast = useCallback((text: string, type: ToastItem['type']) => {
        const id = ++counterRef.current;
        setToasts(p => [...p, { id, text, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    }, []);

    const persistir = useCallback(async (directo: number, materiales: number) => {
        return axios.post('/module/adelantos/save', {
            project_id: props.project,
            adelanto_directo: directo,
            adelanto_materiales: materiales,
        });
    }, [props.project]);

    const primerRender = useRef(true);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (primerRender.current) { primerRender.current = false; return; }

        debounceTimerRef.current = setTimeout(async () => {
            debounceTimerRef.current = null;
            setAutoSaveStatus('saving');
            try {
                await persistir(adelantoDirecto, adelantoMateriales);
                setAutoSaveStatus('saved');
            } catch {
                setAutoSaveStatus('error');
            }
        }, 1200);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [adelantoDirecto, adelantoMateriales, persistir]);

    const flushPendingSave = useCallback(async () => {
        if (!debounceTimerRef.current) return;
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        setAutoSaveStatus('saving');
        try {
            await persistir(adelantoDirecto, adelantoMateriales);
            setAutoSaveStatus('saved');
        } catch {
            setAutoSaveStatus('error');
        }
    }, [adelantoDirecto, adelantoMateriales, persistir]);

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

    const handleGuardar = useCallback(async () => {
        setAutoSaveStatus('saving');
        try {
            await persistir(adelantoDirecto, adelantoMateriales);
            setAutoSaveStatus('saved');
            showToast('✅ Adelantos guardados correctamente.', 'success');
        } catch (err: any) {
            setAutoSaveStatus('error');
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        }
    }, [adelantoDirecto, adelantoMateriales, persistir, showToast]);

    const totalAdelantos = adelantoDirecto + adelantoMateriales;
    const pctSobreContrato = props.montoContrato > 0 ? (totalAdelantos / props.montoContrato) * 100 : 0;

    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Adelantos', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Adelantos — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs
                        project={props.project}
                        modoCalculo={props.modoCalculo}
                        active="adelantos"
                        estado={props.estado}
                        onBeforeNavigate={flushPendingSave}
                    />
                <div className="max-w-[900px] mx-auto">

                    <div className="mb-4 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">Adelanto Directo y de Materiales</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Montos entregados al inicio del contrato — base para las amortizaciones en el control de pagos.
                        </p>
                    </div>

                    {props.sinMontoContrato && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                            ⚠ Aún no se guardó el <strong>Monto del Contrato</strong> — el % sobre contrato saldrá en cero hasta que guardes Valorizado.
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                                    Adelanto Directo (S/.)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={adelantoDirecto || ''}
                                    onChange={e => setAdelantoDirecto(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2.5 text-lg font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                                    Adelanto de Materiales (S/.)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={adelantoMateriales || ''}
                                    onChange={e => setAdelantoMateriales(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2.5 text-lg font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-400 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Adelantos</div>
                                <div className="text-xl font-black text-slate-700 mt-1">S/. {fmt(totalAdelantos)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">% sobre Monto de Contrato</div>
                                <div className="text-xl font-black text-slate-700 mt-1">{fmtPct(pctSobreContrato)}</div>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <span className="text-[11px] font-semibold">
                                {autoSaveStatus === 'pending' && <span className="text-slate-400">● cambios sin guardar…</span>}
                                {autoSaveStatus === 'saving' && <span className="text-blue-500">⏳ guardando automáticamente…</span>}
                                {autoSaveStatus === 'saved' && <span className="text-emerald-600">✓ guardado automáticamente</span>}
                                {autoSaveStatus === 'error' && <span className="text-rose-600">⚠ error al auto-guardar, usa "Guardar"</span>}
                            </span>
                            <button
                                onClick={handleGuardar}
                                disabled={autoSaveStatus === 'saving'}
                                className="px-4 py-1.5 text-xs font-black rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all disabled:opacity-50"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl ${
                            t.type === 'success'
                                ? 'bg-emerald-900 border-emerald-600 text-emerald-100'
                                : 'bg-rose-900 border-rose-700 text-rose-100'
                        }`}
                    >
                        {t.text}
                    </div>
                ))}
            </div>
        </AppLayout>
    );
}
