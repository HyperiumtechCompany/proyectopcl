// ═══════════════════════════════════════════════════════════════
// ImportarMetradoSanitariasModal.tsx
// Modal para importar metrados de sanitarias desde un archivo Excel
// ═══════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import {
    X, FileSpreadsheet, AlertCircle, Upload,
    CheckCircle2, Layers, TriangleAlert,
} from 'lucide-react';
import React, { useState, useCallback } from 'react';
import { toRoman } from './sanitarias_utils';

// ── Tipos exportados ───────────────────────────────────────────

export interface ImportedMetradoRow {
    partida:     string | null;
    descripcion: string | null;
    unidad:      string | null;
    elsim:       number | null;
    largo:       number | null;
    ancho:       number | null;
    alto:        number | null;
    nveces:      number | null;
    lon:         number | null;
    area:        number | null;
    vol:         number | null;
    kg:          number | null;
    und:         number | null;
    total:       number | null;
    observacion: string | null;
    _level:      number;
    _kind:       'group' | 'leaf';
    _dbid:       null;
    kgm:         null;
    _formula_key:    null;
    _formula_output: null;
    _formula_expr:   null;
    _formula_label:  null;
}

export interface ImportarMetradoSanitariasModalProps {
    open:             boolean;
    moduleCount:      number;
    activeSheetName?: string;
    onClose:          () => void;
    onImport:         (rows: ImportedMetradoRow[], targetSheet: string) => void;
}

type Step = 'select' | 'preview' | 'success';

// ── Helpers internos de parsing ────────────────────────────────

const toN = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
};

const norm = (v: any): string => String(v ?? '').trim().toLowerCase();

function normalizePartida(code: string): string {
    return code
        .split('.')
        .map((p) => {
            const stripped = p.trim().replace(/[^0-9]/g, '');
            const n = Number(stripped);
            return isNaN(n) ? p.trim() : String(n).padStart(2, '0');
        })
        .join('.');
}

// ── Parser principal ───────────────────────────────────────────
/**
 * Lee un archivo Excel con la estructura de metrado de estructuras:
 *  - Busca la fila que contenga "ITEM"/"Ítem" y "DESCRIPCIÓN"
 *  - La siguiente fila puede ser sub-cabecera (Largo, Ancho, Alto, Lon., Área…)
 *  - Mapea columnas dinámicamente por nombre
 */
