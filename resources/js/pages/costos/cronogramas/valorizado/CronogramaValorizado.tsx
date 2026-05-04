import React, { useState, useCallback, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import axios from 'axios';

import { ValorizadoProps, ModoCalculo } from './types';
import { useValorizadoLogic } from './helpers/useValorizadoLogic';
import HeaderValorizado from './components/HeaderValorizado';
import ResumenFinanciero from './components/ResumenFinanciero';
import TablaValorizada from './components/TablaValorizada';

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — usando useRef en lugar de variable de módulo (fix React Strict Mode)
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
// EXPORTACIÓN EXCEL
// ─────────────────────────────────────────────────────────────────────────────
const exportarExcel = (
    items: any[], periodos: any[], totales: any,
    projectName: string, viewMode: 'monto' | 'porcentaje',
) => {
    const fmtN = (v: number) => (v ?? 0).toFixed(2);
    const fmtP = (v: number, p: number) => p > 0 ? ((v / p) * 100).toFixed(4) : '0.0000';

    const headers = [
        'N°', 'ÍTEM', 'DESCRIPCIÓN', 'UND', 'METRADO', 'PRECIO UNITARIO', 'PARCIAL (S/.)',
        ...periodos.map((p: any) => `${p.label} (${p.labelCal})`),
    ];

    const rows: string[][] = [];

    items.forEach((item: any, i: number) => {
        const row = [
            String(i + 1), item.item, item.descripcion, item.und || '',
            fmtN(item.metrado), fmtN(item.precio), fmtN(item.parcial),
        ];
        periodos.forEach((p: any) => {
            const monto = item.distribucion?.[p.key]?.monto ?? 0;
            row.push(viewMode === 'monto' ? fmtN(monto) : fmtP(monto, item.parcial));
        });
        rows.push(row);
    });

    const pushFooter = (label: string, vals: string[]) =>
        rows.push(['', '', '', '', '', label, '', ...vals]);

    pushFooter('VALORIZACIÓN MENSUAL (S/.)',  periodos.map((p: any) => fmtN(totales[p.key]?.monto ?? 0)));
    pushFooter('% AVANCE MENSUAL',            periodos.map((p: any) => fmtN(totales[p.key]?.porcentaje ?? 0) + '%'));
    pushFooter('VALORIZACIÓN ACUMULADA (S/.)',periodos.map((p: any) => fmtN(totales[p.key]?.acumuladoMonto ?? 0)));
    pushFooter('% AVANCE ACUMULADO',          periodos.map((p: any) => fmtN(totales[p.key]?.acumuladoPorcentaje ?? 0) + '%'));

    const csv = [
        [`CRONOGRAMA DE EJECUCIÓN FÍSICO VALORIZADO`],
        [`PROYECTO: ${projectName}`],
        [],
        headers,
        ...rows,
    ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Cronograma_Valorizado_${projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN PDF
// ─────────────────────────────────────────────────────────────────────────────
const exportarPDF = (items: any[], periodos: any[], totales: any, projectName: string) => {
    const fmtN     = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 });
    const colWidth = Math.max(50, Math.floor(650 / Math.max(periodos.length, 1)));

    const headerCols = periodos.map((p: any) =>
        `<th style="min-width:${colWidth}px;font-size:8px;text-align:center;padding:3px;background:#1e293b;color:#fff;border:1px solid #334155;">${p.label}<br><span style="font-size:7px;opacity:0.7">${p.labelCal}</span></th>`
    ).join('');

    const bodyRows = items.map((item: any, i: number) => {
        const niv   = (item.item?.split('.').length ?? 1) - 1;
        const bg    = niv === 0 ? '#1e293b' : niv === 1 ? '#e2e8f0' : niv === 2 ? '#f1f5f9' : '#ffffff';
        const color = niv === 0 ? '#ffffff' : '#1e293b';
        const pl    = `${6 + niv * 8}px`;
        const cols  = periodos.map((p: any) => {
            const m = item.distribucion?.[p.key]?.monto ?? 0;
            return `<td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;">${m > 0 ? fmtN(m) : ''}</td>`;
        }).join('');
        return `<tr>
            <td style="text-align:center;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;background:${bg};color:${color};">${i + 1}</td>
            <td style="font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;background:${bg};color:${color};">${item.item}</td>
            <td style="font-size:8px;padding:2px ${pl};border:1px solid #e2e8f0;background:${bg};color:${color};font-weight:${niv <= 1 ? '700' : '400'};${item.is_leaf ? 'font-style:italic' : ''}">${item.descripcion}</td>
            <td style="text-align:center;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;">${item.und || ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;">${item.metrado > 0 ? fmtN(item.metrado) : ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;">${item.precio > 0 ? fmtN(item.precio) : ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #dbeafe;background:#eff6ff;font-weight:700;font-family:monospace;color:#1d4ed8;">${item.parcial > 0 ? fmtN(item.parcial) : ''}</td>
            ${cols}
        </tr>`;
    }).join('');

    const footerRow = (label: string, bg: string, color: string, vals: string[]) =>
        `<tr><td colspan="7" style="text-align:right;padding:3px;font-size:8px;font-weight:900;background:${bg};color:${color};border:1px solid ${bg};text-transform:uppercase;">${label}</td>
        ${vals.map(v => `<td style="text-align:center;font-size:8px;padding:3px;border:1px solid ${bg};background:${bg};color:${color};font-family:monospace;">${v}</td>`).join('')}</tr>`;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Cronograma Valorizado — ${projectName}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:10px;padding:10mm;}
    table{width:100%;border-collapse:collapse;}@media print{@page{size:A3 landscape;margin:8mm;}}</style>
    </head><body>
    <h2 style="font-size:12px;font-weight:900;text-transform:uppercase;margin-bottom:2px;">Cronograma de Ejecución Físico Valorizado</h2>
    <p style="font-size:9px;color:#64748b;margin-bottom:8px;">${projectName}</p>
    <table><thead><tr>
        <th style="min-width:28px;text-align:center;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">N°</th>
        <th style="min-width:60px;text-align:center;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">ÍTEM</th>
        <th style="min-width:200px;text-align:left;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">DESCRIPCIÓN</th>
        <th style="min-width:35px;text-align:center;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">UND</th>
        <th style="min-width:60px;text-align:right;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">METRADO</th>
        <th style="min-width:65px;text-align:right;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">P.U.</th>
        <th style="min-width:80px;text-align:right;padding:3px;background:#1e3a5f;color:#bfdbfe;border:1px solid #334155;">PARCIAL</th>
        ${headerCols}
    </tr></thead><tbody>${bodyRows}</tbody><tfoot>
        ${footerRow('Valorización Mensual (S/.)',   '#1e3a5f', '#fff',    periodos.map((p: any) => fmtN(totales[p.key]?.monto ?? 0)))}
        ${footerRow('Valorización Acumulada (S/).', '#064e3b', '#6ee7b7', periodos.map((p: any) => fmtN(totales[p.key]?.acumuladoMonto ?? 0)))}
        ${footerRow('% Avance Acumulado (Curva S)', '#0f172a', '#34d399', periodos.map((p: any) => { const pct = totales[p.key]?.acumuladoPorcentaje ?? 0; return pct > 0 ? pct.toFixed(2) + '%' : ''; }))}
    </tfoot></table></body></html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CronogramaValorizado(props: ValorizadoProps) {
    const [saving,          setSaving]          = useState(false);
    const [deleting,        setDeleting]        = useState(false);
    const [estaGuardadoUI,  setEstaGuardadoUI]  = useState(props.estaGuardado ?? false);
    // Modo de cálculo controlado en frontend (sincronizado con URL en servidor)
    const [modoCalculo,     setModoCalculo]     = useState<ModoCalculo>(props.modoCalculo ?? 'calendario');

    const { toasts, show: showToast } = useToast();

    const {
        viewMode, setViewMode,
        searchTerm, setSearchTerm,
        items,
        editarCelda, redistribuirItem, redistribuirGaussItem, limpiarDistribucion,
        itemsFiltrados,
        totalesFinales,
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
                items: items.map(i => ({
                    item: i.item, 
                    descripcion: i.descripcion,
                    parcial: i.parcial, 
                    distribucion: i.distribucion,
                    parent_id: i.parent_id
                })),
            });
            setEstaGuardadoUI(true);
            showToast('✅ Cronograma valorizado guardado correctamente.', 'success');
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [props.project, items, showToast]);

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
    /**
     * Al cambiar el modo, recarga la página con el parámetro ?modo=
     * para que el backend recalcule los períodos y distribuciones.
     */
    const handleToggleModo = useCallback(() => {
        const nuevoModo: ModoCalculo = modoCalculo === 'calendario' ? '30dias' : 'calendario';
        setModoCalculo(nuevoModo);
        const url = new URL(window.location.href);
        url.searchParams.set('modo', nuevoModo);
        window.location.href = url.toString();
    }, [modoCalculo]);

    // ── EXPORTACIONES ─────────────────────────────────────────────────────────
    const handleExportExcel = useCallback(() => {
        exportarExcel(itemsFiltrados, props.periodos, totalesFinales, props.projectName, viewMode);
    }, [itemsFiltrados, props.periodos, totalesFinales, props.projectName, viewMode]);

    const handleExportPDF = useCallback(() => {
        exportarPDF(itemsFiltrados, props.periodos, totalesFinales, props.projectName);
    }, [itemsFiltrados, props.periodos, totalesFinales, props.projectName]);

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
                            <a href={`/module/crono_general?project=${props.project}`}
                                className="mt-6 inline-flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md">
                                Ir al Cronograma General →
                            </a>
                        </div>
                    )}

                    {!props.sinGantt && (
                        <>
                            {/* Banner de modo de cálculo */}
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
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Toast container — sin variable global de módulo */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl ${colorToast[t.type] || colorToast.info}`}>
                        {t.text}
                    </div>
                ))}
            </div>
        </AppLayout>
    );
}

function route(arg0: string): string {
    throw new Error('Function not implemented.');
}
