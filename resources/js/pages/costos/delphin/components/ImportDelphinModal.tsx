import { AlertCircle, CheckCircle2, ChevronRight, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ParseAcuResult, ParsedAcu } from '../helpers/parseAcuExcel';
import { parseAcuExcel } from '../helpers/parseAcuExcel';
import type { ParsePresupuestoResult } from '../helpers/parsePresupuestoExcel';
import { parsePresupuestoExcel } from '../helpers/parsePresupuestoExcel';
import type { AcuMatch } from '../helpers/matchAcuToPartida';
import { matchAcuToPartida, summarizeMatches } from '../helpers/matchAcuToPartida';
import type { DelphinRow } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'budget' | 'acus';

interface AcuFileState {
    file:     File;
    status:   'parsing' | 'ready' | 'error';
    error?:   string;
    acus:     ParsedAcu[];
    matches:  AcuMatch[];
    warnings: string[];
}

interface Props {
    open:              boolean;
    project:           string;
    project_id_int:    number;
    delphinRows:       DelphinRow[];
    onClose:           () => void;
    onBudgetImported:  (result: ParsePresupuestoResult) => { createdPartidas: string[] };
    // Receives the built ACU payloads ready to apply locally — no DB call
    onAcusImported?:   (payloads: Array<Record<string, any>>) => void;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Badge({ color, children }: { color: 'green' | 'yellow' | 'red' | 'blue'; children: React.ReactNode }) {
    const cls: Record<string, string> = {
        green:  'bg-green-900/50 text-green-300 border-green-700',
        yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
        red:    'bg-red-900/50 text-red-300 border-red-700',
        blue:   'bg-blue-900/50 text-blue-300 border-blue-700',
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls[color]}`}>
            {children}
        </span>
    );
}

function DropZone({ accept, multiple, onFiles, disabled, label }: {
    accept:    string;
    multiple?: boolean;
    onFiles:   (files: File[]) => void;
    disabled?: boolean;
    label:     string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handle = useCallback((files: FileList | null) => {
        if (!files?.length) return;
        onFiles(Array.from(files));
    }, [onFiles]);

    return (
        <div
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                disabled  ? 'cursor-not-allowed border-slate-700 opacity-40' :
                dragging  ? 'border-blue-400 bg-blue-900/20'                 :
                            'border-slate-600 hover:border-slate-400 hover:bg-slate-800/50'
            }`}
            onClick={() => !disabled && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!disabled) handle(e.dataTransfer.files);
            }}
        >
            <FileSpreadsheet size={28} className="text-slate-500" />
            <p className="text-center text-xs text-slate-400">{label}</p>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                className="hidden"
                disabled={disabled}
                onChange={(e) => handle(e.target.files)}
            />
        </div>
    );
}

// ─── Step 1: Presupuesto General ──────────────────────────────────────────────

