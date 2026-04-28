import React, { useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import axios from 'axios';

import { ValorizadoProps } from './types';
import { useValorizadoLogic } from './helpers/useValorizadoLogic';
import HeaderValorizado from './components/HeaderValorizado';
import ResumenFinanciero from './components/ResumenFinanciero';
import TablaValorizada from './components/TablaValorizada';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN EXCEL (CSV UTF-8 con BOM, abre en Excel correctamente)
// ─────────────────────────────────────────────────────────────────────────────
const exportarExcel = (
    items: any[],
    periodos: any[],
    totales: any,
    projectName: string,
    viewMode: 'monto' | 'porcentaje',
    totalPresupuesto: number,
) => {
    const fmtN = (v: number) => (v ?? 0).toFixed(2);
    const fmtP = (v: number, p: number) => p > 0 ? ((v / p) * 100).toFixed(4) : '0.0000';

    const headers = [
        'N°', 'ÍTEM', 'DESCRIPCIÓN', 'UND', 'METRADO', 'PRECIO UNITARIO', 'PARCIAL (S/.)',
        ...periodos.map((p: any) => `${p.label} (${p.labelCal})`),
    ];

    const rows: string[][] = [];

    // Filas de partidas
    items.forEach((item: any, i: number) => {
        const row = [
            String(i + 1),
            item.item,
            item.descripcion,
            item.und || '',
            fmtN(item.metrado),
            fmtN(item.precio),
            fmtN(item.parcial),
        ];
        periodos.forEach((p: any) => {
            const monto = item.distribucion?.[p.key]?.monto ?? 0;
            row.push(viewMode === 'monto' ? fmtN(monto) : fmtP(monto, item.parcial));
        });
        rows.push(row);
    });

    // Filas de totales
    const totalMensual: string[] = ['', '', '', '', '', 'VALORIZACIÓN MENSUAL (S/.)', ''];
    periodos.forEach((p: any) => totalMensual.push(fmtN(totales[p.key]?.monto ?? 0)));
    rows.push(totalMensual);

    const pctMensual: string[] = ['', '', '', '', '', '% AVANCE MENSUAL', ''];
    periodos.forEach((p: any) => pctMensual.push(fmtN(totales[p.key]?.porcentaje ?? 0) + '%'));
    rows.push(pctMensual);

    const acumulada: string[] = ['', '', '', '', '', 'VALORIZACIÓN ACUMULADA (S/.)', ''];
    periodos.forEach((p: any) => acumulada.push(fmtN(totales[p.key]?.acumuladoMonto ?? 0)));
    rows.push(acumulada);

    const pctAcum: string[] = ['', '', '', '', '', '% AVANCE ACUMULADO', ''];
    periodos.forEach((p: any) => pctAcum.push(fmtN(totales[p.key]?.acumuladoPorcentaje ?? 0) + '%'));
    rows.push(pctAcum);

    const csv = [
        [`CRONOGRAMA DE EJECUCIÓN FÍSICO VALORIZADO`],
        [`PROYECTO: ${projectName}`],
        [],
        headers,
        ...rows,
    ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cronograma_Valorizado_${projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN PDF via ventana de impresión
// ─────────────────────────────────────────────────────────────────────────────
const exportarPDF = (
    items: any[],
    periodos: any[],
    totales: any,
    projectName: string,
) => {
    const fmtN = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 });
    const colWidth = Math.max(50, Math.floor(650 / Math.max(periodos.length, 1)));

    const headerCols = periodos.map((p: any) =>
        `<th style="min-width:${colWidth}px;font-size:8px;text-align:center;padding:3px;background:#1e293b;color:#fff;border:1px solid #334155;">${p.label}<br><span style="font-size:7px;opacity:0.7">${p.labelCal}</span></th>`
    ).join('');

    const bodyRows = items.map((item: any, i: number) => {
        const isLeaf = item.is_leaf;
        const niv = (item.item?.split('.').length ?? 1) - 1;
        const bg = niv === 0 ? '#1e293b' : niv === 1 ? '#e2e8f0' : niv === 2 ? '#f1f5f9' : '#ffffff';
        const color = niv === 0 ? '#ffffff' : '#1e293b';
        const pl = `${6 + niv * 8}px`;

        const mensualCols = periodos.map((p: any) => {
            const m = item.distribucion?.[p.key]?.monto ?? 0;
            return `<td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;">${m > 0 ? fmtN(m) : ''}</td>`;
        }).join('');

        return `<tr>
            <td style="text-align:center;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;background:${bg};color:${color};">${i + 1}</td>
            <td style="font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;background:${bg};color:${color};">${item.item}</td>
            <td style="font-size:8px;padding:2px ${pl};border:1px solid #e2e8f0;background:${bg};color:${color};font-weight:${niv <= 1 ? '700' : '400'};${isLeaf ? 'font-style:italic' : ''}">${item.descripcion}</td>
            <td style="text-align:center;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;">${item.und || ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;">${item.metrado > 0 ? fmtN(item.metrado) : ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;">${item.precio > 0 ? fmtN(item.precio) : ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #dbeafe;background:#eff6ff;font-weight:700;font-family:monospace;color:#1d4ed8;">${item.parcial > 0 ? fmtN(item.parcial) : ''}</td>
            ${mensualCols}
        </tr>`;
    }).join('');

    const footerMensual = periodos.map((p: any) =>
        `<td style="text-align:center;font-size:8px;padding:3px;border:1px solid #1e3a5f;background:#1e3a5f;color:#bfdbfe;font-family:monospace;">${fmtN(totales[p.key]?.monto ?? 0)}</td>`
    ).join('');

    const footerAcum = periodos.map((p: any) =>
        `<td style="text-align:center;font-size:8px;padding:3px;border:1px solid #064e3b;background:#064e3b;color:#6ee7b7;font-family:monospace;">${fmtN(totales[p.key]?.acumuladoMonto ?? 0)}</td>`
    ).join('');

    const footerPctAcum = periodos.map((p: any) => {
        const pct = totales[p.key]?.acumuladoPorcentaje ?? 0;
        return `<td style="text-align:center;font-size:8px;padding:3px;border:1px solid #0f172a;background:#0f172a;color:#34d399;font-family:monospace;">${pct > 0 ? pct.toFixed(2) + '%' : ''}</td>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cronograma Valorizado — ${projectName}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 10px; padding: 10mm; }
        h2 { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 2px; }
        p { font-size: 9px; color: #64748b; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        @media print { @page { size: A3 landscape; margin: 8mm; } }
    </style>
</head>
<body>
    <h2>Cronograma de Ejecución Físico Valorizado</h2>
    <p>${projectName}</p>
    <table>
        <thead>
            <tr>
                <th style="min-width:28px;text-align:center;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">N°</th>
                <th style="min-width:60px;text-align:center;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">ÍTEM</th>
                <th style="min-width:200px;text-align:left;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">DESCRIPCIÓN</th>
                <th style="min-width:35px;text-align:center;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">UND</th>
                <th style="min-width:60px;text-align:right;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">METRADO</th>
                <th style="min-width:65px;text-align:right;padding:3px;background:#0f172a;color:#fff;border:1px solid #334155;">P.U.</th>
                <th style="min-width:80px;text-align:right;padding:3px;background:#1e3a5f;color:#bfdbfe;border:1px solid #334155;">PARCIAL</th>
                ${headerCols}
            </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
            <tr>
                <td colspan="7" style="text-align:right;padding:3px;font-size:8px;font-weight:900;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-transform:uppercase;">Valorización Mensual (S/.)</td>
                ${footerMensual}
            </tr>
            <tr>
                <td colspan="7" style="text-align:right;padding:3px;font-size:8px;font-weight:900;background:#064e3b;color:#6ee7b7;border:1px solid #064e3b;text-transform:uppercase;">Valorización Acumulada (S/.)</td>
                ${footerAcum}
            </tr>
            <tr>
                <td colspan="7" style="text-align:right;padding:3px;font-size:8px;font-weight:900;background:#0f172a;color:#34d399;border:1px solid #0f172a;text-transform:uppercase;">% Avance Acumulado (Curva S)</td>
                ${footerPctAcum}
            </tr>
        </tfoot>
    </table>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 600);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
let _toastSetter: ((t: any[]) => void) | null = null;
let _tc = 0;
const showToast = (text: string, type: 'success' | 'error' | 'info') => {
    if (!_toastSetter) return;
    const id = ++_tc;
    _toastSetter(p => [...p, { id, text, type }]);
    setTimeout(() => _toastSetter!(p => p.filter(t => t.id !== id)), 4000);
};

const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<any[]>([]);
    _toastSetter = setToasts;
    const cm: Record<string, string> = {
        success: 'bg-emerald-900 border-emerald-600 text-emerald-100',
        error: 'bg-rose-900    border-rose-700    text-rose-100',
        info: 'bg-blue-900    border-blue-700    text-blue-100',
    };
    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
            {toasts.map(t => (
                <div key={t.id} className={`px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl ${cm[t.type] || cm.info}`}>
                    {t.text}
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CronogramaValorizado(props: ValorizadoProps) {
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [estaGuardadoUI, setEstaGuardadoUI] = useState(props.estaGuardado ?? false);

    const {
        viewMode, setViewMode,
        searchTerm, setSearchTerm,
        items,
        editarCelda, redistribuirItem, limpiarDistribucion,
        itemsFiltrados,
        totalesFinales,
        curvaSData,
        montoAcumuladoTotal,
    } = useValorizadoLogic(props.items, props.periodos, props.totalPresupuesto);

    // ── GUARDAR ───────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!items.length) {
            showToast('⚠ No hay partidas para guardar.', 'info');
            return;
        }
        if (!confirm(`¿Guardar el valorizado de ${items.length} partidas en la base de datos?`)) return;

        setSaving(true);
        try {
            await axios.post('/cronograma/valorizado/save', {
                project_id: props.project,
                items: items.map(i => ({
                    item: i.item,
                    descripcion: i.descripcion,
                    parcial: i.parcial,
                    distribucion: i.distribucion,
                })),
            });
            setEstaGuardadoUI(true);
            showToast('✅ Cronograma valorizado guardado correctamente.', 'success');
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [props.project, items]);

    // ── ELIMINAR ──────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        if (!confirm('¿Eliminar el valorizado guardado?\nSe recalculará desde el Gantt y presupuesto.')) return;
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
    }, [props.project]);

    // ── EXPORTACIONES ─────────────────────────────────────────────────────────
    const handleExportExcel = useCallback(() => {
        exportarExcel(itemsFiltrados, props.periodos, totalesFinales, props.projectName, viewMode, props.totalPresupuesto);
    }, [itemsFiltrados, props.periodos, totalesFinales, props.projectName, viewMode, props.totalPresupuesto]);

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
        { title: 'Costos', href: '/costos' },
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
                            <h2 className="mt-4 text-lg font-black text-slate-700">
                                Cronograma General no encontrado
                            </h2>
                            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                                Primero debe guardar el Cronograma General (Gantt) con las fechas
                                de inicio y fin de cada partida.
                            </p>
                            <a href={`/module/crono_general?project=${props.project}`}
                                className="mt-6 inline-flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md">
                                Ir al Cronograma General →
                            </a>
                        </div>
                    )}

                    {!props.sinGantt && (
                        <>
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
                                onLimpiar={limpiarDistribucion}
                                mesPicoKey={mesPicoKey}
                            />
                        </>
                    )}
                </div>
            </div>

            <ToastContainer />
        </AppLayout>
    );
}