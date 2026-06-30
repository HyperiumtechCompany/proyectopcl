import { router, usePage, Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    Building2,
    Calculator,
    Wallet,
    Users,
    Settings2,
    FileDown,
    Search,
    ChevronsDownUp,
    ChevronsUpDown,
    FilePlus,
    FileSpreadsheet,
    X,
    ChevronDown,
} from 'lucide-react';
import { Download } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { PresupuestoSubsection } from '@/types/presupuestos';
import { AcuPanel } from './components/AcuPanel';
import { BudgetTree } from './components/BudgetTree';
import { ConsolidadoPanel } from './components/ConsolidadoPanel';
import { ControlConcurrentePanel } from './components/controlconcurrentePanel';
import { FormulaPolinomica } from './components/formula_polinomica';
import { GGFijosDesagregadoPanel } from './components/GGFijosDesagregadoPanel';
import { GGFijosPanel } from './components/GGFijosPanel';
import { GGVariablesPanel } from './components/GGVariablesPanel';
import { ImportMetradosModal } from './components/ImportMetradosModal';
import { InsumosPanel } from './components/InsumosPanel';
import { RemuneracionesPanel } from './components/RemuneracionesPanel';
import { SubsectionNav } from './components/SubsectionNav';
import { SupervisionPanel } from './components/SupervisionPanel';
import { useGGFijos } from './hooks/useGGFijos';
import { useGGVariables } from './hooks/useGGVariables';
import { usePresupuestoAcu } from './hooks/usePresupuestoAcu';
import { usePresupuestoGastosGenerales } from './hooks/usePresupuestoGastosGenerales';
import { usePresupuestoRemuneraciones } from './hooks/usePresupuestoRemuneraciones';
import { useBudgetStore } from './stores/budgetStore';
import { useProjectParamsStore } from './stores/projectParamsStore';

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
    const calculateTree = useBudgetStore((state) => state.calculateTree);
    const expandAll = useBudgetStore((state) => state.expandAll);
    const collapseAll = useBudgetStore((state) => state.collapseAll);
    const setSearchQuery = useBudgetStore((state) => state.setSearchQuery);
    const setSelectedId = useBudgetStore((state) => state.setSelectedId);
    const isDirty = useBudgetStore((state) => state.isDirty);
    const setDirty = useBudgetStore((state) => state.setDirty);
    const storeRows = useBudgetStore((state) => state.rows);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [acuRefreshKey, setAcuRefreshKey] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);

    // Sync search query to store
    useEffect(() => { setSearchQuery(searchValue); }, [searchValue, setSearchQuery]);

    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
    const [exportLoading, setExportLoading] = useState<'excel' | 'pdf' | 'excel-padres' | null>(null);

    const totalBudget = useMemo(() => {
        return storeRows
            .filter((r) => !r._parentId)
            .reduce((sum, r) => sum + (Number(r.parcial) || 0), 0);
    }, [storeRows]);

    const handleSaveGeneral = async () => {
        const anyDirty = isDirty || acuDirty;
        if (!anyDirty || isSaving) return;

        const confirm = await Swal.fire({
            title: '¿Guardar cambios?',
            text: 'Se guardarán todos los cambios pendientes en el presupuesto.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d97706',
            cancelButtonColor: '#475569',
            background: '#1e293b',
            color: '#f1f5f9',
        });

        if (!confirm.isConfirmed) return;

        setIsSaving(true);
        try {
            // 1. Persist pending ACU edits first
            if (acuDirty) {
                const acuOk = await flushPendingAcus();
                if (!acuOk) {
                    await Swal.fire({
                        title: 'Error',
                        text: 'No se pudieron guardar algunos ACUs. Intente nuevamente.',
                        icon: 'error',
                        background: '#1e293b',
                        color: '#f1f5f9',
                        confirmButtonColor: '#d97706',
                    });
                    return;
                }
            }

            // 2. Save presupuesto general rows
            if (isDirty) {
                const rawRows = useBudgetStore.getState().rows;
                const currentRows = rawRows.map((row) => {
                    const { _level, _parentId, _expanded, _hasChildren, _index, ...cleanRow } = row as any;
                    return cleanRow;
                });
                await axios.patch(
                    `/costos/proyectos/${project.id}/presupuesto/general`,
                    { rows: currentRows },
                );
                setDirty(false);
                setLastSavedTime(new Date());
            }
        } catch (error) {
            console.error('Error saving budget', error);
            await Swal.fire({
                title: 'Error',
                text: 'Error de sincronización con el servidor al guardar.',
                icon: 'error',
                background: '#1e293b',
                color: '#f1f5f9',
                confirmButtonColor: '#d97706',
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save desactivado temporalmente para probar importaciones
    // useEffect(() => {
    //     if (!isDirty) return;
    //     const timer = setTimeout(() => { void handleSaveGeneral(); }, 1500);
    //     return () => clearTimeout(timer);
    // }, [isDirty, storeRows]);

    // Export handlers
    const handleExport = async (format: 'excel' | 'excel-padres' | 'pdf') => {
        setExportLoading(format);
        try {
            let url = '';
            let ext = '';

            if (format === 'pdf') {
                url = `/costos/proyectos/${project.id}/presupuesto/export/pdf`;
                ext = 'pdf';
            } else {
                url = `/costos/proyectos/${project.id}/presupuesto/export/excel`;
                ext = 'xlsx';
            }

            const response = await axios.get(url, {
                params: format === 'excel-padres' ? { tipo: 'padres' } : {},
                responseType: 'blob'
            });

            const blob = new Blob([response.data]);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);

            let nombreArchivo = 'presupuesto';
            if (format === 'excel-padres') {
                nombreArchivo += '_padres';
            }
            nombreArchivo += `_${project.nombre.replace(/[^a-z0-9]/gi, '_')}.${ext}`;

            link.download = nombreArchivo;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (e) {
            alert(`Error al exportar a ${format.toUpperCase()}`);
        } finally {
            setExportLoading(null);
        }
    };

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

        // Solo permitir abrir ACU si es una partida (no título) y tiene unidad
        const isPartida = row._level! > 0 && !row._hasChildren;
        const hasUnidad = row.unidad && row.unidad.trim() !== '';

        if (!isPartida || !hasUnidad) return null;

        return { descripcion: row.descripcion, unidad: row.unidad };
    }, [selectedId, storeRows]);

    const {
        acuRows,
        acuLoading,
        selectedAcu,
        localSaveAcu,
        flushPendingAcus,
        acuDirty,
    } = usePresupuestoAcu({
        projectId: project.id,
        subsection,
        selectedCell: null,
        selectedPartidaCode: selectedPartidaData ? selectedId : null,
        selectedPartidaData,
        lastSaved: null,
        setSheetVersion: () => { },
        refreshKey: acuRefreshKey,
    });

    // Visual-first: calculates locally and marks as pending — no DB call until global save
    const handleSaveAcu = async (acuData: Record<string, any>, options?: { updateProjectPrices?: boolean }) => {
        const result = localSaveAcu(acuData, options);
        if (result.success && result.acu && selectedId === result.acu.partida) {
            updateCell(selectedId, 'precio_unitario', result.acu.costo_unitario_total);
            setDirty(true);
        }
        return result;
    };

    // Called by BudgetTree after paste when there is ACU clipboard data.
    // Applies the remapped ACU locally (no DB call) so it appears immediately
    // in the panel and is included in the next global save.
    const handleApplyAcu = useCallback((partida: string, acuData: Record<string, any>) => {
        const result = localSaveAcu({ ...acuData, partida, id: 0 });
        if (result.success && result.acu) {
            updateCell(partida, 'precio_unitario', result.acu.costo_unitario_total);
            setDirty(true);
        }
    }, [localSaveAcu, updateCell, setDirty]);

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
        { key: 'f_polinomica', label: 'Formula Polinomica', icon: Calculator },
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

            {/* Use calc to subtract header height (64px/h-16) and padding to keep everything in view */}
            <div className="flex h-[calc(100vh-68px)] flex-col gap-3 overflow-hidden p-2">
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

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
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

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {subsection === 'general' || subsection === 'acus' ? (
                            <Group orientation="horizontal">
                                <Panel defaultSize={45} minSize={28}>
                                    <div className="flex h-full flex-col">
                                        {/* ── Toolbar S10-style ── */}
                                        <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-slate-800/90 px-2 py-1.5">
                                            <span className="text-[9px] font-bold tracking-wider text-slate-600 uppercase mr-0.5">Insertar</span>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button title="Importar"
                                                        className="flex items-center gap-1 rounded bg-amber-900/60 px-2 py-1 text-[10px] font-semibold text-amber-300 transition-colors hover:bg-amber-800">
                                                        <Download size={11} /> Importar <ChevronDown size={10} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700">
                                                    <DropdownMenuItem className="text-amber-300 focus:bg-amber-900/60 focus:text-amber-200 text-xs cursor-pointer" onClick={() => setIsImportModalOpen(true)}>
                                                        <Download size={14} /> Importar Metrados
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <button title="Nuevo Título raíz" onClick={() => addNode(null, 'titulo')}
                                                className="flex items-center gap-1 rounded bg-sky-900/60 px-2 py-1 text-[10px] font-semibold text-sky-300 transition-colors hover:bg-sky-800">
                                                <FilePlus size={11} /> Título
                                            </button>
                                            <button title="Nuevo Subtítulo hijo del seleccionado" onClick={() => addNode(selectedId, 'subtitulo')}
                                                className="flex items-center gap-1 rounded bg-slate-700/60 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-600">
                                                <FilePlus size={11} /> Subtítulo
                                            </button>
                                            <button title="Nueva Partida hijo del seleccionado" onClick={() => addNode(selectedId, 'partida')}
                                                className="flex items-center gap-1 rounded bg-slate-700/60 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-600">
                                                <FilePlus size={11} /> Partida
                                            </button>
                                            <span className="mx-1 h-4 w-px bg-slate-700" />
                                            <button title="Expandir todo" onClick={expandAll}
                                                className="flex items-center gap-1 rounded bg-slate-700/60 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-slate-600 hover:text-slate-200">
                                                <ChevronsUpDown size={11} /> Exp.
                                            </button>
                                            <button title="Colapsar todo" onClick={collapseAll}
                                                className="flex items-center gap-1 rounded bg-slate-700/60 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-slate-600 hover:text-slate-200">
                                                <ChevronsDownUp size={11} /> colap.
                                            </button>
                                            <button title="Generar Ítems (Renumerar)" onClick={() => useBudgetStore.getState().renumberItems()}
                                                className="flex items-center gap-1 rounded bg-amber-900/40 px-2 py-1 text-[10px] font-semibold text-amber-500 transition-colors hover:bg-amber-800 hover:text-amber-300">
                                                <span>🔢 Numerar</span>
                                            </button>
                                            <div className="flex-1" />
                                            <button title="Exportar a Excel" onClick={() => handleExport('excel')} disabled={exportLoading === 'excel'}
                                                className="flex items-center gap-1 rounded bg-emerald-900/50 px-2 py-1 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-800/60 disabled:opacity-50">
                                                <FileSpreadsheet size={11} />{exportLoading === 'excel' ? '...' : 'Excel'}
                                            </button>

                                        
                                            <button title="Exportar a PDF" onClick={() => handleExport('pdf')} disabled={exportLoading === 'pdf'}
                                                className="flex items-center gap-1 rounded bg-red-900/50 px-2 py-1 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-800/60 disabled:opacity-50">
                                                <FileDown size={11} />{exportLoading === 'pdf' ? '...' : 'PDF'}
                                            </button>
                                                {/* 🆕 BOTÓN EXCEL (PADRES) - AGREGAR JUSTO AQUÍ */}
                                            <button
                                                title="Exportar solo partidas padre"
                                                onClick={() => handleExport('excel-padres')}
                                                disabled={exportLoading === 'excel-padres'}
                                                className="flex items-center gap-1 rounded bg-emerald-900/40 px-2 py-1 text-[10px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-800/60 disabled:opacity-50"
                                            >
                                                <FileSpreadsheet size={11} />
                                                {exportLoading === 'excel-padres' ? '...' : 'Excel (Padres)'}
                                            </button>
                                            

                                            <span className="mx-1 h-4 w-px bg-slate-700" />
                                            


                                            <button
                                                className={`rounded px-3 py-1 text-[10px] font-bold text-white transition-colors disabled:opacity-50 ${isDirty || acuDirty ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-700 hover:bg-emerald-600'}`}
                                                onClick={handleSaveGeneral} disabled={isSaving || (!isDirty && !acuDirty)}>
                                                {isSaving ? 'Guardando...' : (isDirty || acuDirty) ? 'Guardar' : '✓ Guardado'}
                                            </button>

                                            <span className="mx-1 h-4 w-px bg-slate-700" />
                                            {searchOpen ? (
                                                <div className="flex items-center gap-1 rounded border border-sky-700 bg-slate-900 px-2 py-0.5">
                                                    <Search size={11} className="text-sky-400" />
                                                    <input ref={searchRef} autoFocus value={searchValue}
                                                        onChange={(e) => setSearchValue(e.target.value)}
                                                        placeholder="Buscar partida..."
                                                        className="w-28 bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-500" />
                                                    <button onClick={() => { setSearchOpen(false); setSearchValue(''); }} className="text-slate-500 hover:text-slate-200">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setSearchOpen(true)}
                                                    className="flex items-center gap-1 rounded bg-slate-700/60 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-slate-600 hover:text-slate-200">
                                                    <Search size={11} /> Buscar
                                                </button>
                                            )}
                                        </div>

                                        <div className="relative flex-1 overflow-hidden min-h-0 h-full">
                                            {generalLoading ? (
                                                <div className="flex h-full items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                                                        <span className="text-xs font-medium text-slate-400">Cargando presupuesto...</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <BudgetTree
                                                    onRowSelect={(id) => setSelectedId(id)}
                                                    acuRows={acuRows}
                                                    onApplyAcu={handleApplyAcu}
                                                />
                                            )}
                                        </div>

                                        <ImportMetradosModal
                                            projectId={project.id}
                                            isOpen={isImportModalOpen}
                                            onClose={() => setIsImportModalOpen(false)}
                                            onSuccess={() => {
                                                setGeneralLoading(true);
                                                axios.get(`/costos/proyectos/${project.id}/presupuesto/general/data`)
                                                    .then((response) => {
                                                        if (response.data?.success) {
                                                            setGeneralRows(response.data.rows || []);
                                                            initialize(response.data.rows || []);
                                                            setDirty(false);
                                                        }
                                                    })
                                                    .finally(() => setGeneralLoading(false));
                                            }}
                                        />
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
                            <div className="flex min-h-0 flex-1 flex-col overflow-auto gap-4 p-4">
                                {/* Gastos Generales Fijos - Listado 1 */}
                                <div className="flex min-h-[300px] flex-col rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
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
                        ) : subsection === 'insumos' ? (
                            <InsumosPanel projectId={project.id} />
                        ) : subsection === 'f_polinomica' ? (
                            <div className="min-h-0 flex-1 overflow-auto p-4">
                                <FormulaPolinomica rows={storeRows} acuRows={acuRows} projectName={project.nombre} />
                            </div>
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

            {/* Context menu now lives inside BudgetTree component */}
        </AppLayout>
    );
}
