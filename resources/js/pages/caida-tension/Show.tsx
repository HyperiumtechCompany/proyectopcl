import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useRef, useState } from 'react';
import { useRealtimeSync, type RemoteUpdate } from '@/hooks/useRealtimeSync';
import AppLayout from '@/layouts/app-layout';
import { exportCaidaTensionToExcel } from '@/lib/caida-tension-export';
import { exportTree } from '@/lib/tdTreeManager';
import * as caidaTensionRoutes from '@/routes/caida-tension';
import type { BreadcrumbItem } from '@/types';
import type { ATSRow, CaidaTensionSpreadsheet, SelectionData, TableRowNode, TGRow, TGTableRow } from '@/types/caida-tension';
import SelectionManager from './components/SelectionManager';
import TDManager from './components/TDManager';
import TGManager from './components/TGManager';

interface PageProps {
    spreadsheet: CaidaTensionSpreadsheet;
    auth: { user: { id: number; plan: string; name: string } };
    [key: string]: unknown;
}

type TabId = 'td' | 'tg' | 'seleccion';

const TABS: { id: TabId; label: string }[] = [
    { id: 'td', label: 'TABLEROS DE DISTRIBUCIÓN' },
    { id: 'tg', label: 'TABLERO GENERAL' },
    { id: 'seleccion', label: 'SELECCIÓN DE GRUPO' },
];

const SAVE_DEBOUNCE_MS = 2000;

