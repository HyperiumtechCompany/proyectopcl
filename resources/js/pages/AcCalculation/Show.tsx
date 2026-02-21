import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeSync, type RemoteUpdate } from '@/hooks/useRealtimeSync';
import AppLayout from '@/layouts/app-layout';
import { exportAcCalculationToExcel } from '@/lib/ac-export';
import * as acCalculationRoutes from '@/routes/ac-calculation';
import type { BreadcrumbItem } from '@/types';

// --- Types ---
export interface ThermalLoadItem {
    id: number;
    description: string;
    btu: number;
    quantity: number;
}

export interface ACTypeItem {
    id: number;
    btu: number;
    quantity: number;
}

export interface Sheet {
    id: number;
    name: string;
    area: number;
    thermalLoad: ThermalLoadItem[];
    acTypes: ACTypeItem[];
}

export interface AcCalculationData {
    sheets: Sheet[];
    climateType: string;
    climateBTU: number;
    nextSheetId: number;
    nextItemId: number;
}

interface AcCalculationSpreadsheet {
    id: number;
    name: string;
    project_name: string | null;
    data: AcCalculationData | null;
    is_collaborative: boolean;
    collab_code: string | null;
    can_edit: boolean;
    is_owner: boolean;
    collaborators: { id: number; name: string; role: string }[];
}

interface PageProps {
    spreadsheet: AcCalculationSpreadsheet;
    auth: { user: { id: number; plan: string; name: string } };
    [key: string]: unknown;
}

const CLIMATE_CONFIGS: Record<string, { name: string; btu: number }> = {
    'F': { name: 'Frío', btu: 500 },
    'T': { name: 'Templado', btu: 550 },
    'C': { name: 'Caliente', btu: 600 },
    'MC': { name: 'Muy Caliente', btu: 650 }
};

const THERMAL_PRESETS = [
    { description: 'PERSONAS', btu: 500 },
    { description: 'MONITOR DE 32" - MINI PC', btu: 400 },
    { description: 'BAÑO MARIA', btu: 400 },
    { description: 'INCUBADORA DE TRES GASES', btu: 400 },
    { description: 'PEACHÍMETRO DE MESA', btu: 400 },
    { description: 'ESTEREOMICROSCOPIO', btu: 400 },
    { description: 'SISTEMA DE PROCESAMIENTO DE IMÁGENES', btu: 400 },
    { description: 'LUMINARIAS', btu: 200 }
];

const AC_PRESETS = [
    { btu: 9000, type: 'Split 9000 BTU' },
    { btu: 12000, type: 'Split 12000 BTU' },
    { btu: 15000, type: 'Split 15000 BTU' },
    { btu: 18000, type: 'Split 18000 BTU' },
    { btu: 24000, type: 'Split 24000 BTU' },
    { btu: 36000, type: 'Split 36000 BTU' },
    { btu: 60000, type: 'Split 60000 BTU/m²' }
];

const DEFAULT_DATA: AcCalculationData = {
    sheets: [{
        id: 1,
        name: 'LABORATORIO DE BIOLOGÍA MOLECULAR',
        area: 36.22,
        thermalLoad: [
            { id: 1, description: 'PERSONAS', btu: 500, quantity: 7 },
            { id: 2, description: 'MONITOR DE 32" - MINI PC', btu: 400, quantity: 5 },
            { id: 3, description: 'LUMINARIAS', btu: 200, quantity: 6 }
        ],
        acTypes: [{ id: 4, btu: 24000, quantity: 1 }]
    }],
    climateType: 'C',
    climateBTU: 600,
    nextSheetId: 2,
    nextItemId: 5
};

