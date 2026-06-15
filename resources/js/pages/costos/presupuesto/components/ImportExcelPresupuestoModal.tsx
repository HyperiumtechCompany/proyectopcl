import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, AlertCircle, Upload, Eye, CheckCircle } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { useBudgetStore, type BudgetItemRow } from '../stores/budgetStore';

interface ImportExcelPresupuestoModalProps {
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type ParsedRow = BudgetItemRow & { _rawCode: string };

function normalizeCode(code: string | number): string {
    const str = String(code).trim();
    const parts = str.split('.');
    return parts.map(p => p.replace(/[a-zA-Z]+$/, '').padStart(2, '0')).join('.');
}

function detectTipoFila(level: number, hasUnidad: boolean): 'titulo' | 'subtitulo' | 'partida' {
    if (hasUnidad) return 'partida';
    if (level === 0) return 'titulo';
    return 'subtitulo';
}

function parseExcelFile(file: File): Promise<ParsedRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

                const parsed: ParsedRow[] = [];

                for (let i = 9; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row[0] === null || row[0] === undefined) continue;

                    const rawCode = String(row[0]).trim();
                    if (!/^\d/.test(rawCode)) continue;

                    const descripcion = row[2] ? String(row[2]).trim() : '';
                    if (!descripcion) continue;

                    const rawUnidad = (row[9] != null && String(row[9]).trim() !== '')
                        ? String(row[9]).trim()
                        : '';
                    const unidad = rawUnidad
                        .replace(/m2/g, 'm²')
                        .replace(/m3/g, 'm³');
                    const hasUnidad = unidad !== '';

                    const metrado = (row[10] != null && row[10] !== '') ? Number(row[10]) : 0;
                    const precioUnitario = (row[12] != null && row[12] !== '') ? Number(row[12]) : 0;
                    const parcial = hasUnidad
                        ? (metrado * precioUnitario)
                        : ((row[13] != null && row[13] !== '') ? Number(row[13]) : (row[15] != null && row[15] !== '') ? Number(row[15]) : 0);

                    const partida = normalizeCode(rawCode);
                    const level = (partida.match(/\./g) || []).length;
                    const tipo_fila = detectTipoFila(level, hasUnidad);

                    parsed.push({
                        partida,
                        descripcion,
                        unidad: hasUnidad ? unidad : '',
                        metrado,
                        precio_unitario: precioUnitario,
                        parcial,
                        metrado_source: null,
                        tipo_fila,
                        _rawCode: rawCode,
                    });
                }

                // Deduplicate: keep the row with the highest `parcial` for each code
                const bestByCode = new Map<string, ParsedRow>();
                for (const r of parsed) {
                    const existing = bestByCode.get(r.partida);
                    if (!existing || r.parcial > existing.parcial) {
                        bestByCode.set(r.partida, r);
                    }
                }
                const deduped = [...bestByCode.values()];

                resolve(deduped);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

