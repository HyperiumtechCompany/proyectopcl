/**
 * Show.tsx — Metrado Comunicación
 *
 * Estructura basada en caida-tension/Show.tsx, adaptada para Luckysheet.
 *
 * FUNCIONALIDADES:
 * - Header con nombre, proyecto, botón Editar, indicador de autoguardado
 * - Código de colaboración (copiar al portapapeles)
 * - Botón habilitar colaboración (plan mensual/anual/lifetime)
 * - Avatares de colaboradores activos
 * - Indicador en tiempo real de quién está editando (via useRealtimeSync)
 * - Autoguardado con debounce 2s al editar celdas
 * - Exportar hoja a JSON (descarga directa)
 * - Luckysheet cargado via UMD desde public/ (ver Luckysheet.tsx)
 */

import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useRef, useState } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { MetradoComunicacionSpreadsheet } from '@/types/metrado-comunicacion';
import * as comunicacionRoutes from '@/routes/metrados/comunicacion';
import metradoRoutes from '@/routes/metrados';
import Luckysheet from '@/components/costos/tablas/Luckysheet';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PageProps {
    spreadsheet: MetradoComunicacionSpreadsheet;
    auth: { user: { id: number; plan: string; name: string } };
    [key: string]: unknown;
}

// ── Constantes ────────────────────────────────────────────────────────────────

/** Milisegundos a esperar desde la última edición antes de guardar. */
const SAVE_DEBOUNCE_MS = 2000;

