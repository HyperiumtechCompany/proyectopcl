import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
// TIPOS
interface ColumnDef { key: string; label: string; width: number }

interface EstructurasPageProps {
    project:  { id: number; nombre: string };
    metrado:  Record<string, any>[];
    resumen:  Record<string, any>[];
    [key: string]: unknown;
}

// DEFINICIÓN DE COLUMNAS para Metrado
const METRADO_COLS: ColumnDef[] = [
    { key: 'item',        label: 'Item',         width: 50  },
    { key: 'descripcion', label: 'Descripción',   width: 250 },
    { key: 'und',         label: 'Und',          width: 60  },
    { key: 'elem_simil',  label: 'Elem.Simil.',  width: 80  },
    { key: 'largo',       label: 'Largo',        width: 70  },
    { key: 'ancho',       label: 'Ancho',        width: 70  },
    { key: 'alto',        label: 'Alto',         width: 70  },
    { key: 'nveces',      label: 'N° Veces',     width: 70  },
    { key: 'long',        label: 'Long.',        width: 80  },
    { key: 'area',        label: 'Área',         width: 80  },
    { key: 'vol',         label: 'Vol.',         width: 80  },
    { key: 'kg',          label: 'Kg.',          width: 80  },
    { key: 'parcial',     label: 'Parcial',      width: 100 },
    { key: 'total',       label: 'Total',        width: 100 },
    { key: 'obs',         label: 'Obs.',         width: 120 },
];

// Columnas para Resumen
const RESUMEN_COLS: ColumnDef[] = [
    { key: 'item',        label: 'Item',         width: 60  },
    { key: 'descripcion', label: 'Descripción',   width: 400 },
    { key: 'und',         label: 'Und',          width: 80  },
    { key: 'parcial',     label: 'Parcial',      width: 120 },
    { key: 'total',       label: 'Total',        width: 120 },
];

const SAVE_DEBOUNCE = 1800;

// HELPERS
const toNum = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const blank = (v: any) => v === null || v === undefined || v === '';

const cellRaw = (cell: any): any => {
    if (!cell) return null;
    const r = cell.v;
    return r && typeof r === 'object' && 'v' in r ? r.v ?? null : r ?? null;
};

const mkNum = (v: number): Record<string, any> => ({
    v, m: v === 0 ? '' : String(v), ct: { fa: '#,##0.0000', t: 'n' },
});
const mkTxt = (v: string): Record<string, any> => ({
    v, m: v, ct: { fa: 'General', t: 'g' },
});

// Unit to column mapping for total calculation
const UNIT_TOTAL_COL: Record<string, string> = {
    und: 'parcial', pza: 'parcial',
    m: 'long', ml: 'long',
    m2: 'area',
    m3: 'vol', lt: 'vol', gl: 'vol',
    kg: 'kg',
};

// CONVERSIÓN FILAS ↔ DATOS DE HOJA LUCKYSHEET
function rowsToSheet(
    rows: Record<string, any>[],
    cols: ColumnDef[],
    name: string,
    order = 0,
) {
    const header: any[] = cols.map((col, ci) => ({
        r: 0, c: ci,
        v: { v: col.label, m: col.label, ct: { fa: 'General', t: 'g' },
             bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10 },
    }));

    const cells: any[] = [];
    rows.forEach((row, ri) => {
        const rIdx = ri + 1;
        cols.forEach((col, ci) => {
            let val = row[col.key];
            if (blank(val)) return;

            const isNum = typeof val === 'number' || (val !== '' && !isNaN(Number(val)));

            const cell: Record<string, any> = {
                v:  isNum ? Number(val) : val,
                m:  String(val),
                ct: { fa: isNum ? '#,##0.0000' : 'General', t: isNum ? 'n' : 'g' },
                fs: 10,
            };
            cells.push({ r: rIdx, c: ci, v: cell });
        });
    });

    const columnlen: Record<number, number> = {};
    cols.forEach((col, ci) => {
        columnlen[ci] = col.width;
    });

    return {
        name, status: order === 0 ? 1 : 0, order,
        row:    Math.max(rows.length + 50, 100),
        column: Math.max(cols.length + 5, 20),
        celldata: [...header, ...cells],
        config: { columnlen, rowlen: { 0: 30 } },
        frozen: { type: 'row', range: { row_focus: 0 } },
    };
}

function sheetToRows(sheet: any, cols: ColumnDef[]): Record<string, any>[] {
    if (!sheet) return [];
    const data: any[][] = sheet.data || [];
    const rows: Record<string, any>[] = [];

    for (let r = 1; r < data.length; r++) {
        const row: Record<string, any> = {};
        let hasData = false;
        cols.forEach((col, ci) => {
            const raw = cellRaw(data[r]?.[ci]);
            if (!blank(raw)) {
                row[col.key] = raw;
                hasData = true;
            } else {
                row[col.key] = null;
            }
        });
        if (hasData) rows.push(row);
    }
    return rows;
}

