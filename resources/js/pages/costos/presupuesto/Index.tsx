import { router, usePage, Head } from '@inertiajs/react';
import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { PresupuestoSubsection } from '@/types/presupuestos';
import { AcuPanel } from './components/AcuPanel';
import { BudgetTree } from './components/BudgetTree';
import { SubsectionNav } from './components/SubsectionNav';
import { usePresupuestoAcu } from './hooks/usePresupuestoAcu';
import { usePresupuestoRemuneraciones } from './hooks/usePresupuestoRemuneraciones';
import { useGGFijos } from './hooks/useGGFijos';
import { useGGVariables } from './hooks/useGGVariables';
import { usePresupuestoGastosGenerales } from './hooks/usePresupuestoGastosGenerales';
import { useBudgetStore } from './stores/budgetStore';
import { RemuneracionesPanel } from './components/RemuneracionesPanel';
import { GGFijosPanel } from './components/GGFijosPanel';
import { GGVariablesPanel } from './components/GGVariablesPanel';
import { useProjectParamsStore } from './stores/projectParamsStore';
import {
    Building2,
    Calculator,
    Wallet,
    Users,
    Settings2,
    LayoutDashboard,
    FileDown,
    Search,
} from 'lucide-react';
import { GGFijosDesagregadoPanel } from './components/GGFijosDesagregadoPanel';
import { SupervisionPanel } from './components/SupervisionPanel';
import { ConsolidadoPanel } from './components/ConsolidadoPanel';
import { ControlConcurrentePanel } from './components/controlconcurrentePanel';

interface PageProps {
    project: {
        id: number;
        nombre: string;
        fecha_inicio?: string;
        fecha_fin?: string;
    };
    projectParams: Record<string, any> | null;
    subsection: PresupuestoSubsection;
    subsectionLabel: string;
    rows: any[];
    availableSubsections: Array<{
        key: string;
        label: string;
    }>;
    [key: string]: unknown;
}