type TGState = { flattenedData: TGRow[]; atsData: ATSRow[]; tgData: TGTableRow[] };

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;

    const [activeTab, setActiveTab] = useState<TabId>('td');
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // ── Modo edición elevado — se comparte con los 3 managers ─────────────────
    const [editMode, setEditMode] = useState(false);

    // ── Estado de los 3 módulos ───────────────────────────────────────────────
    const [tdTree, setTdTree] = useState<TableRowNode[]>(spreadsheet.td_data ?? []);
    const [tgState, setTgState] = useState<TGState>(
        spreadsheet.tg_data ?? { flattenedData: [], atsData: [], tgData: [] },
    );
    const [tgTotals, setTgTotals] = useState({ potenciaInstalada: 0, maximaDemanda: 0 });
    const [selectionData, setSelectionData] = useState<SelectionData>(
        spreadsheet.selection_data ?? {
            cantidadPotenciaWatts: 0,
            factorDemanda: 1.0,
            factorCarga1: 0.9,
            factorCarga2: 0.8,
            potenciaEstabilizadaStandby: 68,
        },
    );

    // ── Trabajo Colaborativo en Tiempo Real ───────────────────────────────────
    const handleRemoteUpdate = useCallback((payload: RemoteUpdate) => {
        // Actualizar estados locales sin disparar un guardado (scheduleSave)
        setTdTree(payload.td_data ?? []);
        setTgState(payload.tg_data ?? { flattenedData: [], atsData: [], tgData: [] });
        setSelectionData(payload.selection_data);
    }, []);

    const { lastEditorName } = useRealtimeSync({
        spreadsheetId: spreadsheet.id,
        currentUserId: auth.user.id,
        onRemoteUpdate: handleRemoteUpdate,
        isCollaborative: spreadsheet.is_collaborative,
    });

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback(
        (td: TableRowNode[], tg: TGState, sel: SelectionData) => {
            if (!spreadsheet.can_edit) return;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                setSaving(true);
                 
                const payload = JSON.parse(JSON.stringify({
                    td_data: td,
                    tg_data: tg,
                    selection_data: sel,
                })) as any;
                router.patch(
                    caidaTensionRoutes.update.url(spreadsheet.id),
                    payload,
                    {
                        preserveScroll: true,
                        onFinish: () => {
                            setSaving(false);
                            setLastSaved(new Date());
                        },
                    },
                );
            }, SAVE_DEBOUNCE_MS);
        },
        [spreadsheet.can_edit, spreadsheet.id],
    );

    const handleTDChange = useCallback(
        (tree: TableRowNode[]) => {
            setTdTree(tree);
            scheduleSave(tree, tgState, selectionData);
        },
        [scheduleSave, tgState, selectionData],
    );

    const handleTGChange = useCallback(
        (state: TGState) => {
            setTgState(state);
            scheduleSave(tdTree, state, selectionData);
        },
        [scheduleSave, tdTree, selectionData],
    );

    const handleSelectionChange = useCallback(
        (data: SelectionData) => {
            setSelectionData(data);
            scheduleSave(tdTree, tgState, data);
        },
        [scheduleSave, tdTree, tgState],
    );

    // ── Exportar JSON del TD ──────────────────────────────────────────────────
    const handleExportTD = useCallback(() => {
        const json = exportTree(tdTree);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${spreadsheet.name ?? 'tableros'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [tdTree, spreadsheet.name]);

    // ── Exportar a Excel ──────────────────────────────────────────────────────
    const handleExportExcel = useCallback(() => {
        exportCaidaTensionToExcel(tdTree, tgState, selectionData, spreadsheet.name || 'Caida_Tension');
    }, [tdTree, tgState, selectionData, spreadsheet.name]);

    const toggleEdit = useCallback(() => {
        setEditMode((v) => !v);
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Caída de Tensión', href: caidaTensionRoutes.index.url() },
        { title: spreadsheet.name, href: '#' },
    ];

    // ── Botones contextuales según tab ────────────────────────────────────────
    const renderNavActions = () => {
        if (!spreadsheet.can_edit) {
            return (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportExcel}
                        title="Exportar a Excel"
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        ↓ Excel
                    </button>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2">
                {/* Botón de edición — siempre visible si puede editar */}
                <button
                    onClick={toggleEdit}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${editMode
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                >
                    <span>{editMode ? '✓' : '✎'}</span>
                    <span>{editMode ? 'Editando' : 'Editar'}</span>
                </button>

                {/* Botón + Grupo — sólo en tab TD */}
                {activeTab === 'td' && editMode && (
                    <button
                        onClick={() => document.getElementById('td-add-group')?.click()}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        + Grupo TG
                    </button>
                )}

                {/* Botón Exportar Excel — en cualquier tab */}
                <button
                    onClick={handleExportExcel}
                    title="Exportar a Excel"
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                    ↓ Excel
                </button>

                {/* Botón Exportar JSON — sólo en tab TD */}
                {activeTab === 'td' && (
                    <button
                        onClick={handleExportTD}
                        title="Exportar JSON del árbol de tableros"
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        ↓ JSON
                    </button>
                )}
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {/* Izquierda: nombre + proyecto */}
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{spreadsheet.name}</h1>
                    {spreadsheet.project_name && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{spreadsheet.project_name}</p>
                    )}
                </div>

                {/* Derecha: acciones contextuales + estado de guardado + colaboradores */}
                <div className="ml-4 flex shrink-0 items-center gap-3">
                    {/* Acciones del toolbar */}
                    {renderNavActions()}

                    {/* Separador */}
                    {spreadsheet.can_edit && <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />}

                    {/* Estado de guardado */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {saving && (
                            <span className="flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                                Guardando…
                            </span>
                        )}
                        {!saving && lastSaved && (
                            <span className="flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                                {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        {/* Toast de Real-time Sync */}
                        {lastEditorName && (
                            <span className="flex items-center gap-1 ml-2 rounded bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                📡 {lastEditorName} editando...
                            </span>
                        )}

                        {/* Colaboradores */}
                        {spreadsheet.is_collaborative && spreadsheet.collaborators.length > 0 && (
                            <div className="flex -space-x-1.5 ml-1">
                                {spreadsheet.collaborators.slice(0, 4).map((c) => (
                                    <div
                                        key={c.id}
                                        title={`${c.name} (${c.role})`}
                                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-xs font-bold text-white dark:border-gray-900"
                                    >
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Código collab */}
                        {spreadsheet.is_owner && spreadsheet.is_collaborative && spreadsheet.collab_code && (
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(spreadsheet.collab_code!);
                                    alert('Código de colaboración copiado al portapapeles.');
                                }}
                                className="ml-1 rounded flex items-center gap-1 bg-indigo-100 pl-1.5 pr-2 py-0.5 font-mono font-bold text-xs text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/40"
                                title="Copiar código"
                            >
                                <span className="text-[10px]">👥</span> Cód: {spreadsheet.collab_code}
                            </button>
                        )}
                        {spreadsheet.is_owner && !spreadsheet.is_collaborative && ['mensual', 'anual', 'lifetime'].includes(auth.user.plan) && (
                            <button
                                onClick={() => {
                                    if (confirm('¿Habilitar colaboración para esta hoja? Los usuarios con el código podrán editarla.')) {
                                        router.post(caidaTensionRoutes.enableCollab.url(spreadsheet.id), {}, { preserveScroll: true });
                                    }
                                }}
                                className="ml-1 rounded flex items-center gap-1 bg-indigo-600 px-2 py-0.5 text-xs text-white transition-colors hover:bg-indigo-700"
                            >
                                <span className="text-[10px]">👥</span> Habilitar Colaboración
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Contenido de tabs — siempre montado para preservar estado */}
            <div className="p-4 text-gray-900 dark:text-gray-100">
                <div className={activeTab === 'td' ? 'block' : 'hidden'}>
                    {/* Botón oculto para "+ Grupo TG" llamado desde el navbar */}
                    <button
                        id="td-add-group"
                        className="hidden"
                        onClick={() => {
                            // Disparar evento customizado que TDManager escucha
                            window.dispatchEvent(new CustomEvent('td:addGroup'));
                        }}
                    />
                    <TDManager
                        initialTree={spreadsheet.td_data}
                        canEdit={spreadsheet.can_edit}
                        editMode={editMode}
                        onEditModeChange={setEditMode}
                        onChange={handleTDChange}
                        onExport={handleExportTD}
                    />
                </div>
                <div className={activeTab === 'tg' ? 'block' : 'hidden'}>
                    <TGManager
                        tdTree={tdTree}
                        canEdit={spreadsheet.can_edit}
                        editMode={editMode}
                        initialTgState={spreadsheet.tg_data}
                        onChange={handleTGChange}
                        onTotalsChange={setTgTotals}
                    />
                </div>
                <div className={activeTab === 'seleccion' ? 'block' : 'hidden'}>
                    <SelectionManager
                        totalMaxDemanda={tgTotals.maximaDemanda}
                        initialData={spreadsheet.selection_data}
                        canEdit={spreadsheet.can_edit}
                        editMode={editMode}
                        onChange={handleSelectionChange}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