const SAVE_DEBOUNCE_MS = 2000;

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;

    // --- State ---
    const [calcData, setCalcData] = useState<AcCalculationData>(spreadsheet.data || DEFAULT_DATA);
    const [activeSheetId, setActiveSheetId] = useState<number>(calcData.sheets[0]?.id || 1);

    // UI state
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [editMode, setEditMode] = useState(spreadsheet.can_edit);

    // --- Realtime Sync ---
    const handleRemoteUpdate = useCallback((payload: RemoteUpdate & { data?: AcCalculationData }) => {
        if (payload.data) {
            setCalcData(payload.data);
            // Si la hoja activa ya no existe, cambiar a la primera
            if (!payload.data.sheets.find(s => s.id === activeSheetId)) {
                setActiveSheetId(payload.data.sheets[0]?.id || 1);
            }
        }
    }, [activeSheetId]);

    const { lastEditorName } = useRealtimeSync({
        spreadsheetId: spreadsheet.id,
        currentUserId: auth.user.id,
        onRemoteUpdate: handleRemoteUpdate as any, // casting due to custom payloads
        isCollaborative: spreadsheet.is_collaborative,
        channelPrefix: 'ac-calculation.'
    });

    // --- Saving Mechanism ---
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback((newData: AcCalculationData) => {
        if (!spreadsheet.can_edit) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);

        saveTimer.current = setTimeout(() => {
            setSaving(true);
            router.patch(
                acCalculationRoutes.update.url(spreadsheet.id),
                { data: newData } as any,
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

    const updateData = (updater: (prev: AcCalculationData) => AcCalculationData) => {
        if (!editMode || !spreadsheet.can_edit) return;
        setCalcData(prev => {
            const next = updater(prev);
            scheduleSave(next);
            return next;
        });
    };

    // --- Actions ---
    const addSheet = () => {
        updateData(data => {
            const newSheet: Sheet = {
                id: data.nextSheetId,
                name: `Hoja ${data.sheets.length + 1}`,
                area: 0,
                thermalLoad: [],
                acTypes: [{ id: data.nextItemId, btu: 12000, quantity: 1 }]
            };
            setTimeout(() => setActiveSheetId(newSheet.id), 0);
            return {
                ...data,
                sheets: [...data.sheets, newSheet],
                nextSheetId: data.nextSheetId + 1,
                nextItemId: data.nextItemId + 1
            };
        });
    };

    const removeSheet = (id: number) => {
        if (calcData.sheets.length <= 1) return alert('Debe mantener al menos una hoja.');
        if (confirm('¿Eliminar esta hoja?')) {
            updateData(data => {
                const newSheets = data.sheets.filter(s => s.id !== id);
                if (activeSheetId === id) setActiveSheetId(newSheets[0].id);
                return { ...data, sheets: newSheets };
            });
        }
    };

    const updateSheet = (sheetId: number, field: keyof Sheet, value: any) => {
        updateData(data => ({
            ...data,
            sheets: data.sheets.map(s => s.id === sheetId ? { ...s, [field]: value } : s)
        }));
    };

    // --- Calculations ---
    const getAreaLoad = (sheet: Sheet) => parseFloat(((sheet.area || 0) * calcData.climateBTU).toFixed(2));

    const getThermalLoadTotal = (sheet: Sheet) => sheet.thermalLoad.reduce((total, item) => {
        const btu = parseFloat(item.btu as any) || 0;
        const q = parseFloat(item.quantity as any) || 0;
        return total + (btu * q);
    }, 0);

    const getACTotal = (sheet: Sheet) => sheet.acTypes.reduce((total, ac) => {
        const btu = parseFloat(ac.btu as any) || 0;
        const q = parseFloat(ac.quantity as any) || 1;
        return total + (btu * q);
    }, 0);

    const activeSheet = calcData.sheets.find(s => s.id === activeSheetId) || calcData.sheets[0];

    const handleExport = () => {
        exportAcCalculationToExcel(calcData, spreadsheet.name || 'Calculo_AC');
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Cálculos de AC', href: acCalculationRoutes.index.url() },
        { title: spreadsheet.name, href: '#' },
    ];

    if (!activeSheet) return null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Header Toolbar compartida */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{spreadsheet.name}</h1>
                    {spreadsheet.project_name && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{spreadsheet.project_name}</p>
                    )}
                </div>

                <div className="ml-4 flex shrink-0 items-center gap-3">
                    {/* Botones */}
                    {spreadsheet.can_edit && (
                        <button onClick={() => setEditMode(!editMode)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${editMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
                            <span>{editMode ? '✓ Editando' : '✎ Editar'}</span>
                        </button>
                    )}
                    <button onClick={handleExport} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                        ↓ Excel
                    </button>

                    {spreadsheet.can_edit && <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />}

                    {/* Status Sync */}
                    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {saving && <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />Guardando…</span>}
                        {!saving && lastSaved && <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />{lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>}

                        {/* Real-time Sync Toast */}
                        {lastEditorName && (
                            <span className="ml-1 rounded flex items-center gap-1 bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                📡 {lastEditorName} editando...
                            </span>
                        )}

                        {/* Colaboradores Activos */}
                        {spreadsheet.is_collaborative && spreadsheet.collaborators.length > 0 && (
                            <div className="flex -space-x-1.5 ml-1 shrink-0">
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
                                className="ml-1 shrink-0 rounded flex items-center gap-1 bg-indigo-100 pl-1.5 pr-2 py-0.5 font-mono font-bold text-xs text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/40"
                                title="Copiar código"
                            >
                                <span className="text-[10px]">👥</span> Cód: {spreadsheet.collab_code}
                            </button>
                        )}
                        {spreadsheet.is_owner && !spreadsheet.is_collaborative && ['mensual', 'anual', 'lifetime'].includes(auth.user.plan) && (
                            <button
                                onClick={() => {
                                    if (confirm('¿Habilitar colaboración para esta hoja? Los usuarios con el código podrán editarla.')) {
                                        router.post(acCalculationRoutes.enableCollab.url(spreadsheet.id), {}, { preserveScroll: true });
                                    }
                                }}
                                className="ml-1 shrink-0 rounded flex items-center gap-1 bg-indigo-600 px-2 py-0.5 text-xs text-white transition-colors hover:bg-indigo-700"
                            >
                                <span className="text-[10px]">👥</span> Habilitar Colaboración
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Configuración global de Tipo de Clima */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center gap-4 text-sm">
                    <label className="font-semibold text-gray-700 dark:text-gray-300">Tipo de Clima Global:</label>
                    <div className="flex bg-white rounded-md shadow-sm border border-gray-300 overflow-hidden dark:bg-gray-900 dark:border-gray-600">
                        {Object.entries(CLIMATE_CONFIGS).map(([key, config]) => (
                            <button
                                key={key}
                                disabled={!editMode}
                                onClick={() => updateData(d => ({ ...d, climateType: key, climateBTU: config.btu }))}
                                className={`px-4 py-1.5 text-xs font-medium transition-colors border-r last:border-0 border-gray-200 dark:border-gray-700 ${calcData.climateType === key ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'} disabled:opacity-75 disabled:cursor-not-allowed`}
                            >
                                {config.name} ({config.btu} BTU)
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Navegación de Hojas */}
            <div className="flex items-center overflow-x-auto border-b border-gray-200 bg-white px-2 scrollbar-thin dark:border-gray-700 dark:bg-gray-900">
                {calcData.sheets.map(sheet => (
                    <div key={sheet.id} className={`group flex items-center min-w-max border-b-2 transition-colors ${activeSheetId === sheet.id ? 'border-blue-600' : 'border-transparent hover:border-gray-300'}`}>
                        <button onClick={() => setActiveSheetId(sheet.id)} className={`px-4 py-3 text-sm font-medium ${activeSheetId === sheet.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                            {sheet.name}
                        </button>
                        {editMode && (
                            <button onClick={() => removeSheet(sheet.id)} title="Eliminar hoja" className="mr-2 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500">
                                ×
                            </button>
                        )}
                    </div>
                ))}
                {editMode && (
                    <button onClick={addSheet} className="px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-700 border-b-2 border-transparent hover:border-blue-300 dark:text-blue-400">
                        + Agregar Hoja
                    </button>
                )}
            </div>

            {/* Contenido de la Hoja Activa */}
            <div className="p-6">
                <div className="max-w-5xl mx-auto space-y-6">

                    {/* Detalles de la Hoja */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la Hoja (Ambiente)</label>
                            <input
                                type="text" value={activeSheet.name} disabled={!editMode}
                                onChange={e => updateSheet(activeSheet.id, 'name', e.target.value)}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Área (m²)</label>
                            <input
                                type="number" step="0.01" value={activeSheet.area} disabled={!editMode}
                                onChange={e => updateSheet(activeSheet.id, 'area', parseFloat(e.target.value) || 0)}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900"
                            />
                        </div>
                    </div>

                    {/* Área Total Calculada */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 flex justify-between items-center dark:bg-blue-900/20 dark:border-blue-800">
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Carga por Área ({activeSheet.area} m² × {calcData.climateBTU} BTU)</span>
                        <span className="font-bold text-lg text-blue-900 dark:text-blue-100">{getAreaLoad(activeSheet)} BTU</span>
                    </div>

                    {/* Carga Térmica (Equipos/Personas) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center dark:bg-gray-900 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Cargas Térmicas (Equipos/Personas)</h3>
                            {editMode && (
                                <button
                                    onClick={() => updateData(d => {
                                        const newItem = { id: d.nextItemId, description: '', btu: 400, quantity: 1 };
                                        return {
                                            ...d, nextItemId: d.nextItemId + 1,
                                            sheets: d.sheets.map(s => s.id === activeSheet.id ? { ...s, thermalLoad: [...s.thermalLoad, newItem] } : s)
                                        };
                                    })}
                                    className="text-xs bg-white border border-gray-300 font-medium px-2.5 py-1 rounded text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                >
                                    + Agregar Carga
                                </button>
                            )}
                        </div>
                        <div className="p-4 space-y-3">
                            {activeSheet.thermalLoad.map((item, idx) => (
                                <div key={item.id} className="flex gap-3 items-start">
                                    <div className="flex-1">
                                        <input
                                            type="text" placeholder="Descripción" value={item.description} disabled={!editMode}
                                            list="thermal-presets"
                                            onChange={e => {
                                                const desc = e.target.value;
                                                // Auto-fill BTU if preset matches
                                                const preset = THERMAL_PRESETS.find(p => p.description.toLowerCase() === desc.toLowerCase());
                                                updateData(d => ({
                                                    ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                        ...s,
                                                        thermalLoad: s.thermalLoad.map(t => t.id === item.id ? { ...t, description: desc, btu: preset ? preset.btu : t.btu } : t)
                                                    } : s)
                                                }));
                                            }}
                                            className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                                        />
                                        <datalist id="thermal-presets">
                                            {THERMAL_PRESETS.map((p, i) => <option key={i} value={p.description} />)}
                                        </datalist>
                                    </div>
                                    <div className="w-24">
                                        <input
                                            type="number" title="BTU/Und" value={item.btu} disabled={!editMode}
                                            onChange={e => updateData(d => ({
                                                ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                    ...s, thermalLoad: s.thermalLoad.map(t => t.id === item.id ? { ...t, btu: parseFloat(e.target.value) || 0 } : t)
                                                } : s)
                                            }))}
                                            className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="w-20">
                                        <input
                                            type="number" title="Cant." value={item.quantity} disabled={!editMode}
                                            onChange={e => updateData(d => ({
                                                ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                    ...s, thermalLoad: s.thermalLoad.map(t => t.id === item.id ? { ...t, quantity: parseFloat(e.target.value) || 0 } : t)
                                                } : s)
                                            }))}
                                            className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="w-24 px-2 py-2 text-sm text-right font-medium text-gray-700 dark:text-gray-300">
                                        {item.btu * item.quantity} BTU
                                    </div>
                                    {editMode && (
                                        <button
                                            onClick={() => updateData(d => ({
                                                ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                    ...s, thermalLoad: s.thermalLoad.filter(t => t.id !== item.id)
                                                } : s)
                                            }))}
                                            className="mt-1.5 text-red-500 hover:text-red-700 px-2"
                                        >×</button>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-end pt-2 border-t text-sm font-bold text-gray-800 dark:text-gray-200">
                                Total Cargas Secundarias: {getThermalLoadTotal(activeSheet)} BTU
                            </div>
                        </div>
                    </div>

                    {/* Resumen Total Requerido */}
                    <div className="bg-orange-50 rounded-xl p-5 border border-orange-200 flex flex-col md:flex-row justify-between items-center gap-4 dark:bg-orange-900/20 dark:border-orange-800">
                        <div className="text-orange-900 dark:text-orange-100">
                            <h2 className="font-bold text-lg">Carga Térmica Total Requerida</h2>
                            <p className="opacity-80 text-sm">Área + Cargas Secundarias</p>
                        </div>
                        <div className="text-3xl font-black text-orange-600 dark:text-orange-400">
                            {getAreaLoad(activeSheet) + getThermalLoadTotal(activeSheet)} BTU
                        </div>
                    </div>

                    {/* Propuesta de Equipos AC */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center dark:bg-gray-900 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Equipos Aire Acondicionado (Propuesta)</h3>
                            {editMode && (
                                <button
                                    onClick={() => updateData(d => {
                                        const newItem = { id: d.nextItemId, btu: 12000, quantity: 1 };
                                        return {
                                            ...d, nextItemId: d.nextItemId + 1,
                                            sheets: d.sheets.map(s => s.id === activeSheet.id ? { ...s, acTypes: [...s.acTypes, newItem] } : s)
                                        };
                                    })}
                                    className="text-xs bg-white border border-gray-300 font-medium px-2.5 py-1 rounded text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                >
                                    + Agregar Equipo
                                </button>
                            )}
                        </div>
                        <div className="p-4 space-y-3">
                            {activeSheet.acTypes.map((ac, idx) => (
                                <div key={ac.id} className="flex gap-3 items-center">
                                    <div className="flex-1">
                                        <select
                                            value={ac.btu} disabled={!editMode}
                                            onChange={e => updateData(d => ({
                                                ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                    ...s, acTypes: s.acTypes.map(t => t.id === ac.id ? { ...t, btu: parseInt(e.target.value) } : t)
                                                } : s)
                                            }))}
                                            className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                                        >
                                            {AC_PRESETS.map(p => <option key={p.btu} value={p.btu}>{p.type}</option>)}
                                            {!AC_PRESETS.find(p => p.btu === ac.btu) && <option value={ac.btu}>Personalizado ({ac.btu} BTU)</option>}
                                        </select>
                                    </div>
                                    <div className="w-24">
                                        <input
                                            type="number" title="Cant." value={ac.quantity} disabled={!editMode}
                                            onChange={e => updateData(d => ({
                                                ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                    ...s, acTypes: s.acTypes.map(t => t.id === ac.id ? { ...t, quantity: parseInt(e.target.value) || 1 } : t)
                                                } : s)
                                            }))}
                                            className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="w-24 px-2 text-sm text-right font-medium text-gray-700 dark:text-gray-300">
                                        {ac.btu * ac.quantity} BTU
                                    </div>
                                    {editMode && (
                                        <button
                                            onClick={() => updateData(d => ({
                                                ...d, sheets: d.sheets.map(s => s.id === activeSheet.id ? {
                                                    ...s, acTypes: s.acTypes.filter(t => t.id !== ac.id)
                                                } : s)
                                            }))}
                                            className="text-red-500 hover:text-red-700 px-2"
                                        >×</button>
                                    )}
                                </div>
                            ))}

                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <div className="text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Total Capacidad AC:</span>
                                    <strong className="ml-2 text-lg text-gray-800 dark:text-gray-100">{getACTotal(activeSheet)} BTU</strong>
                                </div>

                                {(() => {
                                    const required = getAreaLoad(activeSheet) + getThermalLoadTotal(activeSheet);
                                    const provided = getACTotal(activeSheet);
                                    const diff = provided - required;
                                    const isOk = diff >= 0;

                                    return (
                                        <div className={`px-4 py-2 rounded-lg text-sm font-bold ${isOk ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                            Balance: {diff > 0 ? '+' : ''}{diff} BTU
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