function parseExcelMetrado(file: File): Promise<{
    rows: ImportedMetradoRow[];
    warnings: string[];
}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buf = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb  = XLSX.read(buf, { type: 'array' });

                let raw: any[][] = [];
                let h1 = -1;

                // ── 1. Localizar la fila de cabecera principal en todas las hojas ──────
                for (const sheetName of wb.SheetNames) {
                    const ws = wb.Sheets[sheetName];
                    const tempRaw: any[][] = XLSX.utils.sheet_to_json(ws, {
                        header: 1,
                        defval: null,
                        raw:    true,
                    });

                    for (let i = 0; i < Math.min(tempRaw.length, 100); i++) {
                        const r = tempRaw[i];
                        if (!r) continue;
                        const s = r.map(norm);
                        const hasItem = s.some((v) => {
                            const cv = v.replace(/\s+/g, '');
                            return cv.includes('item') || cv.includes('ítem');
                        });
                        const hasDesc = s.some((v) => v.includes('descripci'));
                        if (hasItem && hasDesc) { 
                            h1 = i; 
                            raw = tempRaw;
                            break; 
                        }
                    }
                    if (h1 !== -1) break;
                }

                const warnings: string[] = [];

                if (h1 === -1) {
                    throw new Error(
                        "No se detectó la cabecera del metrado. " +
                        "Verifique que el archivo tenga columnas 'ITEM' y 'DESCRIPCIÓN'."
                    );
                }

                // ── 2. Construir mapa de columnas ───────────────────
                const col: Record<string, number> = {};

                const mapSingleRow = (rowIdx: number) => {
                    const r = raw[rowIdx];
                    if (!r) return;
                    r.map(norm).forEach((v, idx) => {
                        // Limpiamos todos los espacios y saltos de línea para el match
                        const cv = v.replace(/\s+/g, '');

                        // ITEM / partida
                        if ((cv === 'item' || cv === 'ítem') && col.partida === undefined)
                            col.partida = idx;
                        // Descripción
                        if (cv.includes('descripci') && col.descripcion === undefined)
                            col.descripcion = idx;
                        // Unidad (primera aparición)
                        if ((cv === 'und' || cv === 'und.') && col.unidad === undefined)
                            col.unidad = idx;
                        // Elem.Simil.
                        if ((cv.startsWith('elem') || cv === 'simil.' || cv === 'simil' || cv === 'elemsimil') && col.elsim === undefined)
                            col.elsim = idx;
                        // Dimensiones
                        if (cv === 'largo'  && col.largo  === undefined) col.largo  = idx;
                        if (cv === 'ancho'  && col.ancho  === undefined) col.ancho  = idx;
                        if (cv === 'alto'   && col.alto   === undefined) col.alto   = idx;
                        // N° Veces — puede aparecer como "n° de veces", escrito verticalmente
                        if (
                            cv.includes('vece') &&
                            col.nveces === undefined
                        ) col.nveces = idx;
                        // Metrado — columnas de resultado
                        if ((cv === 'lon.'  || cv === 'lon')  && col.lon  === undefined) col.lon  = idx;
                        if ((cv === 'área'  || cv === 'area') && col.area === undefined) col.area = idx;
                        if ((cv === 'vol.'  || cv === 'vol')  && col.vol  === undefined) col.vol  = idx;
                        if ((cv === 'kg.'   || cv === 'kg')   && col.kg   === undefined) col.kg   = idx;
                        // "Und." parcial
                        if (
                            (cv === 'und.' || cv === 'und') &&
                            col.und === undefined &&
                            idx > (col.unidad ?? -1) + 3
                        ) col.und = idx;
                        // Total
                        if (cv === 'total' && col.total === undefined) col.total = idx;
                        // Observaciones
                        if (cv.includes('observ') && col.observacion === undefined) col.observacion = idx;
                        // Nivel
                        if ((cv === 'nivel' || cv === 'nível') && col.nivel === undefined) col.nivel = idx;
                    });
                };

                // Mapear cabecera principal y hasta 2 filas de sub-cabecera
                mapSingleRow(h1);
                if (h1 + 1 < raw.length) mapSingleRow(h1 + 1);
                if (h1 + 2 < raw.length && (col.largo === undefined || col.lon === undefined))
                    mapSingleRow(h1 + 2);

                if (col.partida === undefined || col.descripcion === undefined) {
                    throw new Error(
                        'No se pudieron identificar las columnas ITEM y DESCRIPCIÓN en las cabeceras.'
                    );
                }

                if (col.largo === undefined && col.ancho === undefined) {
                    warnings.push(
                        'No se detectaron las columnas de dimensiones (Largo, Ancho, Alto). ' +
                        'Solo se importarán Ítem, Descripción, Unidad y Total.'
                    );
                }

                // ── 3. Determinar inicio de datos ───────────────────
                // Saltamos las filas de sub-cabecera (aquellas que tengan "Largo", "Lon.", etc.)
                let dataStart = h1 + 1;
                for (let extra = 1; extra <= 2; extra++) {
                    const peek = raw[h1 + extra];
                    if (!peek) break;
                    const s = peek.map(norm);
                    if (
                        s.some((v) =>
                            v === 'largo' || v === 'ancho' || v === 'alto' ||
                            v === 'lon.'  || v === 'vol.'  || v === 'área' || v === 'area'
                        )
                    ) {
                        dataStart = h1 + extra + 1;
                    }
                }

                // ── 4. Parsear filas de datos ───────────────────────
                const rows: ImportedMetradoRow[] = [];
                let currentLevel = 1;

                for (let i = dataStart; i < raw.length; i++) {
                    const r = raw[i];
                    if (!r) continue;

                    // Saltar filas completamente vacías
                    if (r.every((v: any) => v === null || v === undefined || String(v).trim() === ''))
                        continue;

                    const itemRaw = col.partida    !== undefined ? String(r[col.partida]    ?? '').trim() : '';
                    const descRaw = col.descripcion !== undefined ? String(r[col.descripcion] ?? '').trim() : '';

                    if (!itemRaw && !descRaw) continue;

                    // ¿Es fila de grupo (tiene código numérico) o hoja de cálculo?
                    const hasCode = itemRaw !== '' && /^\d/.test(itemRaw);
                    const kind: 'group' | 'leaf' = hasCode ? 'group' : 'leaf';

                    // Determinar nivel
                    let level = currentLevel;
                    if (col.nivel !== undefined && r[col.nivel] != null) {
                        const n = toN(r[col.nivel]);
                        if (n > 0) level = Math.min(10, n);
                    } else if (hasCode) {
                        level = Math.min(10, itemRaw.split('.').length);
                    }
                    if (kind === 'group') currentLevel = level;

                    // Helpers locales
                    const getNum = (key: string): number | null => {
                        if (col[key] === undefined) return null;
                        const v = r[col[key]];
                        if (v === null || v === undefined || String(v).trim() === '') return null;
                        const n = toN(v);
                        return n !== 0 ? n : null;
                    };
                    const getTxt = (key: string): string | null => {
                        if (col[key] === undefined) return null;
                        const v = String(r[col[key]] ?? '').trim();
                        return v || null;
                    };

                    rows.push({
                        partida:     hasCode ? normalizePartida(itemRaw) : null,
                        descripcion: descRaw || null,
                        unidad:      getTxt('unidad'),
                        elsim:       getNum('elsim'),
                        largo:       getNum('largo'),
                        ancho:       getNum('ancho'),
                        alto:        getNum('alto'),
                        nveces:      getNum('nveces'),
                        lon:         getNum('lon'),
                        area:        getNum('area'),
                        vol:         getNum('vol'),
                        kg:          getNum('kg'),
                        und:         getNum('und'),
                        total:       getNum('total'),
                        observacion: getTxt('observacion'),
                        _level:      level,
                        _kind:       kind,
                        _dbid:       null,
                        kgm:         null,
                        _formula_key:    null,
                        _formula_output: null,
                        _formula_expr:   null,
                        _formula_label:  null,
                    });
                }

                if (rows.length === 0) {
                    throw new Error(
                        'No se encontraron filas de datos válidas. ' +
                        'Verifique que el archivo tenga el formato correcto de metrado.'
                    );
                }

                resolve({ rows, warnings });
            } catch (err: any) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
}

