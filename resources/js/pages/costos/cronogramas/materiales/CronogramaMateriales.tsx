import { Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/layouts/app-layout';
import { useToast, ToastContainer } from '@/shared/toast';

import HeaderMateriales from './components/HeaderMateriales';
import ResumenCards from './components/ResumenCards';
import TablaMateriales from './components/TablaMateriales';
import { useCronogramaLogic } from './helpers/useCronogramaLogic';
import { exportarMaterialesExcel } from "./helpers/exportHelpers";
import type { CronogramaProps, MaterialItem } from './types';

// COMPONENTE PRINCIPAL
const CronogramaMateriales: React.FC<CronogramaProps> = ({
    project,
    projectName,
    materiales = [],
    materialesPorTipo,
    periodos = [],
    resumen,
    estaGuardado,
    sinGantt = false,
    projectData,
    sinLayout = false,
}) => {
    console.log('🔴 MATERIALES RECIBIDOS EN CronogramaMateriales:', materiales);
    console.log('🔴 CANTIDAD:', materiales.length);
    const { toasts, show: showToast } = useToast();
    console.log('📋 projectData en componente:', projectData);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [estaGuardadoUI, setEstaGuardadoUI] = useState(estaGuardado);

    // Usar la versión plana de materiales
    const todosMateriales = useMemo((): MaterialItem[] => {
        if (materiales && materiales.length > 0) return materiales;
        if (materialesPorTipo) {
            return [
                ...(materialesPorTipo.mano_de_obra || []),
                ...(materialesPorTipo.materiales || []),
                ...(materialesPorTipo.equipos || []),
                ...(materialesPorTipo.subcontratos || []),
                ...(materialesPorTipo.otros || []),
            ];
        }
        return [];
    }, [materiales, materialesPorTipo]);

    console.log('🔍 Tipos en todosMateriales:', [...new Set(todosMateriales.map(m => m.tipo))]);
    console.log('🔍 materialesPorTipo:', materialesPorTipo ? Object.keys(materialesPorTipo) : 'vacio');

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
    } = useCronogramaLogic(todosMateriales, periodos);


    //  GUARDAR 
    const handleSave = useCallback(async () => {
        if (!todosMateriales.length) {
            showToast('⚠ No hay materiales para guardar.', 'warning');
            return;
        }
        if (!confirm(`¿Guardar el cronograma de ${todosMateriales.length} materiales en la base de datos?`)) return;

        setSaving(true);
        try {
            await axios.post('/module/crono_materiales/save', {
                project_id: project,
                materiales: todosMateriales,
            });
            setEstaGuardadoUI(true);
            showToast(`✅ ${todosMateriales.length} materiales guardados correctamente.`, 'success');
        } catch (err: any) {
            console.error('[handleSave]', err);
            showToast(`❌ Error al guardar: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [project, todosMateriales]);

    //  ELIMINAR 
    const handleDelete = useCallback(async () => {
        if (!confirm('¿Eliminar los datos guardados del cronograma de materiales?\nEsta acción no se puede deshacer.')) return;

        setDeleting(true);
        try {
            await axios.delete(`/module/crono_materiales/clear?project=${project}`);
            setEstaGuardadoUI(false);
            showToast('🗑 Cronograma de materiales eliminado.', 'info');
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setDeleting(false);
        }
    }, [project]);

    //  EXPORTAR 
    const handleExportExcel = useCallback(() => {
        exportarMaterialesExcel(todosMateriales, periodos, projectName || project, viewMode, filtro.tipoFiltro, projectData);
    }, [todosMateriales, periodos, project, projectName, viewMode, filtro.tipoFiltro, projectData]);

    //  BREADCRUMBS 
    const displayName = useMemo(() => {
        if (projectData?.nombre_corto) return projectData.nombre_corto;
        if (projectName) {
            const match = projectName.match(/(I\.?E\.?(?:I\.?P\.?)?\s*N°?\s*\d+)/i);
            if (match) return match[0];
            if (projectName.length > 30) return `Proyecto ${project}`;
            return projectName;
        }

        return `Proyecto ${project}`;
    }, [projectData, projectName, project]);

    const breadcrumbs = useMemo(() => [
        { title: 'Costos', href: '/costos' },
        { title: displayName, href: `/costos/${project}` },
        { title: 'Cronograma Materiales', href: '#' },
    ], [displayName, project]);

    //  RENDER 
    const contenido = (
        <>
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
                            onFiltroChange={(delta) => setFiltro((prev: any) => ({ ...prev, ...delta }))}
                            getIntensidad={getIntensidad}
                        />
                    )}

                    {/* RESUMEN + CURVA S */}
                    <ResumenCards
                        estaGuardado={estaGuardadoUI}
                        sinGantt={sinGantt}
                        curvaSData={curvaSData}
                        mesPicoKey={mesPicoKey}
                    />

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
                                href={`/module/crono_general?project=${project}`}
                                className="mt-6 inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                            >
                                Ir al Cronograma General →
                            </a>
                        </div>
                    )}

                </div>
            </div>

            {/* TOAST CONTAINER */}
            <ToastContainer toasts={toasts} />
        </>
    );

    if (sinLayout) {
        return contenido;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {contenido}
        </AppLayout>
    );
};

// COMPONENTE TOAST (CORREGIDO)


export default CronogramaMateriales;