function StepBudget({
    hasExistingRows,
    onImported,
    onNext,
}: {
    hasExistingRows: boolean;
    onImported:      (r: ParsePresupuestoResult) => { createdPartidas: string[] };
    onNext:          () => void;
}) {
    const [status,          setStatus]          = useState<'idle' | 'parsing' | 'ready' | 'done' | 'error'>('idle');
    const [result,          setResult]          = useState<ParsePresupuestoResult | null>(null);
    const [error,           setError]           = useState('');
    const [createdPartidas, setCreatedPartidas] = useState<string[]>([]);

    const handleFile = async (files: File[]) => {
        const file = files[0];
        setStatus('parsing');
        setError('');
        setCreatedPartidas([]);
        try {
            const r = await parsePresupuestoExcel(file);
            setResult(r);
            setStatus('ready');
        } catch (e: any) {
            setError(e?.message ?? 'Error desconocido');
            setStatus('error');
        }
    };

    // Visual-only: update local state, no DB call — user must click Guardar
    const handleImport = () => {
        if (!result) return;
        const { createdPartidas: created } = onImported(result);
        setCreatedPartidas(created);
        setStatus('done');
    };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-sm font-semibold text-slate-100">Paso 1 — Presupuesto General</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                    Sube el Excel exportado desde Delphin Express. Se importará el árbol de partidas completo.
                </p>
            </div>

            {status === 'idle' || status === 'error' ? (
                <>
                    {hasExistingRows && (
                        <div className="flex items-start gap-2 rounded-md border border-blue-800/50 bg-blue-900/20 px-3 py-2 text-xs text-blue-300">
                            <AlertCircle size={13} className="mt-0.5 shrink-0" />
                            Ya hay un presupuesto cargado. Las partidas nuevas se <strong className="ml-1">agregarán</strong> y las existentes se <strong>actualizarán</strong> (sin borrar lo anterior).
                        </div>
                    )}
                    <DropZone
                        accept=".xlsx,.xls"
                        label="Arrastra o haz clic para seleccionar el Excel del presupuesto"
                        onFiles={handleFile}
                    />
                    {error && (
                        <div className="flex items-start gap-2 rounded-md bg-red-900/30 px-3 py-2 text-xs text-red-300">
                            <AlertCircle size={13} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}
                </>
            ) : status === 'parsing' ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin" /> Analizando archivo…
                </div>
            ) : status === 'done' ? (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 rounded-md bg-green-900/30 px-3 py-2 text-sm text-green-300">
                        <CheckCircle2 size={16} />
                        Árbol cargado en la vista. Usa <strong className="mx-1">Guardar</strong> en la barra de herramientas para persistir los cambios.
                    </div>
                    {createdPartidas.length > 0 && (
                        <div className="rounded-md border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                            <div className="mb-1 flex items-center gap-1.5 font-semibold">
                                <AlertCircle size={12} />
                                {createdPartidas.length} grupo{createdPartidas.length !== 1 ? 's' : ''} creado{createdPartidas.length !== 1 ? 's' : ''} automáticamente (padre faltante):
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {createdPartidas.map((p) => (
                                    <span key={p} className="rounded bg-amber-800/40 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                                        {p}
                                    </span>
                                ))}
                            </div>
                            <p className="mt-1 text-[10px] text-amber-400/70">
                                Estos grupos vacíos se agregaron para mantener la jerarquía. Puedes editarlos o moverlos en el árbol.
                            </p>
                        </div>
                    )}
                </div>
            ) : result && status === 'ready' ? (
                <div className="flex flex-col gap-3">
                    {/* Summary */}
                    <div className="flex flex-wrap gap-2">
                        <Badge color="blue">{result.rows.length} filas totales</Badge>
                        <Badge color="green">{result.totalPartidas} partidas (hojas)</Badge>
                        <Badge color="yellow">{result.totalGrupos} grupos</Badge>
                        {result.warnings.length > 0 && (
                            <Badge color="red">{result.warnings.length} advertencias</Badge>
                        )}
                    </div>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                        <div className="max-h-24 overflow-y-auto rounded-md bg-yellow-900/20 px-3 py-2 text-[11px] text-yellow-300">
                            {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                        </div>
                    )}

                    {/* Tree preview (first 15 rows) */}
                    <div className="max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-slate-900">
                        <table className="w-full text-[11px]">
                            <thead className="sticky top-0 bg-slate-800 text-slate-400">
                                <tr>
                                    <th className="px-2 py-1 text-left">N°</th>
                                    <th className="px-2 py-1 text-left">Descripción</th>
                                    <th className="px-2 py-1 text-center">Und.</th>
                                    <th className="px-2 py-1 text-right">Cantidad</th>
                                    <th className="px-2 py-1 text-right">P.Unit.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.slice(0, 15).map((row, i) => (
                                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                                        <td className="px-2 py-0.5 font-mono text-slate-400" style={{ paddingLeft: `${(row.nivel - 1) * 12 + 8}px` }}>
                                            {row.partida}
                                        </td>
                                        <td className="max-w-[200px] truncate px-2 py-0.5 text-slate-200">{row.descripcion}</td>
                                        <td className="px-2 py-0.5 text-center text-slate-400">{row.unidad || '—'}</td>
                                        <td className="px-2 py-0.5 text-right text-slate-400">{row.metrado || '—'}</td>
                                        <td className="px-2 py-0.5 text-right text-slate-400">{row.precio_unitario || '—'}</td>
                                    </tr>
                                ))}
                                {result.rows.length > 15 && (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-1 text-center text-slate-500">
                                            … y {result.rows.length - 15} filas más
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <button
                        onClick={handleImport}
                        className="flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                    >
                        <Upload size={14} /> Cargar árbol en vista
                    </button>
                </div>
            ) : null}

            {/* Next button (available after done) */}
            {status === 'done' && (
                <button
                    onClick={onNext}
                    className="flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                >
                    Continuar con los ACUs <ChevronRight size={14} />
                </button>
            )}
        </div>
    );
}