export const ImportExcelPresupuestoModal: React.FC<ImportExcelPresupuestoModalProps> = ({
    projectId,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'select' | 'preview' | 'success'>('select');
    const [stats, setStats] = useState<{ total: number; titulos: number; partidas: number; newRows: number; updatedRows: number } | null>(null);

    const reset = useCallback(() => {
        setFile(null);
        setParsedRows([]);
        setIsLoading(false);
        setIsImporting(false);
        setError(null);
        setStep('select');
        setStats(null);
    }, []);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setFile(selected);
        setIsLoading(true);
        setError(null);

        try {
            const rows = await parseExcelFile(selected);
            if (rows.length === 0) {
                setError('No se encontraron filas válidas en el archivo. Asegúrese de que el archivo tenga la estructura correcta.');
                setIsLoading(false);
                return;
            }
            setParsedRows(rows);
            setStep('preview');
        } catch (err: any) {
            setError('Error al leer el archivo: ' + (err.message || 'Formato no soportado'));
        } finally {
            setIsLoading(false);
        }
    };

    const existingCodesForPreview = useMemo(() => {
        const currentRows = useBudgetStore.getState().rows.map(r => ({
            ...r,
            partida: r.partida.split('.').map(s => s.replace(/[a-zA-Z]+$/, '').padStart(2, '0')).join('.'),
        }));
        return new Set(currentRows.map(r => r.partida));
    }, [parsedRows]);

    const statsMemo = useMemo(() => {
        if (parsedRows.length === 0) return null;
        const titulos = parsedRows.filter(r => r.tipo_fila === 'titulo' || r.tipo_fila === 'subtitulo').length;
        const partidas = parsedRows.filter(r => r.tipo_fila === 'partida').length;
        const newRows = parsedRows.filter(r => !existingCodesForPreview.has(r.partida)).length;
        const updatedRows = parsedRows.filter(r => existingCodesForPreview.has(r.partida)).length;
        return { total: parsedRows.length, titulos, partidas, newRows, updatedRows };
    }, [parsedRows, existingCodesForPreview]);

    const handleImport = async () => {
        if (parsedRows.length === 0) return;
        setIsImporting(true);
        setError(null);

        try {
            const rawRows = useBudgetStore.getState().rows;
            const currentRows = rawRows.map(r => ({
                ...r,
                partida: r.partida.split('.').map(s => s.replace(/[a-zA-Z]+$/, '').padStart(2, '0')).join('.'),
            }));
            const existingMap = new Map(currentRows.map(r => [r.partida, r]));

            const merged = [...currentRows];

            for (const parsedRow of parsedRows) {
                const { _rawCode, ...cleanRow } = parsedRow;
                const existing = existingMap.get(parsedRow.partida);

                if (existing) {
                    const idx = merged.findIndex(r => r.partida === parsedRow.partida);
                    if (idx >= 0) {
                        merged[idx] = {
                            ...existing,
                            descripcion: cleanRow.descripcion,
                            unidad: cleanRow.unidad,
                            metrado: cleanRow.metrado,
                            precio_unitario: cleanRow.precio_unitario,
                            tipo_fila: cleanRow.tipo_fila,
                        };
                    }
                } else {
                    merged.push({
                        ...cleanRow,
                        id: undefined,
                    });
                }
            }

            useBudgetStore.getState().initialize(merged);

            const saveRows = useBudgetStore.getState().rows.map((row) => {
                const { _level, _parentId, _expanded, _hasChildren, _index, ...rest } = row as any;
                return rest;
            });

            const response = await fetch(`/costos/proyectos/${projectId}/presupuesto/general`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ rows: saveRows }),
            });

            if (!response.ok) {
                throw new Error('Error al guardar en el servidor');
            }

            setStats(statsMemo);
            setStep('success');
        } catch (err: any) {
            setError('Error al importar: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/50 px-5 py-4">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                        Importar Excel Presupuesto
                    </h3>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                    {/* Step: Select File */}
                    {step === 'select' && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                                <Upload className="h-10 w-10 text-emerald-400" />
                            </div>
                            <p className="text-sm text-slate-300 text-center max-w-md">
                                Seleccione un archivo Excel (.xls o .xlsx) con la estructura de presupuesto jerárquico.
                                Las columnas esperadas son: <span className="text-emerald-300 font-medium">Item, Descripción, Unid., Cant., Precio, Parcial</span>.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-sm text-red-400 border border-red-800 w-full max-w-md">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <label className="cursor-pointer rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                                {isLoading ? 'Procesando...' : 'Seleccionar Archivo'}
                                <input
                                    type="file"
                                    accept=".xls,.xlsx"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    disabled={isLoading}
                                />
                            </label>

                            {file && isLoading && (
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                                    Parseando archivo...
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step: Preview */}
                    {step === 'preview' && (
                        <div className="flex flex-col gap-4">
                            {/* Stats */}
                            {statsMemo && (
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50">
                                        <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Total Filas</div>
                                        <div className="text-xl font-bold text-slate-200">{statsMemo.total}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50">
                                        <div className="text-[10px] font-bold tracking-wider text-amber-500 uppercase">Títulos</div>
                                        <div className="text-xl font-bold text-amber-400">{statsMemo.titulos}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50">
                                        <div className="text-[10px] font-bold tracking-wider text-sky-400 uppercase">Partidas</div>
                                        <div className="text-xl font-bold text-sky-400">{statsMemo.partidas}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50">
                                        <div className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">Nuevas</div>
                                        <div className="text-xl font-bold text-emerald-400">{statsMemo.newRows}</div>
                                    </div>
                                </div>
                            )}

                            {statsMemo && statsMemo.updatedRows > 0 && (
                                <div className="flex items-center gap-2 rounded bg-amber-900/30 p-2.5 text-xs text-amber-300 border border-amber-800/50">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{statsMemo.updatedRows} fila(s) con código existente serán actualizadas con los datos del Excel.</span>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-sm text-red-400 border border-red-800">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Eye className="h-3.5 w-3.5" />
                                <span>Vista previa — {parsedRows.length} filas detectadas del archivo: <span className="text-slate-200 font-medium">{file?.name}</span></span>
                            </div>

                            {/* Preview Table */}
                            <div className="overflow-auto rounded-lg border border-slate-700 bg-slate-900/40 max-h-[45vh]">
                                <table className="w-full text-[10px]">
                                    <thead className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
                                        <tr>
                                            <th className="px-2 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">Código</th>
                                            <th className="px-2 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">Descripción</th>
                                            <th className="px-2 py-2 text-center font-bold text-slate-400 uppercase tracking-wider w-14">Tipo</th>
                                            <th className="px-2 py-2 text-center font-bold text-slate-400 uppercase tracking-wider w-14">Und.</th>
                                            <th className="px-2 py-2 text-right font-bold text-slate-400 uppercase tracking-wider w-16">Cant.</th>
                                            <th className="px-2 py-2 text-right font-bold text-slate-400 uppercase tracking-wider w-20">Precio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.map((row, idx) => {
                                            const isTitulo = row.tipo_fila === 'titulo' || row.tipo_fila === 'subtitulo';
                                            const level = (row.partida.match(/\./g) || []).length;
                                            const isNew = statsMemo ? !existingCodesForPreview.has(row.partida) : true;
                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`border-b border-slate-800/50 transition-colors ${
                                                        isTitulo ? 'bg-amber-950/20 font-semibold' : 'hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    <td className={`px-2 py-1 text-emerald-400 font-mono ${isNew ? '' : 'text-amber-400'}`} style={{ paddingLeft: `${8 + level * 12}px` }}>
                                                        {row.partida}
                                                    </td>
                                                    <td className={`px-2 py-1 ${isTitulo ? 'text-amber-200 uppercase text-[10px]' : 'text-slate-300'}`}>
                                                        {row.descripcion.length > 60 ? row.descripcion.substring(0, 60) + '...' : row.descripcion}
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        {isTitulo ? (
                                                            <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-300 font-bold">
                                                                {row.tipo_fila === 'titulo' ? 'T' : 'ST'}
                                                            </span>
                                                        ) : (
                                                            <span className="rounded bg-sky-900/40 px-1.5 py-0.5 text-sky-300 font-bold">P</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1 text-center text-slate-400">
                                                        {row.unidad || '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-slate-300 tabular-nums">
                                                        {row.metrado || '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-slate-300 tabular-nums">
                                                        {row.precio_unitario || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Change file */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setStep('select'); setParsedRows([]); setFile(null); setError(null); }}
                                    className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                                >
                                    Cambiar archivo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Success */}
                    {step === 'success' && stats && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                                <CheckCircle className="h-10 w-10 text-emerald-400" />
                            </div>
                            <p className="text-sm text-slate-300 text-center">
                                Se importaron <span className="font-bold text-emerald-400">{stats.total}</span> filas correctamente
                                ({stats.titulos} títulos, {stats.partidas} partidas).
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/50 p-4">
                    {step === 'preview' && (
                        <>
                            <button
                                onClick={handleClose}
                                disabled={isImporting}
                                className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={isImporting || parsedRows.length === 0}
                                className="flex items-center gap-2 rounded bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500"
                            >
                                {isImporting ? (
                                    <>
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet size={14} />
                                        Importar {parsedRows.length} Filas
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    {step === 'success' && (
                        <button
                            onClick={() => {
                                onSuccess();
                                handleClose();
                            }}
                            className="rounded bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
                        >
                            Continuar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};