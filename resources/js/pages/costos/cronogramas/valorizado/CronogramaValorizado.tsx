import { Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import AppLayout from '@/layouts/app-layout';
import HeaderValorizado from './components/HeaderValorizado';
import ResumenFinanciero from './components/ResumenFinanciero';
import TablaValorizada from './components/TablaValorizada';
import { exportarExcel, exportarPDF } from './helpers/exportHelpers'; 
import { useValorizadoLogic } from './helpers/useValorizadoLogic';
import type { ValorizadoProps, ModoCalculo } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
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
    error:   'bg-rose-900    border-rose-700    text-rose-100',
    info:    'bg-blue-900    border-blue-700    text-blue-100',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CronogramaValorizado(props: ValorizadoProps) {
    const [saving,         setSaving]         = useState(false);
    const [deleting,       setDeleting]       = useState(false);
    const [estaGuardadoUI, setEstaGuardadoUI] = useState(props.estaGuardado ?? false);
    const [modoCalculo,    setModoCalculo]    = useState<ModoCalculo>(props.modoCalculo ?? 'calendario');

    const { toasts, show: showToast } = useToast();

    const {
        viewMode, setViewMode,
        searchTerm, setSearchTerm,
        items,
        editarCelda, redistribuirItem, redistribuirGaussItem, limpiarDistribucion,
        itemsFiltrados,
        totalesFinales,
        totalesPorItem,
        totalGeneralPeriodos,
        curvaSData,
        montoAcumuladoTotal,
        desviaciones,
        totalDesviadas,
        isPeriodoBloqueado,
    } = useValorizadoLogic(props.items, props.periodos, props.totalPresupuesto, modoCalculo);

    // ── GUARDAR ───────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!items.length) { showToast('⚠ No hay partidas para guardar.', 'info'); return; }
        if (!confirm(`¿Guardar el valorizado de ${items.length} partidas?`)) return;

        setSaving(true);
        try {
            await axios.post('/module/crono_valorizado/save', {
                project_id: props.project,
                modo_calculo: modoCalculo,
                items: items.map(i => ({
                    item:        i.item,
                    descripcion: i.descripcion,
                    parcial:     i.parcial,
                    distribucion: Object.fromEntries(
                        props.periodos.map(periodo => [
                            periodo.key,
                            i.distribucion?.[periodo.key] ?? { monto: 0, porcentaje: 0 },
                        ])
                    ),
                    parent_id:   i.parent_id ?? null,
                })),
            });
            setEstaGuardadoUI(true);
            showToast('✅ Cronograma valorizado guardado correctamente.', 'success');
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [props.project, props.periodos, modoCalculo, items, showToast]);

    // ── ELIMINAR ──────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        if (!confirm('¿Eliminar el valorizado guardado?\nSe recalculará desde el Gantt.')) return;
        setDeleting(true);
        try {
            await axios.delete(`/cronograma/valorizado/destroy?project=${props.project}`);
            setEstaGuardadoUI(false);
            showToast('🗑 Valorizado eliminado. Recargando…', 'info');
            setTimeout(() => window.location.reload(), 1200);
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setDeleting(false);
        }
    }, [props.project, showToast]);

    // ── TOGGLE MODO CÁLCULO ───────────────────────────────────────────────────
    const handleToggleModo = useCallback(() => {
        const nuevoModo: ModoCalculo = modoCalculo === 'calendario' ? '30dias' : 'calendario';
        setModoCalculo(nuevoModo);
        const url = new URL(window.location.href);
        url.searchParams.set('modo', nuevoModo);
        window.location.href = url.toString();
    }, [modoCalculo]);

    // ── EXPORTACIONES (usando las nuevas funciones) ──────────────────────────
    const handleExportExcel = useCallback(() => {
        exportarExcel(itemsFiltrados, props.periodos, totalesFinales, props.projectName, viewMode, totalesPorItem);
    }, [itemsFiltrados, props.periodos, totalesFinales, props.projectName, viewMode, totalesPorItem]);

    const handleExportPDF = useCallback(() => {
        exportarPDF(itemsFiltrados, props.periodos, totalesFinales, props.projectName, totalesPorItem);
    }, [itemsFiltrados, props.periodos, totalesFinales, props.projectName, totalesPorItem]);

    // ── MES PICO ──────────────────────────────────────────────────────────────
    const mesPicoKey = React.useMemo(() => {
        let max = 0; let key = '';
        Object.entries(totalesFinales).forEach(([k, v]) => {
            if (v.monto > max) { max = v.monto; key = k; }
        });
        return key;
    }, [totalesFinales]);

    const breadcrumbs = [
        { title: 'Costos',      href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Cronograma Valorizado', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Valorizado — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
                <div className="max-w-[1900px] mx-auto">

                    {/* Sin Gantt */}
                    {props.sinGantt && (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-amber-200 p-16 text-center">
                            <span className="text-6xl">📋</span>
                            <h2 className="mt-4 text-lg font-black text-slate-700">Cronograma General no encontrado</h2>
                            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                                Primero debe guardar el Cronograma General (Gantt) con las fechas de inicio y fin de cada partida.
                            </p>
                            <a
                                href={`/module/crono_general?project=${props.project}`}
                                className="mt-6 inline-flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                            >
                                Ir al Cronograma General →
                            </a>
                        </div>
                    )}

                    {!props.sinGantt && (
                        <>
                            {/* Banner modo de cálculo */}
                            <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-sm">
                                <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
                                    <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wide ${
                                        modoCalculo === 'calendario'
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                            : 'bg-violet-100 text-violet-700 border border-violet-200'
                                    }`}>
                                        {modoCalculo === 'calendario' ? '📅 Modo Calendario' : '📐 Modo 30 Días'}
                                    </span>
                                    <span className="text-slate-500">
                                        {modoCalculo === 'calendario'
                                            ? 'Corte al último día de cada mes (Regla de Ejecución)'
                                            : 'Bloques exactos de 30 días (Planificación Financiera)'}
                                    </span>
                                </div>
                                <button
                                    onClick={handleToggleModo}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all"
                                >
                                    Cambiar modo →
                                </button>
                            </div>

                            <HeaderValorizado
                                project={props.project}
                                projectName={props.projectName}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                estaGuardado={estaGuardadoUI}
                                saving={saving}
                                deleting={deleting}
                                onSave={handleSave}
                                onDelete={handleDelete}
                                onExportExcel={handleExportExcel}
                                onExportPDF={handleExportPDF}
                                totalDesviadas={totalDesviadas}
                            />

                            <ResumenFinanciero
                                total={props.totalPresupuesto}
                                acumulado={montoAcumuladoTotal}
                                meses={props.periodos.length}
                                mesPico={props.resumen?.mes_pico}
                                montoMesPico={props.resumen?.monto_mes_pico}
                                pctMesPico={props.resumen?.pct_mes_pico}
                                curvaSData={curvaSData}
                            />

                            <TablaValorizada
                                items={itemsFiltrados}
                                periodos={props.periodos}
                                viewMode={viewMode}
                                totales={totalesFinales}
                                totalPresupuesto={props.totalPresupuesto}
                                onEditarCelda={editarCelda}
                                onRedistribuir={redistribuirItem}
                                onRedistribuirGauss={redistribuirGaussItem}
                                onLimpiar={limpiarDistribucion}
                                mesPicoKey={mesPicoKey}
                                diasPorMes={props.diasPorMes}
                                desviaciones={desviaciones}
                                totalDesviadas={totalDesviadas}
                                isPeriodoBloqueado={isPeriodoBloqueado}
                                totalesPorItem={totalesPorItem}
                                totalGeneralPeriodos={totalGeneralPeriodos}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Toast container */}
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
