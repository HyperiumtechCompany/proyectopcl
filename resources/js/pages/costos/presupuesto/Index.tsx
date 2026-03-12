import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { PresupuestoSubsection } from '@/types/presupuestos';
import { useBudgetStore } from './stores/budgetStore';
import { BudgetTree } from './components/BudgetTree';
import { AcuPanel } from './components/AcuPanel';
import { SubsectionNav } from './components/SubsectionNav';
import { usePresupuestoAcu } from './hooks/usePresupuestoAcu';

interface PageProps {
    project: {
        id: number;
        nombre: string;
    };
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
    const { project, subsection, subsectionLabel, rows, availableSubsections } =
        usePage<PageProps>().props;

    const initialize = useBudgetStore((state) => state.initialize);
    const selectedId = useBudgetStore((state) => state.selectedId);

    // We only initialize when rows or subsection changes
    useEffect(() => {
        initialize(rows || []);
    }, [rows, subsection, initialize]);

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

    const handleSaveGeneral = async () => {
        if (!isDirty && !isSaving) return; // Ignore if already saved
        setIsSaving(true);
        try {
            const rawRows = useBudgetStore.getState().rows;
            const currentRows = rawRows.map(row => {
                const { _level, _parentId, _expanded, _hasChildren, _index, ...cleanRow } = row as any;
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
        const row = storeRows.find(r => r.partida === selectedId);
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
        setSheetVersion: () => {},
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

    const handleSubsectionChange = (newSubsection: string) => {
        router.get(
            `/costos/proyectos/${project.id}/presupuesto/${newSubsection}`,
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="flex h-[calc(100vh-80px)] flex-col space-y-2 pb-4">
                <div className="mb-2 shrink-0">
                    <SubsectionNav
                        availableSubsections={availableSubsections}
                        currentSubsection={subsection}
                        onSubsectionChange={handleSubsectionChange}
                    />
                </div>

                <div className="flex-1 overflow-hidden rounded border border-slate-700 bg-slate-900 shadow-xl">
                    {subsection === 'general' ? (
                        <Group orientation="horizontal">
                            <Panel defaultSize={55} minSize={30}>
                                <div className="flex h-full flex-col">
                                    <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
                                        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-widest text-slate-200 uppercase">
                                            <span className="h-2 w-2 rounded-full bg-sky-500"></span>{' '}
                                            Presupuesto General
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-end justify-center">
                                                <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                                                    {isSaving ? 'Guardando en la nube...' : (isDirty ? 'Cambios sin guardar' : 'Presupuesto actualizado')}
                                                </span>
                                                {lastSavedTime && !isDirty && !isSaving && (
                                                    <span className="text-[9px] text-slate-500/80">
                                                        Último guardado: {lastSavedTime.toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                className={`rounded px-3 py-1 text-xs text-white transition-colors disabled:opacity-50 ${isDirty ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                                                onClick={handleSaveGeneral}
                                                disabled={isSaving || !isDirty}
                                            >
                                                {isSaving
                                                    ? 'Guardando...'
                                                    : (isDirty ? 'Guardar Cambios' : 'Guardado')}
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
                                        <BudgetTree
                                            onContextMenu={(e, item) => {
                                                e.preventDefault();
                                                setContextMenu({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                    partidaId: item.partida,
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            </Panel>

                            <Separator className="z-10 w-1.5 cursor-col-resize border-x border-slate-700 bg-slate-800 transition-colors hover:bg-sky-600 active:bg-sky-500" />

                            <Panel defaultSize={35} minSize={25}>
                                <AcuPanel
                                    acuLoading={acuLoading}
                                    acuRows={acuRows}
                                    selectedAcu={selectedAcu}
                                    onSaveAcu={handleSaveAcu}
                                    projectId={project.id}
                                />
                            </Panel>
                        </Group>
                    ) : (
                        <div className="flex h-full flex-col">
                            <div className="border-b border-slate-700 bg-slate-800 px-3 py-2">
                                <h2 className="text-sm font-semibold tracking-widest text-slate-200 uppercase">
                                    {subsectionLabel}
                                </h2>
                            </div>
                            <div className="flex-1 p-4 text-slate-400">
                                This section ({subsection}) is pending migration
                                to the new grid system.
                            </div>
                        </div>
                    )}
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