export default function Index() {
    const { project, projectParams, subsection, subsectionLabel, rows, availableSubsections } =
        usePage<PageProps>().props;

    const initialize = useBudgetStore((state) => state.initialize);
    const initializeParams = useProjectParamsStore((state) => state.initialize);
    const selectedId = useBudgetStore((state) => state.selectedId);

    // Initialize both stores
    useEffect(() => {
        initializeParams(projectParams);
    }, [projectParams, initializeParams]);

    const [generalRows, setGeneralRows] = useState<any[] | null>(null);
    const [generalLoading, setGeneralLoading] = useState(false);

    useEffect(() => {
        if (subsection !== 'acus') {
            setGeneralRows(null);
            setGeneralLoading(false);
            return;
        }

        setGeneralLoading(true);
        axios
            .get(`/costos/proyectos/${project.id}/presupuesto/general/data`)
            .then((response) => {
                if (response.data?.success) {
                    setGeneralRows(response.data.rows || []);
                } else {
                    setGeneralRows([]);
                }
            })
            .catch(() => setGeneralRows([]))
            .finally(() => setGeneralLoading(false));
    }, [project.id, subsection]);

    const effectiveRows =
        subsection === 'acus' ? generalRows || [] : rows || [];

    // We only initialize when rows or subsection changes
    useEffect(() => {
        if (subsection === 'general' || subsection === 'acus') {
            initialize(effectiveRows);
        }
    }, [effectiveRows, subsection, initialize]);

    const addNode = useBudgetStore((state) => state.addNode);
    const deleteRow = useBudgetStore((state) => state.deleteRow);
    const clipboard = useBudgetStore((state) => state.clipboard);
    const setClipboard = useBudgetStore((state) => state.setClipboard);
    const pasteNode = useBudgetStore((state) => state.pasteNode);
    const calculateTree = useBudgetStore((state) => state.calculateTree);
    const isDirty = useBudgetStore((state) => state.isDirty);
    const setDirty = useBudgetStore((state) => state.setDirty);
    const storeRows = useBudgetStore((state) => state.rows);

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        partidaId: string;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

    const totalBudget = useMemo(() => {
        return storeRows
            .filter((r) => !r._parentId)
            .reduce((sum, r) => sum + (Number(r.parcial) || 0), 0);
    }, [storeRows]);

    const handleSaveGeneral = async () => {
        if (!isDirty && !isSaving) return; // Ignore if already saved
        setIsSaving(true);
        try {
            const rawRows = useBudgetStore.getState().rows;
            const currentRows = rawRows.map((row) => {
                const {
                    _level,
                    _parentId,
                    _expanded,
                    _hasChildren,
                    _index,
                    ...cleanRow
                } = row as any;
                return cleanRow;
            });

            // The backend update controller expects a flat array of objects
            await axios.patch(
                `/costos/proyectos/${project.id}/presupuesto/general`,
                { rows: currentRows },
            );
            setDirty(false);
            setLastSavedTime(new Date());
        } catch (error) {
            console.error('Error saving budget', error);
            alert('Error de sincronización con el servidor al guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save debounce effect
    useEffect(() => {
        if (!isDirty) return;

        const timer = setTimeout(() => {
            void handleSaveGeneral();
        }, 1500); // Wait 1.5s after last change

        return () => clearTimeout(timer);
    }, [isDirty, storeRows]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        {
            title: 'Presupuesto',
            href: `/costos/proyectos/${project.id}/presupuesto`,
        },
    ];

    const updateCell = useBudgetStore((state) => state.updateCell);

    // Derive live description/unit from the budget tree for the selected partida
    const selectedPartidaData = useMemo(() => {
        if (!selectedId) return null;
        const row = storeRows.find((r) => r.partida === selectedId);
        if (!row) return null;
        return { descripcion: row.descripcion, unidad: row.unidad };
    }, [selectedId, storeRows]);

    const {
        acuRows,
        acuLoading,
        selectedAcu,
        saveAcu: baseSaveAcu,
    } = usePresupuestoAcu({
        projectId: project.id,
        subsection,
        selectedCell: null, // Cell tracking is not needed in the same way for TanStack
        selectedPartidaCode: selectedId,
        selectedPartidaData,
        lastSaved: null,
        setSheetVersion: () => { },
    });

    // Wrapped save so that AcuPanel updates budgetStore state appropriately
    const handleSaveAcu = async (acuData: Record<string, any>) => {
        const result = await baseSaveAcu(acuData);
        if (result.success && result.acu && selectedId === result.acu.partida) {
            updateCell(
                selectedId,
                'precio_unitario',
                result.acu.costo_unitario_total,
            );
        }
        return result;
    };

    const { remuneracionesRows, remuneracionesLoading, saveRemuneracion } =
        usePresupuestoRemuneraciones({
            projectId: project.id,
            subsection,
        });

    const { ggFijosNodes, ggFijosLoading, saveGGFijos } = useGGFijos({
        projectId: project.id,
        subsection,
    });

    const { ggVariablesNodes, ggVariablesLoading, saveGGVariables } = useGGVariables({
        projectId: project.id,
        subsection,
    });

    const {
        gastosGeneralesRows,
        gastosGeneralesLoading,
        saveGastoGeneral,
    } = usePresupuestoGastosGenerales({
        projectId: project.id,
        subsection,
    });

    const handleSaveGGFijos = async (data: any) => {
        return await saveGGFijos(data);
    };

    const handleSaveGGVariables = async (data: any) => {
        return await saveGGVariables(data);
    };

    const handleSaveRemuneracion = async (data: any) => {
        return await saveRemuneracion(data);
    };

    const handleSaveControlConcurrente = async (data: any) => {
        return await saveGastoGeneral(data);
    };

    // --- Navigation Groups ---
    const mainTabs = [
        { key: 'general', label: 'P. General', icon: Building2 },
        { key: 'acus', label: 'ACUs', icon: Calculator },
        {
            key: 'gg_group',
            label: 'Gastos Gen.',
            icon: Wallet,
            subTabs: [
                { key: 'consolidado', label: 'Consolidado' },
                { key: 'gastos_generales', label: 'Gastos Generales' },
                { key: 'gastos_fijos', label: 'G.G. Fijos' },
                { key: 'supervision', label: 'Supervisión' },
                { key: 'control_concurrente', label: 'Control Concurrente' },
            ],
        },
        { key: 'remuneraciones', label: 'Remuneraciones', icon: Users },
        { key: 'insumos', label: 'Insumos', icon: Settings2 },
    ];

    const isGGSubsection = [
        'consolidado',
        'gastos_generales',
        'gastos_fijos',
        'supervision',
        'control_concurrente',
    ].includes(subsection);
    const activeMainTab = isGGSubsection
        ? 'gg_group'
        : subsection === 'indices'
            ? 'insumos'
            : subsection;

    const handleMainTabChange = (key: string) => {
        if (key === 'gg_group') {
            router.get(
                `/costos/proyectos/${project.id}/presupuesto/consolidado`,
            );
        } else {
            router.get(`/costos/proyectos/${project.id}/presupuesto/${key}`);
        }
    };

    const handleSubTabChange = (key: string) => {
        router.get(`/costos/proyectos/${project.id}/presupuesto/${key}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Presupuesto - ${project.nombre}`} />

            <div className="flex h-full flex-col gap-3 p-2">
                {/* --- Root Menu --- */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900 p-1 shadow-inner">
                    {mainTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeMainTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleMainTabChange(tab.key)}
                                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-bold tracking-wider uppercase transition-all ${isActive
                                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                    }`}
                            >
                                <Icon
                                    className={`h-3.5 w-3.5 ${isActive ? 'animate-pulse' : ''}`}
                                />
                                <span className="whitespace-nowrap">
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                    {/* --- Sub-Tabs Secondary Layer --- */}
                    {isGGSubsection && (
                        <div className="flex items-center gap-8 border-b border-slate-700/50 bg-slate-800/40 px-6 py-2.5 backdrop-blur-sm">
                            {mainTabs
                                .find((t) => t.key === 'gg_group')
                                ?.subTabs?.map((sub) => (
                                    <button
                                        key={sub.key}
                                        onClick={() =>
                                            handleSubTabChange(sub.key)
                                        }
                                        className={`relative text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${subsection === sub.key
                                            ? 'text-amber-400'
                                            : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        {sub.label}
                                        {subsection === sub.key && (
                                            <span className="absolute right-0 -bottom-[10px] left-0 h-0.5 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                                        )}
                                    </button>
                                ))}
                        </div>
                    )}

                    <div className="flex flex-1 flex-col overflow-hidden">
                        {subsection === 'general' || subsection === 'acus' ? (
                            <Group orientation="horizontal">
                                <Panel defaultSize={45} minSize={28}>
                                    <div className="flex h-full flex-col">
                                        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
                                            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-widest text-slate-200 uppercase">
                                                <span className="h-2 w-2 rounded-full bg-sky-500"></span>{' '}
                                                Presupuesto General
                                            </h2>
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-end justify-center">
                                                    <span className="text-[10px] font-medium tracking-wide text-slate-400">
                                                        {isSaving
                                                            ? 'Guardando en la nube...'
                                                            : isDirty
                                                                ? 'Cambios sin guardar'
                                                                : 'Presupuesto actualizado'}
                                                    </span>
                                                    {lastSavedTime &&
                                                        !isDirty &&
                                                        !isSaving && (
                                                            <span className="text-[9px] text-slate-500/80">
                                                                Último guardado:{' '}
                                                                {lastSavedTime.toLocaleTimeString()}
                                                            </span>
                                                        )}
                                                </div>
                                                <button
                                                    className={`rounded px-3 py-1 text-xs text-white transition-colors disabled:opacity-50 ${isDirty ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                                                    onClick={handleSaveGeneral}
                                                    disabled={
                                                        isSaving || !isDirty
                                                    }
                                                >
                                                    {isSaving
                                                        ? 'Guardando...'
                                                        : isDirty
                                                            ? 'Guardar Cambios'
                                                            : 'Guardado'}
                                                </button>
                                                <button
                                                    className="rounded bg-sky-600 px-3 py-1 text-xs text-white transition-colors hover:bg-sky-500"
                                                    onClick={() =>
                                                        addNode(null, 'titulo')
                                                    }
                                                >
                                                    + Añadir Título
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative flex-1 overflow-hidden">
                                            {generalLoading ? (
                                                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                                    Cargando partidas...
                                                </div>
                                            ) : (
                                                <BudgetTree
                                                    onContextMenu={(
                                                        e,
                                                        item,
                                                    ) => {
                                                        e.preventDefault();
                                                        setContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            partidaId:
                                                                item.partida,
                                                        });
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </Panel>

                                <Separator className="z-10 w-1.5 cursor-col-resize border-x border-slate-700 bg-slate-800 transition-colors hover:bg-sky-600 active:bg-sky-500" />

                                <Panel defaultSize={50} minSize={30}>
                                    <AcuPanel
                                        acuLoading={acuLoading}
                                        acuRows={acuRows}
                                        selectedAcu={selectedAcu}
                                        onSaveAcu={handleSaveAcu}
                                        projectId={project.id}
                                    />
                                </Panel>
                            </Group>
                        ) : subsection === 'remuneraciones' ? (
                            <RemuneracionesPanel
                                loading={remuneracionesLoading}
                                rows={remuneracionesRows}
                                onSaveRemuneracion={handleSaveRemuneracion}
                                projectId={project.id}
                            />
                        ) : subsection === 'gastos_generales' ? (
                            <div className="flex flex-1 flex-col overflow-auto gap-4 p-4">
                                {/* Gastos Generales Fijos - Listado 1 */}
                                <div className="flex min-h-[300px] flex-col rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
                                    <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-3">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                        <h3 className="text-sm font-semibold tracking-widest text-slate-200 uppercase">
                                            1) Gastos Generales Fijos
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <GGFijosPanel
                                            loading={ggFijosLoading}
                                            nodes={ggFijosNodes}
                                            onSave={handleSaveGGFijos}
                                            projectId={project.id}
                                            totalBudget={totalBudget}
                                        />
                                    </div>
                                </div>

                                {/* Gastos Generales Variables - Listado 2 */}
                                <div className="flex min-h-[300px] flex-col rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
                                    <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-3">
                                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                        <h3 className="text-sm font-semibold tracking-widest text-slate-200 uppercase">
                                            2) Gastos Generales Variables
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <GGVariablesPanel
                                            loading={ggVariablesLoading}
                                            nodes={ggVariablesNodes}
                                            onSave={handleSaveGGVariables}
                                            projectId={project.id}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : subsection === 'gastos_fijos' ? (
                            //gastos fijos desagregados (parámetros vienen del store)
                            <GGFijosDesagregadoPanel
                                projectId={project.id}
                            />
                        ) : subsection === 'supervision' ? (
                            <SupervisionPanel projectId={project.id} />
                        ) : subsection === 'control_concurrente' ? (
                            <ControlConcurrentePanel
                                loading={gastosGeneralesLoading}
                                rows={gastosGeneralesRows}
                                onSaveGastoGeneral={handleSaveControlConcurrente}
                                projectId={project.id}
                            />
                        ) : subsection === 'consolidado' ? (
                            <ConsolidadoPanel projectId={project.id} />
                        ) : (
                            <div className="flex h-full items-center justify-center p-6 text-center text-slate-400">
                                <div>
                                    <p className="mb-2 text-lg">
                                        Sección en desarrollo
                                    </p>
                                    <p className="text-sm">
                                        La sección de {subsectionLabel} está
                                        pendiente de desarrollo.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Context Menu overlay */}
            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu(null);
                        }}
                    />
                    <div
                        className="fixed z-50 min-w-[160px] rounded border border-slate-700 bg-slate-800 py-1 text-sm text-slate-300 shadow-2xl"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="mb-1 px-3 py-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                            Añadir
                        </div>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-sky-300"
                            onClick={() => {
                                addNode(contextMenu.partidaId, 'titulo');
                                setContextMenu(null);
                            }}
                        >
                            Título (Hijo)
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-sky-300"
                            onClick={() => {
                                addNode(contextMenu.partidaId, 'subtitulo');
                                setContextMenu(null);
                            }}
                        >
                            Subtítulo (Hijo)
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-sky-300"
                            onClick={() => {
                                addNode(contextMenu.partidaId, 'partida');
                                setContextMenu(null);
                            }}
                        >
                            Partida (Hijo)
                        </button>
                        <div className="my-1 border-t border-slate-700" />
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-sky-300"
                            onClick={() => {
                                setClipboard('copy', contextMenu.partidaId);
                                setContextMenu(null);
                            }}
                        >
                            Copiar rama
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-sky-300"
                            onClick={() => {
                                setClipboard('cut', contextMenu.partidaId);
                                setContextMenu(null);
                            }}
                        >
                            Cortar rama
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left hover:bg-slate-700 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                                pasteNode(contextMenu.partidaId);
                                setContextMenu(null);
                            }}
                            disabled={!clipboard}
                        >
                            Pegar dentro
                        </button>
                        <div className="my-1 border-t border-slate-700" />
                        <button
                            className="w-full px-4 py-1.5 text-left text-emerald-500 hover:bg-slate-700 hover:text-emerald-400"
                            onClick={() => {
                                calculateTree();
                                setContextMenu(null);
                            }}
                        >
                            Forzar Cálculo
                        </button>
                        <button
                            className="w-full px-4 py-1.5 text-left text-red-500 hover:bg-red-900/40 hover:text-red-400"
                            onClick={() => {
                                deleteRow(contextMenu.partidaId);
                                setContextMenu(null);
                            }}
                        >
                            Eliminar rama
                        </button>
                    </div>
                </>
            )}
        </AppLayout>
    );
}
