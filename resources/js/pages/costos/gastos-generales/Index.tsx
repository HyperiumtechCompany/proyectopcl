import { router, usePage, Head } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Users, Briefcase, FileText, CheckSquare, Download, LayoutDashboard, Save, ShieldCheck } from "lucide-react";
import Swal from "sweetalert2";
import AppLayout from "@/layouts/app-layout";

import { ConsolidadoPanel } from "./components/ConsolidadoPanel";
import { RemuneracionesPanel } from "./components/RemuneracionesPanel";
import { GGFijosPanel } from "./components/GGFijosPanel";
import { GGFijosDesagregadoPanel } from "./components/GGFijosDesagregadoPanel";
import { GGVariablesPanel } from "./components/GGVariablesPanel";
import { SupervisionPanel } from "./components/SupervisionPanel";
import { ControlConcurrentePanel } from "./components/controlconcurrentePanel";
import { VerificacionGastosGeneralesPanel } from "./components/VerificacionGastosGeneralesPanel";

import { usePresupuestoRemuneraciones } from "./hooks/usePresupuestoRemuneraciones";
import { useGGFijos } from "./hooks/useGGFijos";
import { useGGVariables } from "./hooks/useGGVariables";
import { usePresupuestoGastosGenerales } from "./hooks/usePresupuestoGastosGenerales";
import { useGGFijosStore } from "./stores/ggFijosStore";
import { useGGVariablesStore } from "./stores/ggVariablesStore";
import { useRemuneracionesStore } from "./stores/remuneracionesStore";
import { useGastosGeneralesStore } from "./stores/gastosGeneralesStore";
import { useSupervisionStore } from "./stores/supervisionStore";
import { useProjectParamsStore } from "../presupuesto/stores/projectParamsStore";

interface PageProps {
    project: {
        id: number;
        nombre: string;
        codigo_cui?: string;
        codigo_local?: string;
        codigos_modulares?: string[];
        unidad_ejecutora?: string;
        logo_izquierdo_url?: string;
        logo_derecho_url?: string;
        fecha_inicio?: string;
        fecha_fin?: string;
    };
    projectParams: Record<string, any> | null;
    subsection: string;
    [key: string]: unknown;
}