// ─── Step 2: ACUs por especialidad ────────────────────────────────────────────

function AcuFileRow({ state, onRemove }: { state: AcuFileState; onRemove: () => void }) {
    const summary = state.status === 'ready' ? summarizeMatches(state.matches) : null;

    return (
        <div className="rounded-md border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <FileSpreadsheet size={14} className="shrink-0 text-slate-400" />
                    <span className="truncate text-xs font-medium text-slate-200">{state.file.name}</span>
                </div>
                <button onClick={onRemove} className="shrink-0 text-slate-500 hover:text-slate-300">
                    <X size={13} />
                </button>
            </div>

            {state.status === 'parsing' && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Loader2 size={12} className="animate-spin" /> Analizando…
                </div>
            )}

            {state.status === 'error' && (
                <div className="mt-2 text-[11px] text-red-400">{state.error}</div>
            )}

            {state.status === 'ready' && summary && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge color="blue">{state.acus.length} ACUs</Badge>
                    <Badge color="green">✓ {summary.byCode} por código</Badge>
                    {summary.byName > 0 && <Badge color="yellow">~ {summary.byName} por nombre</Badge>}
                    {summary.unmatched > 0 && <Badge color="red">✗ {summary.unmatched} sin match</Badge>}
                </div>
            )}

            {/* ACU content inspector — shows parsed insumos per section */}
            {state.status === 'ready' && state.acus.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-blue-400 hover:text-blue-300">
                        Inspeccionar insumos parseados ({state.acus.length} ACUs)
                    </summary>
                    <div className="mt-1 max-h-48 overflow-y-auto rounded bg-slate-900 p-2 text-[10px] text-slate-400 space-y-1">
                        {state.acus.map((acu, i) => (
                            <div key={i} className="border-b border-slate-800 pb-1">
                                <span className="text-slate-300 font-mono">{acu.partida_code}</span>
                                <span className="ml-2 text-slate-500 truncate">{acu.partida_desc.slice(0, 40)}</span>
                                <div className="ml-2 mt-0.5 flex flex-wrap gap-1">
                                    {acu.mano_de_obra.length > 0  && <span className="text-green-400">MO:{acu.mano_de_obra.length}</span>}
                                    {acu.materiales.length > 0    && <span className="text-blue-400">MAT:{acu.materiales.length}</span>}
                                    {acu.equipos.length > 0       && <span className="text-yellow-400">EQ:{acu.equipos.length}</span>}
                                    {acu.subcontratos.length > 0  && <span className="text-purple-400">SC:{acu.subcontratos.length}</span>}
                                    {acu.subpartidas.length > 0   && <span className="text-orange-400">SP:{acu.subpartidas.length}</span>}
                                    {(acu.mano_de_obra.length + acu.materiales.length + acu.equipos.length) === 0 && (
                                        <span className="text-red-400">⚠ sin insumos</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {/* Unmatched list */}
            {state.status === 'ready' && state.matches.some((m) => m.method === 'none') && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-yellow-400 hover:text-yellow-300">
                        Ver partidas sin match ({state.matches.filter((m) => m.method === 'none').length})
                    </summary>
                    <div className="mt-1 max-h-28 overflow-y-auto rounded bg-slate-900 p-2 text-[10px] text-slate-400">
                        {state.matches
                            .filter((m) => m.method === 'none')
                            .map((m, i) => (
                                <div key={i} className="truncate">
                                    {m.acu.partida_code} — {m.acu.partida_desc}
                                </div>
                            ))}
                    </div>
                </details>
            )}
        </div>
    );
}

function StepAcus({
    delphinRows,
    onDone,
    onAcusImported,
}: {
    delphinRows:      DelphinRow[];
    onDone:           () => void;
    onAcusImported?:  (payloads: Array<Record<string, any>>) => void;
}) {
    const [files,      setFiles]      = useState<AcuFileState[]>([]);
    const [importDone, setImportDone] = useState(false);

    const addFiles = useCallback(async (newFiles: File[]) => {
        const stubs: AcuFileState[] = newFiles.map((f) => ({
            file: f, status: 'parsing', acus: [], matches: [], warnings: [],
        }));
        setFiles((prev) => [...prev, ...stubs]);

        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            try {
                const result: ParseAcuResult = await parseAcuExcel(file);
                const matches = matchAcuToPartida(result.acus, delphinRows);
                setFiles((prev) =>
                    prev.map((s) =>
                        s.file === file
                            ? { ...s, status: 'ready', acus: result.acus, matches, warnings: result.warnings }
                            : s,
                    ),
                );
            } catch (e: any) {
                setFiles((prev) =>
                    prev.map((s) =>
                        s.file === file ? { ...s, status: 'error', error: e?.message ?? 'Error' } : s,
                    ),
                );
            }
        }
    }, [delphinRows]);

    const removeFile = useCallback((file: File) => {
        setFiles((prev) => prev.filter((s) => s.file !== file));
    }, []);

    const totalMatched = files.reduce(
        (acc, s) => acc + s.matches.filter((m) => m.method !== 'none').length,
        0,
    );

    // Visual-only: build payloads and send to parent — no API call here
    const handleImport = () => {
        const allMatched: AcuMatch[] = files.flatMap((s) => s.matches.filter((m) => m.method !== 'none'));
        const payloads = allMatched
            .filter((m) => m.row)
            .map((m) => buildAcuPayload(m.acu, m.row!.partida));
        onAcusImported?.(payloads);
        setImportDone(true);
    };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-sm font-semibold text-slate-100">Paso 2 — ACUs por especialidad</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                    Sube uno o varios archivos Excel de ACUs (Delphin Express por especialidad). Cada ACU se vincula
                    automáticamente a su partida por código o por nombre.
                </p>
            </div>

            {!importDone && delphinRows.length === 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-800/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    No hay partidas cargadas. Importa primero el <strong className="mx-1">Presupuesto</strong> para poder vincular los ACUs.
                </div>
            )}

            {!importDone && (
                <DropZone
                    accept=".xlsx,.xls"
                    multiple
                    disabled={delphinRows.length === 0}
                    label="Arrastra o haz clic para agregar archivos de ACUs (puedes subir varios)"
                    onFiles={addFiles}
                />
            )}

            {files.length > 0 && (
                <div className="flex flex-col gap-2">
                    {files.map((s) => (
                        <AcuFileRow
                            key={s.file.name + s.file.size}
                            state={s}
                            onRemove={() => removeFile(s.file)}
                        />
                    ))}
                </div>
            )}

            {importDone ? (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 rounded-md bg-green-900/30 px-3 py-2 text-sm text-green-300">
                        <CheckCircle2 size={16} />
                        {totalMatched} ACU{totalMatched !== 1 ? 's' : ''} cargados en la vista. Usa <strong className="mx-1">Guardar</strong> para persistirlos.
                    </div>
                    <button
                        onClick={onDone}
                        className="flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                    >
                        Finalizar
                    </button>
                </div>
            ) : (
                totalMatched > 0 && (
                    <button
                        onClick={handleImport}
                        className="flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                    >
                        <Upload size={14} />
                        Cargar {totalMatched} ACU{totalMatched !== 1 ? 's' : ''} en vista
                    </button>
                )
            )}
        </div>
    );
}

