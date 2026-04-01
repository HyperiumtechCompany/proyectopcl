/**
 * ModuleSpreadsheet.tsx — Reusable component for costos modules
 *
 * Provides:
 * - Header bar with module name, project name, save status
 * - Luckysheet integration with auto-save (debounce 2s)
 * - Export JSON
 * - Back button to project dashboard
 *
 * Design: Delfin/S10 style — minimal chrome, maximum spreadsheet area.
 */

import { router } from '@inertiajs/react';
import React, { useCallback, useRef, useState } from 'react';
import Luckysheet from '@/components/costos/tablas/Luckysheet';

export interface ColumnDef {
    key: string;
    label: string;
    width: number;
}

export interface ModuleSpreadsheetProps {
    projectId: number;
    projectName: string;
    moduleType: string;
    moduleLabel: string;
    columns: ColumnDef[];
    rows: Record<string, any>[];
}

const SAVE_DEBOUNCE_MS = 2000;

/**
 * Converts DB rows + column definitions into Luckysheet sheet data format.
 */
function rowsToLuckysheetData(
    rows: Record<string, any>[],
    columns: ColumnDef[],
    sheetName: string,
): any[] {
    // Build header row
    const headerCells: any[] = columns.map((col, ci) => ({
        r: 0,
        c: ci,
        v: {
            v: col.label,
            m: col.label,
            ct: { fa: 'General', t: 'g' },
            bg: '#e2e8f0',
            bl: 1, // bold
            fs: 10,
        },
    }));

    // Build data rows
    const dataCells: any[] = [];
    rows.forEach((row, ri) => {
        columns.forEach((col, ci) => {
            const value = row[col.key];
            if (value !== null && value !== undefined && value !== '') {
                const isNumber = typeof value === 'number' || (!isNaN(Number(value)) && value !== '');
                dataCells.push({
                    r: ri + 1,
                    c: ci,
                    v: {
                        v: isNumber ? Number(value) : value,
                        m: String(value),
                        ct: { fa: isNumber ? '#,##0.0000' : 'General', t: isNumber ? 'n' : 'g' },
                    },
                });
            }
        });
    });

    // Column widths
    const columnlen: Record<number, number> = {};
    columns.forEach((col, ci) => {
        columnlen[ci] = col.width;
    });

    return [
        {
            name: sheetName,
            status: 1,
            order: 0,
            row: Math.max(rows.length + 20, 50),
            column: Math.max(columns.length + 5, 26),
            celldata: [...headerCells, ...dataCells],
            config: {
                columnlen,
                rowlen: { 0: 28 },
            },
            frozen: { type: 'row', range: { row_focus: 0 } },
        },
    ];
}

/**
 * Converts Luckysheet sheet data back into row objects for saving.
 */
function luckysheetDataToRows(
    sheets: any[],
    columns: ColumnDef[],
): Record<string, any>[] {
    if (!sheets || sheets.length === 0) return [];

    const sheet = sheets[0];
    const data = sheet.data || [];
    const rows: Record<string, any>[] = [];

    // Start from row 1 (skip header)
    for (let r = 1; r < data.length; r++) {
        const row: Record<string, any> = {};
        let hasData = false;

        columns.forEach((col, ci) => {
            const cell = data[r]?.[ci];
            if (cell && (cell.v !== null && cell.v !== undefined && cell.v !== '')) {
                row[col.key] = cell.v;
                hasData = true;
            } else {
                row[col.key] = null;
            }
        });

        if (hasData) {
            rows.push(row);
        }
    }

    return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ModuleSpreadsheet: React.FC<ModuleSpreadsheetProps> = ({
    projectId,
    projectName,
    moduleType,
    moduleLabel,
    columns,
    rows,
}) => {
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSheets = useRef<any[]>([]);

    // Initial Luckysheet data
    const initialData = rowsToLuckysheetData(rows, columns, moduleLabel);

    // ── Auto-save with debounce ─────────────────────────────────────────────

    const doSave = useCallback(
        (sheets: any[]) => {
            const rowData = luckysheetDataToRows(sheets, columns);

            setSaving(true);
            setError(null);

            fetch(`/costos/${projectId}/module/${moduleType}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ rows: rowData }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setLastSaved(new Date());
                    } else {
                        setError(data.error || 'Error al guardar');
                    }
                })
                .catch((e) => setError(e.message))
                .finally(() => setSaving(false));
        },
        [projectId, moduleType, columns],
    );

    const scheduleSave = useCallback(
        (sheets: any[]) => {
            latestSheets.current = sheets;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => doSave(sheets), SAVE_DEBOUNCE_MS);
        },
        [doSave],
    );

    const handleDataChange = useCallback(
        (sheets: any[]) => {
            scheduleSave(sheets);
        },
        [scheduleSave],
    );

    // ── Export JSON ──────────────────────────────────────────────────────────

    const handleExportJson = useCallback(() => {
        const rowData = luckysheetDataToRows(latestSheets.current, columns);
        const json = JSON.stringify(rowData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${moduleType}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [moduleType, columns]);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex h-full flex-col">
            {/* ── Header bar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {/* Left: back + module name */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.get(`/costos/${projectId}`)}
                        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                        ← Volver
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100">{moduleLabel}</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{projectName}</p>
                    </div>
                </div>

                {/* Right: save status + actions */}
                <div className="flex items-center gap-3">
                    {/* Save status */}
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
                        {error && (
                            <span className="flex items-center gap-1 text-red-500">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                                {error}
                            </span>
                        )}
                    </div>

                    {/* Export JSON */}
                    <button
                        onClick={handleExportJson}
                        title="Exportar datos como JSON"
                        className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                        ↓ JSON
                    </button>
                </div>
            </div>

            {/* ── Luckysheet ─────────────────────────────────────────────── */}
            <div className="flex-1">
                <Luckysheet
                    data={initialData}
                    onDataChange={handleDataChange}
                    height="calc(100vh - 120px)"
                    options={{
                        title: moduleLabel,
                    }}
                />
            </div>
        </div>
    );
};

export default ModuleSpreadsheet;