export default function GastosGeneralesIndex() {
    const { project, projectParams, subsection } = usePage<PageProps>().props;
    const initialSubsection = subsection || "consolidado";
    const [currentSubsection, setCurrentSubsection] = useState(initialSubsection);
    const [visitedTabs, setVisitedTabs] = useState(() => new Set([initialSubsection]));
    const [savingAll, setSavingAll] = useState(false);
    const initializeProjectParams = useProjectParamsStore((state) => state.initialize);

    useEffect(() => {
        initializeProjectParams(projectParams);
    }, [initializeProjectParams, projectParams]);

    const ggFijosDirty = useGGFijosStore((state) => state.isDirty);
    const ggVariablesDirty = useGGVariablesStore((state) => state.isDirty);
    const remuneracionesDirty = useRemuneracionesStore((state) => state.isDirty);
    const controlConcurrenteDirty = useGastosGeneralesStore((state) => state.isDirty);
    const supervisionDirty = useSupervisionStore((state) => state.isDirty);
    const saveSupervision = useSupervisionStore((state) => state.saveToDatabase);

    const navItems = [
        { key: "consolidado", label: "Consolidado", icon: LayoutDashboard },
        { key: "gastos_generales", label: "Gastos Generales", icon: Wallet },
        { key: "gastos_fijos", label: "GG. Fijos", icon: Briefcase },
        { key: "remuneraciones", label: "Remuneraciones", icon: Users },
        { key: "supervision", label: "Supervisión", icon: CheckSquare },
        { key: "control_concurrente", label: "Control Concurrente", icon: FileText },
        { key: "verificacion", label: "Verificación", icon: ShieldCheck },
    ];

    const handleTabChange = (key: string) => {
        setVisitedTabs((current) => {
            if (current.has(key)) return current;
            const next = new Set(current);
            next.add(key);
            return next;
        });
        setCurrentSubsection(key);
        window.history.replaceState(window.history.state, "", `/costos/proyectos/${project.id}/gastos-generales/${key}`);
    };

    // Cada hook activa su carga solo cuando la hoja correspondiente está visible.
    const { remuneracionesRows, remuneracionesLoading, saveRemuneracion } = usePresupuestoRemuneraciones({
        projectId: project.id,
        subsection: currentSubsection,
    });

    const { ggFijosNodes, ggFijosLoading, saveGGFijos } = useGGFijos({
        projectId: project.id,
        subsection: currentSubsection,
    });

    const { ggVariablesNodes, ggVariablesLoading, saveGGVariables } = useGGVariables({
        projectId: project.id,
        subsection: currentSubsection,
    });

    const { gastosGeneralesRows, gastosGeneralesLoading, saveGastoGeneral } = usePresupuestoGastosGenerales({
        projectId: project.id,
        subsection: currentSubsection,
    });

    const hasPendingChanges = ggFijosDirty || ggVariablesDirty || remuneracionesDirty || controlConcurrenteDirty || supervisionDirty;
    const pendingCount = useMemo(
        () => [ggFijosDirty, ggVariablesDirty, remuneracionesDirty, controlConcurrenteDirty, supervisionDirty].filter(Boolean).length,
        [controlConcurrenteDirty, ggFijosDirty, ggVariablesDirty, remuneracionesDirty, supervisionDirty],
    );

    const saveAll = useCallback(async () => {
        if (!hasPendingChanges || savingAll) return true;
        setSavingAll(true);

        try {
            if (remuneracionesDirty) await saveRemuneracion(remuneracionesRows);
            if (ggVariablesDirty && (await saveGGVariables(ggVariablesNodes))?.success === false) {
                throw new Error('No se pudieron guardar los gastos variables.');
            }
            if (ggFijosDirty && (await saveGGFijos(ggFijosNodes))?.success === false) {
                throw new Error('No se pudieron guardar los gastos fijos.');
            }
            if (controlConcurrenteDirty && (await saveGastoGeneral(gastosGeneralesRows))?.success === false) {
                throw new Error('No se pudo guardar Control Concurrente.');
            }
            if (supervisionDirty && !(await saveSupervision())) {
                throw new Error('No se pudo guardar Supervisión.');
            }
            return true;
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'No se guardaron todos los cambios',
                text: error instanceof Error ? error.message : 'Revisa tu conexión e inténtalo nuevamente.',
                confirmButtonText: 'Entendido',
            });
            return false;
        } finally {
            setSavingAll(false);
        }
    }, [controlConcurrenteDirty, gastosGeneralesRows, ggFijosDirty, ggFijosNodes, ggVariablesDirty, ggVariablesNodes, hasPendingChanges, remuneracionesDirty, remuneracionesRows, saveGGFijos, saveGGVariables, saveGastoGeneral, saveRemuneracion, saveSupervision, savingAll, supervisionDirty]);

    useEffect(() => {
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasPendingChanges) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeUnload);
        return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, [hasPendingChanges]);

    const handleReturnToDelphin = async () => {
        const destination = `/module/delphin?project=${project.id}`;
        if (!hasPendingChanges) {
            router.get(destination);
            return;
        }

        const decision = await Swal.fire({
            icon: 'warning',
            title: 'Hay cambios sin guardar',
            text: `Tienes cambios pendientes en ${pendingCount} sección${pendingCount === 1 ? '' : 'es'}.`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Guardar y volver',
            denyButtonText: 'Volver sin guardar',
            cancelButtonText: 'Seguir trabajando',
            reverseButtons: true,
        });

        if (decision.isDismissed) return;
        if (decision.isConfirmed && !(await saveAll())) return;
        router.get(destination);
    };

    const handleExportExcel = async () => {
        if (hasPendingChanges && !(await saveAll())) return;
        Swal.fire({ title: 'Preparando Excel', text: 'Validando hojas y cálculos…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const { exportarGastosGeneralesExcel } = await import('./lib/exportarExcel');
            await exportarGastosGeneralesExcel(project);
            await Swal.fire({ icon: 'success', title: 'Excel generado', text: 'El archivo incluye las hojas de cálculo y su verificación.', timer: 1800, showConfirmButton: false });
        } catch (error) {
            console.error('Error exportando Gastos Generales:', error);
            await Swal.fire({ icon: 'error', title: 'No se pudo exportar', text: 'No se pudieron cargar todos los datos. Inténtalo nuevamente.' });
        }
    };

    return (
        <AppLayout breadcrumbs={[
            { title: "Costos", href: "/costos" },
            { title: project.nombre, href: `/costos/${project.id}` },
            { title: "Gastos Generales", href: `/costos/proyectos/${project.id}/gastos-generales/consolidado` }
        ]}>
            <Head title={`Gastos Generales - ${project.nombre}`} />
            
            <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-950 text-slate-200">
                {/* Header Navbar */}
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-800 px-2">
                    <div className="flex overflow-x-auto" role="tablist" aria-label="Secciones de gastos generales">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentSubsection === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => handleTabChange(item.key)}
                                    className={`flex h-9 items-center gap-1.5 border-x border-transparent px-3 text-xs font-medium transition-colors ${
                                        isActive
                                            ? "border-slate-600 bg-slate-950 text-white"
                                            : "text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                                    }`}
                                >
                                    <Icon size={16} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="ml-auto">
                        {hasPendingChanges && (
                            <button
                                type="button"
                                onClick={() => void saveAll()}
                                disabled={savingAll}
                                className="mr-2 inline-flex items-center gap-1.5 border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                            >
                                <Save size={14} />
                                {savingAll ? 'Guardando…' : `Guardar todo (${pendingCount})`}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleExportExcel()}
                            disabled={savingAll}
                            className="mr-2 inline-flex items-center gap-1.5 border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            <Download size={14} />
                            Exportar Excel
                        </button>
                        <button
                            onClick={() => void handleReturnToDelphin()}
                            className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                        >
                            ← Volver a Delphin
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <main className="gg-sheet flex-1 overflow-auto bg-slate-950 p-2">
                    {visitedTabs.has("consolidado") && (
                        <div className={currentSubsection === "consolidado" ? "h-full" : "hidden"}>
                            <ConsolidadoPanel projectId={project.id} />
                        </div>
                    )}
                    
                    {visitedTabs.has("gastos_generales") && (
                        <div className={currentSubsection === "gastos_generales" ? "h-full w-full overflow-auto" : "hidden"}>
                            <div className="flex min-h-full w-full flex-col gap-2">
                                <section className="min-h-[32rem] flex-1">
                                    <GGFijosPanel
                                        loading={ggFijosLoading}
                                        nodes={ggFijosNodes}
                                        onSave={saveGGFijos}
                                        projectId={project.id}
                                        totalBudget={projectParams?.costo_directo || 0}
                                    />
                                </section>
                                <section className="min-h-[32rem] flex-1">
                                    <GGVariablesPanel
                                        loading={ggVariablesLoading}
                                        nodes={ggVariablesNodes}
                                        onSave={saveGGVariables}
                                        projectId={project.id}
                                    />
                                </section>
                            </div>
                        </div>
                    )}
                    
                    {visitedTabs.has("gastos_fijos") && (
                        <div className={currentSubsection === "gastos_fijos" ? "h-full w-full" : "hidden"}>
                            <GGFijosDesagregadoPanel projectId={project.id} />
                        </div>
                    )}
                    
                    {visitedTabs.has("remuneraciones") && (
                        <div className={currentSubsection === "remuneraciones" ? "h-full w-full" : "hidden"}>
                            <RemuneracionesPanel
                                loading={remuneracionesLoading}
                                rows={remuneracionesRows}
                                onSaveRemuneracion={saveRemuneracion}
                                projectId={project.id}
                            />
                        </div>
                    )}
                    
                    {visitedTabs.has("supervision") && (
                        <div className={currentSubsection === "supervision" ? "h-full w-full" : "hidden"}>
                            <SupervisionPanel projectId={project.id} />
                        </div>
                    )}
                    
                    {visitedTabs.has("control_concurrente") && (
                        <div className={currentSubsection === "control_concurrente" ? "h-full w-full" : "hidden"}>
                            <ControlConcurrentePanel
                                loading={gastosGeneralesLoading}
                                rows={gastosGeneralesRows}
                                onSaveGastoGeneral={saveGastoGeneral}
                                projectId={project.id}
                            />
                        </div>
                    )}

                    {visitedTabs.has("verificacion") && (
                        <div className={currentSubsection === "verificacion" ? "h-full w-full" : "hidden"}>
                            <VerificacionGastosGeneralesPanel projectId={project.id} />
                        </div>
                    )}
                </main>
            </div>
        </AppLayout>
    );
}


