import React, { useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import axios from 'axios';

import { CronogramaProps }      from './types';
import { useCronogramaLogic }   from './helpers/useCronogramaLogic';
import HeaderMateriales         from './components/HeaderMateriales';
import ResumenCards             from './components/ResumenCards';
import TablaMateriales          from './components/TablaMateriales';

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE EXPORTACIÓN A EXCEL (simple CSV con BOM para UTF-8)
// ─────────────────────────────────────────────────────────────────────────────
const exportarExcel = (
    materiales: any[],
    periodos:   any[],
    projectName: string,
    viewMode:   'cantidad' | 'monto',
) => {
    const headers = [
        'Descripción', 'Unidad', 'Precio Unitario',
        'Cantidad Total', 'Presupuesto Total (S/.)',
        ...periodos.map((p: any) => p.label),
    ];

    const rows = materiales.map(mat => [
        mat.descripcion,
        mat.unidad,
        mat.precio.toFixed(4),
        mat.cantidad_total.toFixed(3),
        mat.presupuesto.toFixed(2),
        ...periodos.map((p: any) => {
            const cant = mat.mensual[p.key] || 0;
            return viewMode === 'cantidad'
                ? cant.toFixed(3)
                : (cant * mat.precio).toFixed(2);
        }),
    ]);

    // Totales
    const totales = [
        'TOTAL', '', '', '', '',
        ...periodos.map((p: any) => {
            const tot = materiales.reduce((s: number, m: any) => {
                const v = m.mensual[p.key] || 0;
                return s + (viewMode === 'cantidad' ? v : v * m.precio);
            }, 0);
            return tot.toFixed(2);
        }),
    ];

    const csvContent = [
        [`Cronograma de Materiales - ${projectName}`],
        [],
        headers,
        ...rows,
        [],
        totales,
    ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Cronograma_Materiales_${projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const CronogramaMateriales: React.FC<CronogramaProps> = ({
    project, projectName, materiales = [], periodos = [],
    resumen, estaGuardado, sinGantt = false,
}) => {
    const [saving,         setSaving]         = useState(false);
    const [deleting,       setDeleting]       = useState(false);
    const [estaGuardadoUI, setEstaGuardadoUI] = useState(estaGuardado);

    const {
        viewMode, setViewMode,
        sortField, sortDir, toggleSort,
        filtro, setFiltro,
        destacado, setDestacado,
        materialesFiltrados,
        totalesMensuales,
        totalGeneral,
        curvaSData,
        mesPicoKey,
        getIntensidad,
    } = useCronogramaLogic(materiales, periodos);

    // ── GUARDAR ───────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!materiales.length) {
            showToast('⚠ No hay materiales para guardar.', 'warning');
            return;
        }
        if (!confirm(`¿Guardar el cronograma de ${materiales.length} materiales en la base de datos?`)) return;

        setSaving(true);
        try {
            await axios.post('/cronograma/materiales/save', {
                project_id: project,
                materiales,
            });
            setEstaGuardadoUI(true);
            showToast(`✅ ${materiales.length} materiales guardados correctamente.`, 'success');
        } catch (err: any) {
            console.error('[handleSave]', err);
            showToast(`❌ Error al guardar: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [project, materiales]);

    // ── ELIMINAR ──────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        if (!confirm('¿Eliminar los datos guardados del cronograma de materiales?\nEsta acción no se puede deshacer.')) return;

        setDeleting(true);
        try {
            await axios.delete(`/cronograma/materiales/destroy?project=${project}`);
            setEstaGuardadoUI(false);
            showToast('🗑 Cronograma de materiales eliminado.', 'info');
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setDeleting(false);
        }
    }, [project]);

    // ── EXPORTAR ──────────────────────────────────────────────────────────────
    const handleExportExcel = useCallback(() => {
        exportarExcel(materiales, periodos, projectName || project, viewMode);
    }, [materiales, periodos, projectName, project, viewMode]);

    // ── BREADCRUMBS ───────────────────────────────────────────────────────────
    const breadcrumbs = [
        { title: 'Costos',              href: '/costos' },
        { title: projectName || `Proyecto ${project}`, href: `/costos/${project}` },
        { title: 'Cronograma Materiales', href: '#' },
    ];

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Materiales — ${projectName || project}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
                <div className="max-w-[1700px] mx-auto">

                    {/* HEADER */}
                    <HeaderMateriales
                        project={project}
                        projectName={projectName}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        estaGuardado={estaGuardadoUI}
                        saving={saving}
                        deleting={deleting}
                        resumen={resumen}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        onExportExcel={handleExportExcel}
                    />

                    {/* RESUMEN + CURVA S */}
                    <ResumenCards
                        estaGuardado={estaGuardadoUI}
                        sinGantt={sinGantt}
                        curvaSData={curvaSData}
                        mesPicoKey={mesPicoKey}
                    />

                    {/* TABLA PRINCIPAL */}
                    {!sinGantt && (
                        <TablaMateriales
                            materiales={materialesFiltrados}
                            periodos={periodos}
                            viewMode={viewMode}
                            totalesMensuales={totalesMensuales}
                            totalGeneral={totalGeneral}
                            sortField={sortField}
                            sortDir={sortDir}
                            filtro={filtro}
                            mesPicoKey={mesPicoKey}
                            destacado={destacado}
                            setDestacado={setDestacado}
                            onToggleSort={toggleSort}
                            onFiltroChange={delta => setFiltro(prev => ({ ...prev, ...delta }))}
                            getIntensidad={getIntensidad}
                        />
                    )}

                    {/* Sin Gantt */}
                    {sinGantt && (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-amber-200 p-16 text-center">
                            <span className="text-6xl">📋</span>
                            <h2 className="mt-4 text-lg font-black text-slate-700">
                                Cronograma General no configurado
                            </h2>
                            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                                Para calcular el cronograma de materiales, primero debe completar el
                                <strong> Cronograma General (Gantt)</strong> con las fechas de inicio
                                y fin de cada partida, y guardarlo.
                            </p>
                            <a
                                href={`/cronograma/general?project=${project}`}
                                className="mt-6 inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                            >
                                Ir al Cronograma General →
                            </a>
                        </div>
                    )}

                </div>
            </div>

            {/* TOAST CONTAINER */}
            <ToastContainer />
        </AppLayout>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MINI SISTEMA DE TOASTS (sin dependencias externas)
// ─────────────────────────────────────────────────────────────────────────────
let toastSetterGlobal: ((t: ToastMsg[]) => void) | null = null;
interface ToastMsg { id: number; text: string; type: string; }
let toastCounter = 0;

const showToast = (text: string, type: 'success' | 'error' | 'info' | 'warning') => {
    if (!toastSetterGlobal) return;
    const id = ++toastCounter;
    toastSetterGlobal(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
        toastSetterGlobal!(prev => prev.filter(t => t.id !== id));
    }, 4000);
};

const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMsg[]>([]);
    toastSetterGlobal = setToasts;

    if (!toasts.length) return null;

    const colorMap: Record<string, string> = {
        success: 'bg-emerald-800 border-emerald-600 text-emerald-100',
        error:   'bg-rose-900    border-rose-700    text-rose-100',
        info:    'bg-blue-900    border-blue-700    text-blue-100',
        warning: 'bg-amber-800   border-amber-600   text-amber-100',
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold backdrop-blur-sm animate-fade-in ${colorMap[t.type] || colorMap.info}`}
                >
                    {t.text}
                </div>
            ))}
        </div>
    );
};

export default CronogramaMateriales;