// ─── ACU payload builder ──────────────────────────────────────────────────────

function buildAcuPayload(acu: ParsedAcu, partida: string) {
    return {
        id:                   null,
        partida,
        descripcion:          acu.partida_desc,
        unidad:               acu.unidad || 'und',
        rendimiento:          acu.rendimiento || 1,
        mano_de_obra:         acu.mano_de_obra.map((c) => ({
            descripcion:    c.descripcion,
            unidad:         c.unidad || 'hh',
            cantidad:       c.cantidad,
            recursos:       c.recursos,
            precio_unitario: c.precio_unitario,
            insumo_id:      null,
            cod_insumo:     c.codigo || null,
            proveedor:      c.proveedor || null,
        })),
        materiales:           acu.materiales.map((c) => ({
            descripcion:        c.descripcion,
            unidad:             c.unidad || 'und',
            cantidad:           c.cantidad,
            precio_unitario:    c.precio_unitario,
            factor_desperdicio: c.factor_desperdicio ?? 1,
            insumo_id:          null,
            cod_insumo:         c.codigo || null,
            proveedor:          c.proveedor || null,
        })),
        equipos:              acu.equipos.map((c) => ({
            descripcion: c.descripcion,
            unidad:      c.unidad || 'hm',
            cantidad:    c.cantidad,
            recursos:    c.recursos,
            precio_hora: c.precio_hora,
            insumo_id:   null,
            cod_insumo:  c.codigo || null,
            proveedor:   c.proveedor || null,
        })),
        subcontratos:         acu.subcontratos.map((c) => ({
            descripcion:     c.descripcion,
            unidad:          c.unidad || 'glb',
            cantidad:        c.cantidad,
            precio_unitario: c.precio_unitario,
            insumo_id:       null,
            cod_insumo:      c.codigo || null,
            proveedor:       c.proveedor || null,
        })),
        subpartidas:          acu.subpartidas.map((c) => ({
            descripcion:     c.descripcion,
            unidad:          c.unidad || 'und',
            cantidad:        c.cantidad,
            precio_unitario: c.precio_unitario,
            insumo_id:       null,
            cod_insumo:      c.codigo || null,
            proveedor:       c.proveedor || null,
        })),
        update_project_prices: false,
    };
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function ImportDelphinModal({
    open,
    project: _project,
    project_id_int: _pid,
    delphinRows,
    onClose,
    onBudgetImported,
    onAcusImported,
}: Props) {
    // Default to ACUs tab when presupuesto already exists; reset each time the modal opens
    const [step, setStep] = useState<Step>('budget');
    useEffect(() => {
        if (open) setStep(delphinRows.length > 0 ? 'acus' : 'budget');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const stepLabel: Record<Step, string> = {
        budget: '1 Presupuesto',
        acus:   '2 ACUs',
    };

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-100">Importar desde Excel</span>
                        <div className="flex items-center gap-1">
                            {(['budget', 'acus'] as Step[]).map((s, i) => (
                                <React.Fragment key={s}>
                                    {i > 0 && <ChevronRight size={12} className="text-slate-600" />}
                                    <button
                                        onClick={() => setStep(s)}
                                        className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                            step === s
                                                ? 'bg-blue-700 text-white'
                                                : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        {stepLabel[s]}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {step === 'budget' ? (
                        <StepBudget
                            hasExistingRows={delphinRows.length > 0}
                            onImported={onBudgetImported}
                            onNext={() => setStep('acus')}
                        />
                    ) : (
                        <StepAcus
                            delphinRows={delphinRows}
                            onDone={onClose}
                            onAcusImported={onAcusImported}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
