import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useRef, useState } from 'react';
import { useRealtimeSync, type RemoteUpdate } from '@/hooks/useRealtimeSync';
import AppLayout from '@/layouts/app-layout';
import { exportDesagueToExcel } from '@/lib/desague-export';
import * as calcDesagueRoutes from '@/routes/desague-calculation';
import type { BreadcrumbItem } from '@/types';

import CajaRegistroDesague from './components/CajaRegistroDesague';
import ColectorDesague from './components/ColectorDesague';
import TrampaGrasaDesague from './components/TrampaGrasaDesague';
import UdDesague from './components/UdDesague';
import UvDesague from './components/UvDesague';

interface CalcDesagueSpreadsheet {
    id: number;
    name: string;
    project_name?: string;
    data_sheet?: Record<string, any>;
    is_collaborative: boolean;
    collab_code?: string;
    can_edit: boolean;
    is_owner: boolean;
    collaborators: {
        id: number;
        name: string;
        email: string;
        avatar?: string;
        role: string;
    }[];
}

interface PageProps {
    spreadsheet: CalcDesagueSpreadsheet;
    auth: { user: { id: number; plan: string; name: string } };
    [key: string]: unknown;
}

const SAVE_DEBOUNCE_MS = 2000;

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;
    const [activeTab, setActiveTab] = useState('ud');
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [dataSheet, setDataSheet] = useState<Record<string, any>>(spreadsheet.data_sheet ?? {});

    const tabs = [
        { id: 'ud', name: 'Unidades de Descarga', icon: 'fa-water' },
        { id: 'colector', name: 'Colector', icon: 'fa-project-diagram' },
        { id: 'cajas', name: 'Cajas de Registro', icon: 'fa-box' },
        { id: 'uv', name: 'Unidades de Ventilación', icon: 'fa-wind' },
        { id: 'trampa', name: 'Trampa de Grasa', icon: 'fa-filter' },
    ];

    const handleRemoteUpdate = useCallback((payload: RemoteUpdate & { data_sheet?: Record<string, any> }) => {
        if (payload.data_sheet) {
            setDataSheet(payload.data_sheet);
        }
    }, []);

    const { lastEditorName } = useRealtimeSync({
        spreadsheetId: spreadsheet.id,
        currentUserId: auth.user.id,
        onRemoteUpdate: handleRemoteUpdate,
        isCollaborative: spreadsheet.is_collaborative,
        channelPrefix: 'desague-calculation',
    });

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback((newData: Record<string, any>) => {
        if (!spreadsheet.can_edit) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            setSaving(true);
            router.patch(
                calcDesagueRoutes.update.url(spreadsheet.id),
                { data_sheet: newData },
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setSaving(false);
                        setLastSaved(new Date());
                    },
                }
            );
        }, SAVE_DEBOUNCE_MS);
    }, [spreadsheet.can_edit, spreadsheet.id]);

    const handleDataChange = useCallback((tabId: string, tabData: any) => {
        setDataSheet(prev => {
            const next = { ...prev, [tabId]: tabData };
            scheduleSave(next);
            return next;
        });
    }, [scheduleSave]);

    const toggleEdit = useCallback(() => {
        setEditMode((v) => !v);
    }, []);

    const handleExport = () => {
        exportDesagueToExcel(dataSheet, spreadsheet.name || 'Calculo_Desague');
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Cálculo de Desagüe', href: calcDesagueRoutes.index.url() },
        { title: spreadsheet.name, href: '#' },
    ];

    const renderNavActions = () => {
        return (
            <div className="flex items-center gap-2">
                {spreadsheet.can_edit && (
                    <button
                        onClick={toggleEdit}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${editMode
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}>
                        <span>{editMode ? '✓' : '✎'}</span>
                        <span>{editMode ? 'Editando' : 'Editar'}</span>
                    </button>
                )}
                <button
                    onClick={handleExport}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                    ↓ Excel
                </button>
            </div>
        );
    };

    const renderTabContent = () => {
        const props = {
            editMode,
            canEdit: spreadsheet.can_edit,
            initialData: dataSheet[activeTab],
            onChange: (data: any) => handleDataChange(activeTab, data)
        };

        // You can pass global state or calculated data from one tab to another if needed.
        // const globalTotalUd = dataSheet['ud']?.totalUd ?? 0;

        switch (activeTab) {
            case 'ud': return <UdDesague {...props} />;
            case 'colector': return <ColectorDesague {...props} udData={dataSheet['ud']} />;
            case 'cajas': return <CajaRegistroDesague {...props} colectorData={dataSheet['colector']} udData={dataSheet['ud']} />;
            case 'uv': return <UvDesague {...props} udData={dataSheet['ud']} />;
            case 'trampa': return <TrampaGrasaDesague {...props} />;
            default: return null;
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="sticky top-0 z-[60] bg-white dark:bg-gray-900 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{spreadsheet.name}</h1>
                        {spreadsheet.project_name && (
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{spreadsheet.project_name}</p>
                        )}
                    </div>

                    <div className="ml-4 flex shrink-0 items-center gap-3">
                        {renderNavActions()}

                        {spreadsheet.can_edit && <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />}

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

                            {lastEditorName && (
                                <span className="flex items-center gap-1 ml-2 rounded bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                    📡 {lastEditorName} editando...
                                </span>
                            )}

                            {spreadsheet.is_collaborative && spreadsheet.collaborators.length > 0 && (
                                <div className="flex -space-x-1.5 ml-1">
                                    {spreadsheet.collaborators.slice(0, 4).map((c) => (
                                        <div
                                            key={c.id} title={`${c.name} (${c.role})`}
                                            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-xs font-bold text-white dark:border-gray-900"
                                        >
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                            )}

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
                                            router.post(calcDesagueRoutes.enableCollab.url(spreadsheet.id), {}, { preserveScroll: true });
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

                <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id
                                ? 'border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                                }`}>
                            <i className={`fas ${tab.icon} opacity-70`}></i>
                            {tab.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-gradient-to-br from-white to-cyan-50/50 dark:from-gray-900 dark:to-gray-800/80 min-h-screen">
                <div className="transition-opacity duration-300 opacity-100">
                    {renderTabContent()}
                </div>
            </div>
        </AppLayout>
    );
}