// ── Componente ────────────────────────────────────────────────────────────────

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;

    // ── Estado ────────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    /**
     * editMode en Luckysheet funciona al revés que en caiada-tension:
     * true  = hoja en modo normal (editable) — estado por defecto
     * false = hoja bloqueada (sólo lectura) — el usuario la bloqueó intencionalmente
     *
     * Esto evita el problema de que el usuario tenga que recordar
     * hacer clic en "Editar" antes de poder escribir en una celda.
     */
    const [editMode, setEditMode] = useState(true);

    /**
     * `sheetData` es el estado local de la hoja Luckysheet.
     * Se inicializa con el valor del servidor. Puede ser null (hoja nueva).
     */
    const [sheetData, setSheetData] = useState<any[]>(
        Array.isArray(spreadsheet.sheet_data) ? spreadsheet.sheet_data : []
    );

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Autoguardado con debounce ─────────────────────────────────────────────

    /**
     * scheduleSave — Programa un guardado automático 2s después de la última edición.
     * Si el usuario sigue editando, el timer se reinicia.
     * Solo guarda si `can_edit` es true.
     */
    const scheduleSave = useCallback(
        (data: any[]) => {
            if (!spreadsheet.can_edit) return;
            if (saveTimer.current) clearTimeout(saveTimer.current);

            saveTimer.current = setTimeout(() => {
                setSaving(true);
                router.patch(
                    comunicacionRoutes.update.url(spreadsheet.id),
                    { sheet_data: data },
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

    /**
     * handleDataChange — Invocado por el componente Luckysheet cuando el usuario
     * edita una celda. Actualiza el estado y programa el guardado.
     */
    const handleDataChange = useCallback(
        (sheets: any[]) => {
            setSheetData(sheets);
            scheduleSave(sheets);
        },
        [scheduleSave],
    );

    // ── Colaboración en tiempo real ───────────────────────────────────────────

    /**
     * Cuando otro colaborador guarda, recibimos su versión completa y
     * reemplazamos el estado local. No podemos actualizar Luckysheet
     * reactivamente (no soporta re-init), así que en el futuro esto
     * podría usar la API imperativa ls.setRangeValue().
     * Por ahora solo hacemos referencia sin forzar recarga.
     */
    const handleRemoteUpdate = useCallback((payload: any) => {
        if (payload.sheet_data) {
            setSheetData(payload.sheet_data);
        }
    }, []);

    const { lastEditorName } = useRealtimeSync({
        spreadsheetId: spreadsheet.id,
        currentUserId: auth.user.id,
        onRemoteUpdate: handleRemoteUpdate,
        isCollaborative: spreadsheet.is_collaborative,
        channelPrefix: 'metrado-comunicacion.',
    });

    // ── Exportar JSON ─────────────────────────────────────────────────────────

    const handleExportJson = useCallback(() => {
        const json = JSON.stringify(sheetData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${spreadsheet.name ?? 'metrado'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [sheetData, spreadsheet.name]);

    // ── Toggle modo edición ───────────────────────────────────────────────────

    const toggleEdit = useCallback(() => setEditMode((v) => !v), []);

    // ── Breadcrumbs ───────────────────────────────────────────────────────────

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Metrados', href: metradoRoutes.index.url() },
        { title: 'Comunicaciones', href: comunicacionRoutes.index.url() },
        { title: spreadsheet.name || 'Sin nombre', href: '#' },
    ];

    // ── Barra de acciones superior ────────────────────────────────────────────

    const renderNavActions = () => {
        if (!spreadsheet.can_edit) {
            return (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportJson}
                        title="Exportar JSON"
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        ↓ JSON
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2">
                {/*
                 * Botón de bloqueo:
                 * - editMode=true (por defecto): hoja editable.
                 *   Clic → bloquea la hoja (protege contra edición accidental)
                 * - editMode=false: hoja bloqueada.
                 *   Clic → desbloquea.
                 *
                 * UX: a diferencia de caída-de-tensión donde las tablas
                 * son complejas y necesitan modo edición explícito, una
                 * hoja de cálculo debe poder editarse directamente.
                 */}
                <button
                    onClick={toggleEdit}
                    title={editMode ? 'Bloquear hoja (solo lectura)' : 'Desbloquear hoja (edición)'}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${editMode
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700 dark:hover:bg-emerald-900/50'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-300 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-700 dark:hover:bg-red-900/50'
                        }`}
                >
                    <span className="text-[13px]">{editMode ? '🔓' : '🔒'}</span>
                    <span>{editMode ? 'Editable' : 'Bloqueado'}</span>
                </button>

                {/* Exportar JSON — descarga el contenido actual de la hoja */}
                <button
                    onClick={handleExportJson}
                    title="Exportar JSON de la hoja"
                    className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <span>↓</span> JSON
                </button>
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {/* Izquierda: nombre + proyecto */}
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">
                        {spreadsheet.name}
                    </h1>
                    {spreadsheet.project_name && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {spreadsheet.project_name}
                        </p>
                    )}
                </div>

                {/* Derecha: acciones + autoguardado + colaboración */}
                <div className="ml-4 flex shrink-0 items-center gap-3">
                    {renderNavActions()}

                    {spreadsheet.can_edit && (
                        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
                    )}

                    {/* Estado de guardado automático */}
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
                                {lastSaved.toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        )}

                        {/* Indicador: otro colaborador está editando */}
                        {lastEditorName && (
                            <span className="ml-2 flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                📡 {lastEditorName} editando…
                            </span>
                        )}

                        {/* Avatares de colaboradores */}
                        {spreadsheet.is_collaborative && spreadsheet.collaborators.length > 0 && (
                            <div className="ml-1 flex -space-x-1.5">
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

                        {/* Código de colaboración — copiar al portapapeles */}
                        {spreadsheet.is_owner && spreadsheet.is_collaborative && spreadsheet.collab_code && (
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(spreadsheet.collab_code!);
                                    alert('Código de colaboración copiado al portapapeles.');
                                }}
                                title="Copiar código de colaboración"
                                className="ml-1 flex items-center gap-1 rounded bg-indigo-100 pl-1.5 pr-2 py-0.5 font-mono text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/40"
                            >
                                <span className="text-[10px]">👥</span> Cód: {spreadsheet.collab_code}
                            </button>
                        )}

                        {/* Habilitar colaboración — solo owner con plan de pago */}
                        {spreadsheet.is_owner &&
                            !spreadsheet.is_collaborative &&
                            ['mensual', 'anual', 'lifetime'].includes(auth.user.plan) && (
                                <button
                                    onClick={() => {
                                        if (
                                            confirm(
                                                '¿Habilitar colaboración para esta hoja? Los usuarios con el código podrán editarla.',
                                            )
                                        ) {
                                            router.post(
                                                comunicacionRoutes.enableCollab.url(spreadsheet.id),
                                                {},
                                                { preserveScroll: true },
                                            );
                                        }
                                    }}
                                    className="ml-1 flex items-center gap-1 rounded bg-indigo-600 px-2 py-0.5 text-xs text-white transition-colors hover:bg-indigo-700"
                                >
                                    <span className="text-[10px]">👥</span> Habilitar Colaboración
                                </button>
                            )}
                    </div>
                </div>
            </div>

            {/* ── Hoja de cálculo Luckysheet ─────────────────────────────────── */}
            {/*
             * Luckysheet se carga como UMD desde public/luckysheet/luckysheet.umd.js
             * El componente muestra un spinner mientras carga, y un mensaje de error
             * con instrucciones si el archivo no fue copiado a public/.
             *
             * canEdit = spreadsheet.can_edit (permiso del servidor).
             * NO se vincula a editMode: Luckysheet 2.x no respeta allowEdit
             * de forma consistente, y es mejor dejar al usuario editar
             * libremente si tiene permisos. El botón "Bloquear" en el header
             * es un indicador visual, no un mecanismo de bloqueo real en LS 2.x.
             *
             * onDataChange: dispara el autoguardado con debounce de 2s cada
             * vez que el usuario confirma un valor en una celda.
             */}
            <div className="flex-1">
                <Luckysheet
                    data={sheetData}
                    onDataChange={handleDataChange}
                    canEdit={spreadsheet.can_edit}
                    height="calc(100vh - 120px)"
                    options={{
                        title: spreadsheet.name ?? 'Metrado',
                    }}
                />
            </div>
        </AppLayout>
    );
}