// ── Componente Principal ───────────────────────────────────────

export function ImportarMetradoSanitariasModal({
    open,
    moduleCount,
    activeSheetName,
    onClose,
    onImport,
}: ImportarMetradoSanitariasModalProps) {
    const [step, setStep]           = useState<Step>('select');
    const [file, setFile]           = useState<File | null>(null);
    const [rows, setRows]           = useState<ImportedMetradoRow[]>([]);
    const [warnings, setWarnings]   = useState<string[]>([]);
    const [targetSheet, setTarget]  = useState<string>(() =>
        activeSheetName && activeSheetName !== 'Resumen' ? activeSheetName : 'Módulo 1'
    );
    const [error, setError]         = useState<string | null>(null);
    const [isLoading, setLoading]   = useState(false);
    const [isDragging, setDragging] = useState(false);

    // Hojas disponibles
    const sheetOptions = [
        ...Array.from({ length: moduleCount }, (_, i) => `Módulo ${i + 1}`),
        'Exterior',
        'Cisterna',
    ];

    const reset = useCallback(() => {
        setStep('select');
        setFile(null);
        setRows([]);
        setWarnings([]);
        setError(null);
        setLoading(false);
        setDragging(false);
    }, []);

    const handleClose = () => { reset(); onClose(); };

    // Procesar archivo elegido
    const processFile = async (f: File) => {
        setFile(f);
        setLoading(true);
        setError(null);
        try {
            const { rows: parsed, warnings: w } = await parseExcelMetrado(f);
            setRows(parsed);
            setWarnings(w);
            setStep('preview');
        } catch (err: any) {
            setError(err.message ?? 'Error al procesar el archivo.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) processFile(f);
        e.target.value = ''; // reset para permitir re-selección del mismo archivo
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (!f) return;
        if (!f.name.match(/\.(xls|xlsx)$/i)) {
            setError('Solo se aceptan archivos .xlsx o .xls');
            return;
        }
        processFile(f);
    };

    const handleConfirm = () => {
        setLoading(true);
        setError(null);
        setTimeout(() => {
            try {
                onImport(rows, targetSheet);
                setStep('success');
            } catch (err: any) {
                setError(err.message ?? 'Error al aplicar los datos.');
            } finally {
                setLoading(false);
            }
        }, 100);
    };

    if (!open) return null;

    // Estadísticas de la vista previa
    const groupCount  = rows.filter((r) => r._kind === 'group').length;
    const leafCount   = rows.filter((r) => r._kind === 'leaf').length;
    const withTotal   = rows.filter((r) => r.total !== null).length;

    // Nombres de hojas legibles
    const sheetLabel = (name: string) => {
        if (name === 'Exterior' || name === 'Cisterna') return name;
        const m = name.match(/Módulo (\d+)/);
        return m ? `Módulo ${toRoman(Number(m[1]))}` : name;
    };

    // Indicador de paso
    const stepIndex: Record<Step, number> = { select: 0, preview: 1, success: 2 };
    const currentStepIdx = stepIndex[step];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[92vh]">

                {/* ── Cabecera del modal ─────────────────────────── */}
                <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-800/70 px-5 py-3.5">
                    <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-100">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                        Importar Metrados Sanitarias desde Excel
                    </h3>
                    <button
                        onClick={handleClose}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Indicadores de paso ────────────────────────── */}
                <div className="flex items-center gap-1 border-b border-slate-700/40 bg-slate-800/30 px-5 py-2">
                    {(['Seleccionar', 'Vista previa', 'Listo'] as const).map((label, idx) => {
                        const isActive = currentStepIdx === idx;
                        const isDone   = currentStepIdx > idx;
                        return (
                            <React.Fragment key={label}>
                                <div className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-bold transition-all ${
                                    isActive ? 'bg-emerald-500/15 text-emerald-300' :
                                    isDone   ? 'text-slate-400'                    : 'text-slate-600'
                                }`}>
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                                        isActive ? 'bg-emerald-500 text-white'   :
                                        isDone   ? 'bg-slate-600 text-slate-300' : 'bg-slate-700 text-slate-500'
                                    }`}>
                                        {isDone ? '✓' : idx + 1}
                                    </span>
                                    {label}
                                </div>
                                {idx < 2 && <span className="text-slate-700">›</span>}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* ── Cuerpo del modal ───────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5">

                    {/* ══ STEP: SELECCIONAR ══════════════════════════ */}
                    {step === 'select' && (
                        <div className="flex flex-col gap-5">

                            {/* Selector de hoja destino */}
                            <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    1 · Hoja de destino
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {sheetOptions.map((name) => (
                                        <button
                                            key={name}
                                            onClick={() => setTarget(name)}
                                            className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                                targetSheet === name
                                                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-500/20'
                                                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {sheetLabel(name)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Zona de carga de archivo (drop zone) */}
                            <div>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    2 · Archivo Excel
                                </p>
                                <label
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleDrop}
                                    className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-10 transition-all ${
                                        isDragging
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-slate-700 bg-slate-800/20 hover:border-slate-500 hover:bg-slate-800/40'
                                    } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
                                >
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-700/40 bg-emerald-900/30">
                                        {isLoading ? (
                                            <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                                        ) : (
                                            <Upload className="h-7 w-7 text-emerald-400" />
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] font-semibold text-slate-300">
                                            {isLoading ? 'Procesando archivo…' : 'Arrastre el archivo aquí o haga clic'}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            Archivos .xlsx y .xls · Formato Metrado de Sanitarias
                                        </p>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".xls,.xlsx"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>

                            {/* Advertencia de reemplazo */}
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-800/40 bg-amber-950/30 p-3">
                                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                <p className="text-[11px] text-amber-300/80">
                                    <strong className="text-amber-300">Reemplazo total:</strong>{' '}
                                    Los datos actuales de la hoja{' '}
                                    <strong className="text-amber-200">"{sheetLabel(targetSheet)}"</strong>{' '}
                                    serán completamente reemplazados por los del archivo Excel.
                                </p>
                            </div>

                            {/* Referencia de columnas esperadas */}
                            <details className="rounded-lg border border-slate-700/50 bg-slate-800/20">
                                <summary className="cursor-pointer px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                                    Ver formato esperado del Excel
                                </summary>
                                <div className="overflow-x-auto px-3 pb-3 pt-1">
                                    <table className="text-[9px]">
                                        <thead>
                                            <tr className="text-slate-500">
                                                {['Nivel', 'ITEM', 'DESCRIPCIÓN', 'Und', 'Elem.', 'Simil.', 'Largo', 'Ancho', 'Alto', 'N° Veces', 'Lon.', 'Área', 'Vol.', 'Kg.', 'Und.', 'Total'].map((h) => (
                                                    <th key={h} className="border border-slate-700/50 px-2 py-1 text-left font-bold">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-violet-400 font-semibold">
                                                <td className="border border-slate-700/50 px-2 py-1 text-center">1</td>
                                                <td className="border border-slate-700/50 px-2 py-1">03</td>
                                                <td className="border border-slate-700/50 px-2 py-1">SANITARIAS</td>
                                                {Array(13).fill(0).map((_, i) => <td key={i} className="border border-slate-700/50 px-2 py-1" />)}
                                            </tr>
                                            <tr className="text-sky-400">
                                                <td className="border border-slate-700/50 px-2 py-1 text-center" />
                                                <td className="border border-slate-700/50 px-2 py-1" />
                                                <td className="border border-slate-700/50 px-2 py-1 text-slate-300">Zapata Z-1</td>
                                                <td className="border border-slate-700/50 px-2 py-1">m3</td>
                                                <td className="border border-slate-700/50 px-2 py-1">1</td>
                                                <td className="border border-slate-700/50 px-2 py-1" />
                                                <td className="border border-slate-700/50 px-2 py-1">1.20</td>
                                                <td className="border border-slate-700/50 px-2 py-1">1.20</td>
                                                <td className="border border-slate-700/50 px-2 py-1">0.60</td>
                                                <td className="border border-slate-700/50 px-2 py-1">4</td>
                                                <td className="border border-slate-700/50 px-2 py-1" />
                                                <td className="border border-slate-700/50 px-2 py-1" />
                                                <td className="border border-slate-700/50 px-2 py-1">3.46</td>
                                                <td className="border border-slate-700/50 px-2 py-1" />
                                                <td className="border border-slate-700/50 px-2 py-1" />
                                                <td className="border border-slate-700/50 px-2 py-1 text-emerald-300">3.46</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </details>

                            {error && (
                                <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-[11px] text-red-400">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ STEP: VISTA PREVIA ═════════════════════════ */}
                    {step === 'preview' && (
                        <div className="flex flex-col gap-4">

                            {/* Estadísticas */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Total Filas',    value: rows.length,  color: 'text-slate-200',  bg: 'bg-slate-800/60'  },
                                    { label: 'Grupos',          value: groupCount,   color: 'text-violet-400', bg: 'bg-violet-950/30' },
                                    { label: 'Hojas de cálc.', value: leafCount,    color: 'text-sky-400',    bg: 'bg-sky-950/30'    },
                                    { label: 'Con Total',       value: withTotal,    color: 'text-emerald-400', bg: 'bg-emerald-950/30' },
                                ].map(({ label, value, color, bg }) => (
                                    <div key={label} className={`rounded-lg border border-slate-700/40 ${bg} p-3 text-center`}>
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                                        <div className={`text-xl font-black ${color}`}>{value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Info: hoja destino + archivo */}
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-3 py-2">
                                <Layers className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                <span className="text-[11px] text-emerald-300/80">
                                    Destino:{' '}
                                    <strong className="text-emerald-300">{sheetLabel(targetSheet)}</strong>
                                    {' · '}
                                    <span className="text-slate-400">{file?.name}</span>
                                </span>
                            </div>

                            {/* Advertencias del parser */}
                            {warnings.length > 0 && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-800/40 bg-amber-950/30 p-3">
                                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                    <div className="flex flex-col gap-0.5">
                                        {warnings.map((w, i) => (
                                            <p key={i} className="text-[11px] text-amber-300">{w}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-[11px] text-red-400">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Tabla de vista previa */}
                            <div className="overflow-auto rounded-lg border border-slate-700 bg-slate-950/40" style={{ maxHeight: '42vh' }}>
                                <table className="w-full text-[10px]">
                                    <thead className="sticky top-0 z-10 border-b border-slate-700 bg-slate-800/95 shadow-sm">
                                        <tr>
                                            <th className="w-8  px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-500">#</th>
                                            <th className="w-20 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-400">Ítem</th>
                                            <th className="px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-400">Descripción</th>
                                            <th className="w-12 px-2 py-2 text-center font-bold uppercase tracking-wider text-slate-400">Und</th>
                                            <th className="w-12 px-2 py-2 text-center font-bold uppercase tracking-wider text-slate-400">Elsim</th>
                                            <th className="w-32 px-2 py-2 text-center font-bold uppercase tracking-wider text-slate-400">L × A × H</th>
                                            <th className="w-10 px-2 py-2 text-center font-bold uppercase tracking-wider text-slate-400">N°V</th>
                                            <th className="w-18 px-2 py-2 text-right font-bold uppercase tracking-wider text-slate-400">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => {
                                            const isGroup = row._kind === 'group';
                                            const dims = [row.largo, row.ancho, row.alto]
                                                .filter((v) => v != null)
                                                .map((v) => String(v))
                                                .join(' × ') || '—';
                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`border-b border-slate-800/50 transition-colors ${
                                                        isGroup
                                                            ? 'bg-violet-950/20 font-semibold'
                                                            : 'hover:bg-slate-800/30'
                                                    }`}
                                                >
                                                    <td className="px-2 py-1 tabular-nums text-slate-600">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-2 py-1 font-mono tabular-nums text-emerald-400">
                                                        {row.partida ?? <span className="text-slate-700">—</span>}
                                                    </td>
                                                    <td
                                                        className={`px-2 py-1 ${
                                                            isGroup
                                                                ? 'text-[9px] uppercase text-violet-300'
                                                                : 'text-slate-300'
                                                        }`}
                                                        style={{ paddingLeft: `${8 + (row._level - 1) * 10}px` }}
                                                    >
                                                        {row.descripcion ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-center text-slate-400">
                                                        {row.unidad ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-center tabular-nums text-slate-400">
                                                        {row.elsim ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-center tabular-nums text-slate-500">
                                                        {dims}
                                                    </td>
                                                    <td className="px-2 py-1 text-center tabular-nums text-slate-400">
                                                        {row.nveces ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-right font-bold tabular-nums text-emerald-300">
                                                        {row.total != null
                                                            ? row.total.toLocaleString('es-PE', {
                                                                  minimumFractionDigits: 2,
                                                                  maximumFractionDigits: 2,
                                                              })
                                                            : <span className="text-slate-700">—</span>
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ══ STEP: ÉXITO ════════════════════════════════ */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center gap-5 py-10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-700/40 bg-emerald-900/30">
                                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-base font-bold text-slate-200">¡Importación exitosa!</p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    <strong className="text-emerald-400">{rows.length}</strong> filas importadas
                                    en la hoja{' '}
                                    <strong className="text-emerald-300">{sheetLabel(targetSheet)}</strong>
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                    {groupCount} grupos · {leafCount} hojas de cálculo
                                    {withTotal > 0 && ` · ${withTotal} con total`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Pie del modal ──────────────────────────────── */}
                <div className="flex items-center justify-between border-t border-slate-700/50 bg-slate-800/40 px-5 py-3">
                    <div className="text-[10px] text-slate-500">
                        {step === 'preview' && `${rows.length} filas · ${file?.name}`}
                        {step === 'select'  && 'Formatos soportados: .xlsx  .xls'}
                    </div>
                    <div className="flex items-center gap-2">
                        {step === 'select' && (
                            <button
                                onClick={handleClose}
                                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200"
                            >
                                Cancelar
                            </button>
                        )}
                        {step === 'preview' && (
                            <>
                                <button
                                    onClick={() => { setStep('select'); setRows([]); setFile(null); setError(null); }}
                                    className="rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200"
                                >
                                    ← Atrás
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                                    ) : (
                                        <FileSpreadsheet className="h-3 w-3" />
                                    )}
                                    {isLoading ? 'Importando...' : `Importar ${rows.length} filas → ${sheetLabel(targetSheet)}`}
                                </button>
                            </>
                        )}
                        {step === 'success' && (
                            <button
                                onClick={handleClose}
                                className="rounded-md bg-slate-700 px-4 py-1.5 text-[11px] font-bold text-slate-200 transition-all hover:bg-slate-600"
                            >
                                Cerrar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
