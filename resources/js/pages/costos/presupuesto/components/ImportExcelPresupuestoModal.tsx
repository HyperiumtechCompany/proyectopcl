import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, AlertCircle, Upload, Eye, CheckCircle } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
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
    // Eliminar puntos finales y separar
    const parts = str.split('.').filter(p => p.trim() !== '');
    // Rellenar con ceros a la izquierda para tener siempre al menos 2 dígitos (ej. "1" -> "01")
    return parts.map(p => p.replace(/[a-zA-Z]+$/, '').padStart(2, '0')).join('.');
}

function parseNum(val: any): number {
    if (val == null || val === '') return 0;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/,/g, '').trim();
    const n = Number(s);
    return isNaN(n) ? 0 : n;
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

                let colItem = -1, colDesc = -1, colUnidad = -1, colMetrado = -1, colPrecio = -1, colParcial = -1;
                let startRow = -1;

                // 1. Detectar cabeceras dinámicamente escaneando las primeras filas
                for (let i = 0; i < Math.min(rows.length, 50); i++) {
                    const row = rows[i];
                    if (!row || !Array.isArray(row)) continue;

                    const strRow = row.map(v => String(v || '').trim().toLowerCase());
                    const itemIdx = strRow.findIndex(v => v === 'item' || v === 'ítem');
                    const descIdx = strRow.findIndex(v => v.includes('descripci'));

                    if (itemIdx !== -1 && descIdx !== -1) {
                        colItem = itemIdx;
                        colDesc = descIdx;
                        
                        colUnidad = strRow.findIndex(v => v === 'und.' || v === 'und' || v === 'unidad');
                        colMetrado = strRow.findIndex(v => v.includes('metrado') || v.includes('cant'));
                        colPrecio = strRow.findIndex(v => v.includes('precio') || v.includes('unit') || v.includes('p. unit'));
                        colParcial = strRow.findIndex(v => v.includes('parcial') || v.includes('total'));
                        
                        startRow = i + 1;
                        break;
                    }
                }

                if (startRow === -1 || colItem === -1 || colDesc === -1) {
                    throw new Error("No se pudo detectar la cabecera del presupuesto (Columnas 'Item' y 'Descripción').");
                }

                // 2. Extraer datos respetando jerarquías
                for (let i = startRow; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row[colItem] == null || String(row[colItem]).trim() === '') continue;

                    const rawCode = String(row[colItem]).trim();
                    if (!/^\d/.test(rawCode)) continue; // Solo procesar si el item empieza con un número

                    const descripcion = row[colDesc] ? String(row[colDesc]).trim() : '';
                    if (!descripcion) continue;

                    let unidad = '';
                    if (colUnidad !== -1 && row[colUnidad] != null) {
                        unidad = String(row[colUnidad]).trim().replace(/m2/g, 'm²').replace(/m3/g, 'm³');
                    }

                    const metrado = colMetrado !== -1 ? parseNum(row[colMetrado]) : 0;
                    const precioUnitario = colPrecio !== -1 ? parseNum(row[colPrecio]) : 0;
                    
                    let parcial = colParcial !== -1 ? parseNum(row[colParcial]) : 0;

                    // Fallback: Si el exportador desplazó el parcial por combinación de celdas
                    if (parcial === 0 && colParcial !== -1) {
                        for (let offset = 1; offset <= 3; offset++) {
                            const p = parseNum(row[colParcial + offset]);
                            if (p > 0) {
                                parcial = p;
                                break;
                            }
                        }
                    }

                    // Autocalcular si no hay parcial pero hay precio y metrado
                    if (parcial === 0 && metrado > 0 && precioUnitario > 0) {
                        parcial = metrado * precioUnitario;
                    }

                    const partida = normalizeCode(rawCode);
                    const level = (partida.match(/\./g) || []).length;
                    
                    // Lógica estricta de detección de tipo de fila
                    const isPartida = unidad !== '' || (metrado > 0 && precioUnitario > 0) || precioUnitario > 0;
                    const tipo_fila = isPartida ? 'partida' : (level === 0 ? 'titulo' : 'subtitulo');

                    parsed.push({
                        partida,
                        descripcion,
                        unidad: tipo_fila === 'partida' ? (unidad || 'glb') : '',
                        metrado: tipo_fila === 'partida' ? metrado : 0,
                        precio_unitario: tipo_fila === 'partida' ? precioUnitario : 0,
                        parcial,
                        metrado_source: null,
                        tipo_fila,
                        _rawCode: rawCode,
                    });
                }

                // 3. Filtrar y ordenar asegurando la jerarquía pura
                const bestByCode = new Map<string, ParsedRow>();
                for (const r of parsed) {
                    const existing = bestByCode.get(r.partida);
                    if (!existing || r.parcial > existing.parcial) {
                        bestByCode.set(r.partida, r);
                    }
                }
                
                const finalRows = Array.from(bestByCode.values()).sort((a, b) => {
                    return a.partida.localeCompare(b.partida, undefined, { numeric: true });
                });

                resolve(finalRows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo Excel'));
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
    const [stats, setStats] = useState<{ total: number; titulos: number; partidas: number } | null>(null);

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
                setError('No se encontraron filas válidas. Verifique que el archivo tenga la estructura correcta.');
                setIsLoading(false);
                return;
            }
            setParsedRows(rows);
            setStats({
                total: rows.length,
                titulos: rows.filter(r => r.tipo_fila === 'titulo' || r.tipo_fila === 'subtitulo').length,
                partidas: rows.filter(r => r.tipo_fila === 'partida').length
            });
            setStep('preview');
        } catch (err: any) {
            setError('Error al parsear el archivo: ' + (err.message || 'Formato inválido'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (parsedRows.length === 0) return;
        setIsImporting(true);
        setError(null);

        try {
            // Reemplazo total: creamos el nuevo estado basado exclusivamente en el Excel
            const newRows = parsedRows.map(({ _rawCode, ...cleanRow }) => ({
                ...cleanRow,
                id: undefined, // Se crearán nuevos registros
            }));

            // Sobrescribir en el store local para calcular jerarquías
            useBudgetStore.getState().initialize(newRows);

            // Extraer las filas limpias para enviarlas al backend
            const saveRows = useBudgetStore.getState().rows.map((row) => {
                const { _level, _parentId, _expanded, _hasChildren, _index, ...rest } = row as any;
                return rest;
            });

            const response = await axios.patch(`/costos/proyectos/${projectId}/presupuesto/general`, {
                rows: saveRows
            });

            if (response.data && response.data.success === false) {
                 throw new Error(response.data.message || 'Error al guardar en el servidor');
            }

            setStep('success');
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error desconocido';
            setError('Error al importar: ' + errorMsg);
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/50 px-5 py-4">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                        Importar Presupuesto desde Excel (Reemplazo Total)
                    </h3>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                    {step === 'select' && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                                <Upload className="h-10 w-10 text-emerald-400" />
                            </div>
                            <p className="text-sm text-slate-300 text-center max-w-md">
                                Seleccione su presupuesto exportado en Excel (.xls, .xlsx). 
                                <br/><br/>
                                <strong className="text-red-400">Atención:</strong> Esta acción reemplazará completamente la estructura actual del presupuesto por la del archivo.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-sm text-red-400 border border-red-800 w-full max-w-md">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <label className="cursor-pointer rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 mt-4">
                                {isLoading ? 'Analizando...' : 'Seleccionar Archivo'}
                                <input
                                    type="file"
                                    accept=".xls,.xlsx"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    disabled={isLoading}
                                />
                            </label>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="flex flex-col gap-4">
                            {stats && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50 text-center">
                                        <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Total Filas</div>
                                        <div className="text-xl font-bold text-slate-200">{stats.total}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50 text-center">
                                        <div className="text-[10px] font-bold tracking-wider text-amber-500 uppercase">Títulos / Subtítulos</div>
                                        <div className="text-xl font-bold text-amber-400">{stats.titulos}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700/50 text-center">
                                        <div className="text-[10px] font-bold tracking-wider text-sky-400 uppercase">Partidas</div>
                                        <div className="text-xl font-bold text-sky-400">{stats.partidas}</div>
                                    </div>
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
                                <span>Vista previa de la nueva jerarquía. <span className="text-red-400 font-bold">Esto sobrescribirá el presupuesto actual.</span></span>
                            </div>

                            <div className="overflow-auto rounded-lg border border-slate-700 bg-slate-900/40 max-h-[45vh]">
                                <table className="w-full text-[10px]">
                                    <thead className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700 shadow-sm">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider w-24">Item</th>
                                            <th className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">Descripción</th>
                                            <th className="px-3 py-2 text-center font-bold text-slate-400 uppercase tracking-wider w-16">Tipo</th>
                                            <th className="px-3 py-2 text-center font-bold text-slate-400 uppercase tracking-wider w-16">Und.</th>
                                            <th className="px-3 py-2 text-right font-bold text-slate-400 uppercase tracking-wider w-20">Metrado</th>
                                            <th className="px-3 py-2 text-right font-bold text-slate-400 uppercase tracking-wider w-20">Precio</th>
                                            <th className="px-3 py-2 text-right font-bold text-slate-400 uppercase tracking-wider w-24">Parcial</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.map((row, idx) => {
                                            const isTitulo = row.tipo_fila === 'titulo' || row.tipo_fila === 'subtitulo';
                                            const level = (row.partida.match(/\./g) || []).length;
                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`border-b border-slate-800/50 transition-colors ${
                                                        isTitulo ? 'bg-amber-950/20 font-semibold' : 'hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    <td className="px-3 py-1.5 text-emerald-400 font-mono tracking-tight" style={{ paddingLeft: `${12 + level * 14}px` }}>
                                                        {row.partida}
                                                    </td>
                                                    <td className={`px-3 py-1.5 ${isTitulo ? 'text-amber-200 uppercase text-[10px]' : 'text-slate-300'}`}>
                                                        {row.descripcion}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        {isTitulo ? (
                                                            <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-300 font-bold">
                                                                {row.tipo_fila === 'titulo' ? 'TIT' : 'SUB'}
                                                            </span>
                                                        ) : (
                                                            <span className="rounded bg-sky-900/40 px-1.5 py-0.5 text-sky-300 font-bold">PAR</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center text-slate-400">
                                                        {row.unidad || '—'}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">
                                                        {isTitulo ? '—' : (row.metrado || '0.00')}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">
                                                        {isTitulo ? '—' : (row.precio_unitario || '0.00')}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-emerald-300 font-bold tabular-nums">
                                                        {row.parcial || '0.00'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={() => { setStep('select'); setParsedRows([]); setFile(null); setError(null); }}
                                    className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                                >
                                    Elegir otro archivo
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && stats && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                                <CheckCircle className="h-10 w-10 text-emerald-400" />
                            </div>
                            <p className="text-sm text-slate-300 text-center">
                                Se construyó el presupuesto exitosamente.
                                <br />
                                <span className="font-bold text-emerald-400">{stats.total}</span> filas procesadas 
                                ({stats.titulos} títulos, {stats.partidas} partidas).
                            </p>
                        </div>
                    )}
                </div>

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
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet size={14} />
                                        Reemplazar Presupuesto ({parsedRows.length})
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
                            Ver Presupuesto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};