// COMPONENTE PRINCIPAL
export default function EstructurasIndex() {
    const { project, metrado, resumen } =
        usePage<EstructurasPageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: 'Metrado Estructuras', href: '#' },
    ];

    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSheets = useRef<any[]>([]);

    // Hojas iniciales
    const initialSheets = useMemo(() => {
        const sheets: any[] = [];
        sheets.push(rowsToSheet(metrado ?? [], METRADO_COLS, 'Metrado', 0));
        sheets.push(rowsToSheet(resumen ?? [], RESUMEN_COLS, 'Resumen', 1));
        return sheets;
    }, [metrado, resumen]);

    // Guardar en base de datos
    const doSave = useCallback(async (sheets: any[]) => {
        setSaving(true);
        setSaveError(null);

        const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf,
            'X-Requested-With': 'XMLHttpRequest',
        };

        const reqs: Array<{ url: string; body: any }> = [];
        sheets.forEach((sheet: any) => {
            const name = String(sheet?.name ?? '');
            if (name === 'Metrado') {
                reqs.push({ 
                    url: `/costos/${project.id}/metrado-estructuras/metrado`, 
                    body: { rows: sheetToRows(sheet, METRADO_COLS) } 
                });
            } else if (name === 'Resumen') {
                reqs.push({ 
                    url: `/costos/${project.id}/metrado-estructuras/resumen`, 
                    body: { rows: sheetToRows(sheet, RESUMEN_COLS) } 
                });
            }
        });

        try {
            const results = await Promise.all(
                reqs.map((r) =>
                    fetch(r.url, { method: 'PATCH', headers, body: JSON.stringify(r.body) })
                        .then((res) => ({ ok: res.ok, status: res.status })),
                ),
            );
            const bad = results.find((r) => !r.ok);
            if (bad) setSaveError(`Error ${bad.status} al guardar`);
            else setLastSaved(new Date());
        } catch (e: any) {
            setSaveError(e.message ?? 'Error de red');
        } finally {
            setSaving(false);
        }
    }, [project.id]);

    const scheduleSave = useCallback((sheets: any[]) => {
        latestSheets.current = sheets;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => doSave(latestSheets.current), SAVE_DEBOUNCE);
    }, [doSave]);

    // Sincronizar Resumen desde Metrado
    const handleSyncResumen = useCallback(() => {
        setIsSyncing(true);
        setTimeout(() => {
            const ls = (window as any).luckysheet;
            if (!ls) { setIsSyncing(false); return; }

            const all: any[] = ls.getAllSheets();
            let met: Record<string, any>[] = [];
            let resIdx = -1;

            all.forEach((sheet: any, idx: number) => {
                if (sheet.name === 'Metrado') {
                    met = sheetToRows(sheet, METRADO_COLS);
                } else if (sheet.name === 'Resumen') {
                    resIdx = idx;
                }
            });

            // Build resumen from metrado - take rows with descripcion
            const resumenData: Record<string, any>[] = [];
            met.forEach((row, idx) => {
                if (row.descripcion) {
                    resumenData.push({
                        item: idx + 1,
                        descripcion: row.descripcion,
                        und: row.und || '',
                        parcial: row.parcial || row.total || 0,
                        total: row.total || 0,
                    });
                }
            });

            if (resIdx !== -1 && resumenData.length > 0) {
                const sheetData = rowsToSheet(resumenData, RESUMEN_COLS, 'Resumen', resIdx);
                ls.setSheetData(sheetData, { order: resIdx });
            }

            setIsSyncing(false);
            scheduleSave(all);
        }, 100);
    }, [scheduleSave]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="flex h-full flex-col">
                {/* Header */}
                <header className="flex h-12 items-center justify-between border-b bg-white px-4 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
                            <a href={`/costos/${project.id}`}>
                                <ChevronLeft className="h-4 w-4" />
                                Volver
                            </a>
                        </Button>
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                        <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Metrado Estructuras
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <SaveStatus saving={saving} error={saveError} lastSaved={lastSaved} />
                        <Button
                            variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]"
                            onClick={handleSyncResumen} disabled={isSyncing}
                        >
                            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                            Sincronizar Resumen
                        </Button>
                    </div>
                </header>

                {/* Luckysheet */}
                <main className="relative flex-1 overflow-hidden">
                    <Luckysheet
                        data={initialSheets}
                        onDataChange={scheduleSave}
                        height="calc(100vh - 80px)"
                        options={{
                            title: 'Metrado Estructuras',
                            showinfobar: false,
                            sheetFormulaBar: true,
                            showstatisticBar: true,
                        }}
                    />
                </main>
            </div>
        </AppLayout>
    );
}

function SaveStatus({ saving, error, lastSaved }: {
    saving: boolean; error: string | null; lastSaved: Date | null;
}) {
    return (
        <div className="flex items-center rounded-full bg-slate-100/80 px-2.5 py-1 text-[10px] font-semibold dark:bg-gray-800/60">
            {saving ? (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> Guardando…
                </span>
            ) : error ? (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-2.5 w-2.5" /> {error}
                </span>
            ) : lastSaved ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {lastSaved.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </span>
            ) : (
                <span className="flex items-center gap-1 text-slate-400">
                    <Save className="h-2.5 w-2.5" /> Sin cambios
                </span>
            )}
        </div>
    );
}
