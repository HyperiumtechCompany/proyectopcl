import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormulaIndice {
    code:          string;
    descripcion:   string;
    coefCalculado: number; // val / totalInsumo → Σ = 1.000
    coefDefinido:  number; // redondeado 3dp, editable
}

interface FormulaMonomio {
    id:           string;
    nomenclatura: string; // 2 chars, ej. "MY", "CE"
    indices:      FormulaIndice[];
}

// ── Normativa DS 011-79-VC ────────────────────────────────────────────────────
const MAX_MONOMIOS = 8;
const MIN_COEF_MON = 0.05; // coef. mínimo por monomio (5 %)
// El art. 2 limita a 3 el promedio ponderado en la fórmula K, no la cantidad
// de códigos INEI que se pueden agrupar en un monomio.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const AVAIL_SOURCE = '__available__';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDef  = (n: number) => n.toFixed(3);
const fmtPct  = (n: number) => n.toFixed(2);
const sumCalc = (m: FormulaMonomio) => m.indices.reduce((s, i) => s + i.coefCalculado, 0);
const sumDef  = (m: FormulaMonomio) => m.indices.reduce((s, i) => s + i.coefDefinido, 0);

// ── Auto-build ────────────────────────────────────────────────────────────────
/**
 * Genera monomios desde parentMap.
 * Regla: todos los códigos quedan asignados → Σ coef = 1.000
 *   n ≤ MAX_MONOMIOS  → 1 código por monomio
 *   n > MAX_MONOMIOS  → top (MAX_MONOMIOS-1) individualmente;
 *                        el último monomio agrupa el resto sin límite
 *
 * Coeficientes normalizados sobre totalInsumo (no sobre el presupuesto con GG).
 */
function buildAutoMonomios(
    parentMap:   Map<string, number>,
    sortedCodes: string[],
    codeToDesc:  Map<string, string>,
): FormulaMonomio[] {
    const totalInsumo = Array.from(parentMap.values()).reduce((s, v) => s + v, 0);
    if (totalInsumo === 0 || sortedCodes.length === 0) return [];

    const mkIdx = (c: string): FormulaIndice => {
        const coefCalc = (parentMap.get(c) ?? 0) / totalInsumo;
        return { code: c, descripcion: codeToDesc.get(c) ?? `Índice ${c}`,
                 coefCalculado: coefCalc, coefDefinido: parseFloat(coefCalc.toFixed(3)) };
    };

    const allIdx = sortedCodes
        .filter(c => (parentMap.get(c) ?? 0) > 0)
        .map(mkIdx)
        .sort((a, b) => b.coefCalculado - a.coefCalculado);

    if (allIdx.length === 0) return [];

    const used    = new Set<string>();
    const nextNom = () => LETTERS.find(l => !used.has(l)) ?? '?';
    const makeM   = (indices: FormulaIndice[], i: number): FormulaMonomio => {
        const nom = nextNom(); used.add(nom);
        return { id: `m-${indices[0].code}-${i}`, nomenclatura: nom, indices };
    };

    if (allIdx.length <= MAX_MONOMIOS) {
        return allIdx.map((idx, i) => makeM([idx], i));
    }

    const top  = allIdx.slice(0, MAX_MONOMIOS - 1);
    const rest = allIdx.slice(MAX_MONOMIOS - 1); // sin límite en el 8vo
    return [...top.map((idx, i) => makeM([idx], i)), makeM(rest, MAX_MONOMIOS - 1)];
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    parentMap:   Map<string, number>;
    budgetTotal: number;
    codeToDesc:  Map<string, string>;
    sortedCodes: string[];
}

// ── K formula display ─────────────────────────────────────────────────────────
function KFormulaBar({ monomios }: { monomios: FormulaMonomio[] }) {
    if (monomios.length === 0) return null;
    return (
        <div className="shrink-0 overflow-x-auto border-b border-slate-700 bg-slate-950 px-3 py-2">
            <div className="flex min-w-max items-center gap-1 text-[11px]">
                <span className="mr-1 font-bold text-slate-300">K =</span>
                {monomios.map((m, i) => {
                    const coef = sumDef(m);
                    const nom  = m.nomenclatura || '?';
                    return (
                        <React.Fragment key={m.id}>
                            {i > 0 && <span className="mx-1.5 text-slate-600">+</span>}
                            <span className="font-mono font-semibold text-amber-300">{fmtDef(coef)}</span>
                            <span className="ml-1 mr-0.5 text-slate-600">·</span>
                            {/* Fracción Nomenclaturar / Nomenclaturao */}
                            <span className="inline-flex flex-col items-center leading-tight">
                                <span className="font-mono text-[10px] font-bold text-sky-300">{nom}r</span>
                                <span className="h-px w-full bg-slate-600" />
                                <span className="font-mono text-[10px] text-slate-400">{nom}o</span>
                            </span>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FormulaPolinomicaBuilder({ parentMap, codeToDesc, sortedCodes }: Props) {

    const [monomios,    setMonomios]    = useState<FormulaMonomio[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [addingTo,    setAddingTo]    = useState<string | null>(null);
    const [editingNom,  setEditingNom]  = useState<string | null>(null);
    const [editingCoef, setEditingCoef] = useState<{ mId: string; code: string } | null>(null);
    const [dragging,    setDragging]    = useState<{ mId: string; code: string } | null>(null);
    const [dragOverMId, setDragOverMId] = useState<string | null>(null);

    const autoBuilt = useRef(false);

    const totalInsumo = useMemo(
        () => Array.from(parentMap.values()).reduce((s, v) => s + v, 0),
        [parentMap],
    );

    // ── Auto-build ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (autoBuilt.current || totalInsumo === 0 || sortedCodes.length === 0) return;
        autoBuilt.current = true;
        const gen = buildAutoMonomios(parentMap, sortedCodes, codeToDesc);
        setMonomios(gen);
        setExpandedIds(new Set(gen.map(m => m.id)));
    }, [totalInsumo, sortedCodes, parentMap, codeToDesc]);

    // ── Derivados ─────────────────────────────────────────────────────────────
    const usedCodes = useMemo(() => {
        const s = new Set<string>();
        for (const m of monomios) for (const i of m.indices) s.add(i.code);
        return s;
    }, [monomios]);

    const available = useMemo<FormulaIndice[]>(() => {
        if (totalInsumo === 0) return [];
        return sortedCodes
            .filter(c => !usedCodes.has(c) && (parentMap.get(c) ?? 0) > 0)
            .map(c => {
                const coefCalc = (parentMap.get(c) ?? 0) / totalInsumo;
                return { code: c, descripcion: codeToDesc.get(c) ?? `Índice ${c}`,
                         coefCalculado: coefCalc, coefDefinido: parseFloat(coefCalc.toFixed(3)) };
            })
            .sort((a, b) => b.coefCalculado - a.coefCalculado);
    }, [sortedCodes, usedCodes, parentMap, totalInsumo, codeToDesc]);

    const totalDef = monomios.reduce((s, m) => s + sumDef(m), 0);
    const totalOk  = Math.abs(totalDef - 1.0) < 0.005;

    // ── Callbacks ─────────────────────────────────────────────────────────────
    const toggleExpand = useCallback((id: string) =>
        setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);

    const rebuild = useCallback(() => {
        autoBuilt.current = true;
        const gen = buildAutoMonomios(parentMap, sortedCodes, codeToDesc);
        setMonomios(gen);
        setExpandedIds(new Set(gen.map(m => m.id)));
        setAddingTo(null); setEditingNom(null); setEditingCoef(null);
        setDragging(null); setDragOverMId(null);
    }, [parentMap, sortedCodes, codeToDesc]);

    const addMonomio = useCallback(() => {
        if (monomios.length >= MAX_MONOMIOS) return;
        const usedLetters = new Set(monomios.map(m => m.nomenclatura));
        const nom = LETTERS.find(l => !usedLetters.has(l)) ?? '?';
        const id  = `m-new-${Date.now()}`;
        setMonomios(prev => [...prev, { id, nomenclatura: nom, indices: [] }]);
        setExpandedIds(prev => new Set([...prev, id]));
        setAddingTo(id);
    }, [monomios]);

    const deleteMonomio = useCallback((id: string) => {
        setMonomios(prev => prev.filter(m => m.id !== id));
        if (addingTo === id) setAddingTo(null);
    }, [addingTo]);

    const addIndex = useCallback((mId: string, idx: FormulaIndice) => {
        setMonomios(prev => prev.map(m =>
            m.id === mId ? { ...m, indices: [...m.indices, idx] } : m,
        ));
        setAddingTo(null);
    }, []);

    const removeIndex = useCallback((mId: string, code: string) =>
        setMonomios(prev => prev.map(m =>
            m.id === mId ? { ...m, indices: m.indices.filter(i => i.code !== code) } : m,
        )), []);

    const saveNom = useCallback((mId: string, val: string) => {
        setMonomios(prev => prev.map(m =>
            m.id === mId ? { ...m, nomenclatura: val.toUpperCase().slice(0, 2) } : m,
        ));
        setEditingNom(null);
    }, []);

    const saveCoef = useCallback((mId: string, code: string, raw: string) => {
        const val = parseFloat(raw);
        if (!isNaN(val))
            setMonomios(prev => prev.map(m =>
                m.id === mId
                    ? { ...m, indices: m.indices.map(i => i.code === code ? { ...i, coefDefinido: Math.max(0, Math.min(1, val)) } : i) }
                    : m,
            ));
        setEditingCoef(null);
    }, []);

    // ── Drag & Drop ───────────────────────────────────────────────────────────
    const onDragStart = useCallback((e: React.DragEvent, mId: string, code: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${mId}::${code}`);
        setDragging({ mId, code });
        setAddingTo(null);
    }, []);

    const canDrop = useCallback((targetMId: string) => {
        if (!dragging) return false;
        if (dragging.mId === targetMId) return false;
        return monomios.some(m => m.id === targetMId);
    }, [dragging, monomios]);

    const onDragOver = useCallback((e: React.DragEvent, targetMId: string) => {
        if (!canDrop(targetMId)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverMId(targetMId);
    }, [canDrop]);

    const onDragLeave = useCallback((_e: React.DragEvent, targetMId: string) =>
        setDragOverMId(prev => prev === targetMId ? null : prev), []);

    const onDrop = useCallback((e: React.DragEvent, targetMId: string) => {
        e.preventDefault();
        if (!dragging || !canDrop(targetMId)) { setDragging(null); setDragOverMId(null); return; }

        if (dragging.mId === AVAIL_SOURCE) {
            const idx = available.find(i => i.code === dragging.code);
            if (idx) setMonomios(prev => prev.map(m =>
                m.id === targetMId ? { ...m, indices: [...m.indices, idx] } : m,
            ));
        } else {
            const srcIdx = monomios.find(m => m.id === dragging.mId)?.indices.find(i => i.code === dragging.code);
            if (!srcIdx) { setDragging(null); setDragOverMId(null); return; }
            setMonomios(prev => prev.map(m => {
                if (m.id === dragging.mId) return { ...m, indices: m.indices.filter(i => i.code !== dragging.code) };
                if (m.id === targetMId)    return { ...m, indices: [...m.indices, srcIdx] };
                return m;
            }));
        }
        setDragging(null); setDragOverMId(null);
    }, [dragging, canDrop, monomios, available]);

    const onDragEnd = useCallback(() => { setDragging(null); setDragOverMId(null); }, []);

    const dropProps = (mId: string) => ({
        onDragOver:  (e: React.DragEvent) => onDragOver(e, mId),
        onDragLeave: (e: React.DragEvent) => onDragLeave(e, mId),
        onDrop:      (e: React.DragEvent) => onDrop(e, mId),
    });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-[11px]">

            {/* ── Toolbar ───────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Fórmula Polinómica
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    monomios.length >= MAX_MONOMIOS ? 'bg-red-900/40 text-red-300' : 'bg-slate-800 text-slate-400'
                }`}>
                    {monomios.length}/{MAX_MONOMIOS} monomios
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    totalOk ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'
                }`}>
                    Σ = {fmtDef(totalDef)}{totalOk ? ' ✓' : ' ≠ 1.000'}
                </span>
                <div className="flex-1" />
                <button onClick={rebuild}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200">
                    <RefreshCw size={10} /> Auto-construir
                </button>
                <button disabled={monomios.length >= MAX_MONOMIOS} onClick={addMonomio}
                    className="flex items-center gap-1 rounded bg-sky-900/40 px-2 py-0.5 text-[10px] text-sky-300 transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus size={10} /> Monomio
                </button>
            </div>

            {/* ── K formula ─────────────────────────────────────────────────── */}
            <KFormulaBar monomios={monomios} />

            {/* ── Table ─────────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-800 text-[10px] font-semibold text-slate-400">
                            <th className="w-8 border-b border-slate-700 py-1.5" />
                            <th className="border-b border-slate-700 py-1.5 pl-2 text-left">Descripción</th>
                            <th className="w-20 border-b border-slate-700 py-1.5 text-center">Nomenclatura</th>
                            <th className="w-28 border-b border-slate-700 py-1.5 pr-2 text-right">Coeficiente</th>
                            <th className="w-20 border-b border-slate-700 py-1.5 pr-2 text-right">Porcentaje (%)</th>
                            <th className="w-12 border-b border-slate-700 py-1.5" />
                        </tr>
                    </thead>

                    <tbody>
                        {monomios.map((mono, mi) => {
                            const isExp        = expandedIds.has(mono.id);
                            const coefD        = sumDef(mono);
                            const coefC        = sumCalc(mono);
                            const primary      = mono.indices[0];
                            const isLow        = coefD > 0 && coefD < MIN_COEF_MON;
                            const isPickerOpen = addingTo === mono.id;
                            const isDropTgt    = dragOverMId === mono.id;

                            return (
                                <React.Fragment key={mono.id}>

                                    {/* ── Monomio header ────────────────────── */}
                                    <tr
                                        {...dropProps(mono.id)}
                                        className={[
                                            'border-b border-slate-700 transition-all duration-100',
                                            isLow ? 'bg-red-950/30' : 'bg-slate-800/50',
                                            isDropTgt ? 'ring-2 ring-inset ring-sky-500/70 bg-sky-950/30' : 'hover:bg-slate-800',
                                        ].join(' ')}
                                    >
                                        {/* expand */}
                                        <td className="p-1 text-center">
                                            <button onClick={() => toggleExpand(mono.id)}
                                                className="text-amber-400 hover:text-amber-200 transition-colors">
                                                {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                            </button>
                                        </td>

                                        {/* Descripción — código + nombre del índice principal */}
                                        <td className="py-1.5 pl-1 pr-1">
                                            <div className="flex items-center gap-1.5">
                                                {primary && (
                                                    <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 font-mono text-[9px] font-bold text-sky-400">
                                                        {primary.code}
                                                    </span>
                                                )}
                                                <span className="font-bold text-amber-300">
                                                    {primary?.descripcion ?? <span className="italic text-slate-600">Monomio vacío</span>}
                                                </span>
                                                {mono.indices.length > 1 && (
                                                    <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 text-[8px] text-slate-400">
                                                        +{mono.indices.length - 1}
                                                    </span>
                                                )}
                                                {isLow && (
                                                    <span className="shrink-0 rounded bg-red-900/60 px-1 py-0.5 text-[8px] text-red-400" title="Coef. &lt; 5% (DS 011-79-VC art.3)">
                                                        &lt;5%
                                                    </span>
                                                )}
                                                {isDropTgt && (
                                                    <span className="shrink-0 animate-pulse rounded bg-sky-900/60 px-1 py-0.5 text-[8px] text-sky-300">
                                                        ↓ soltar aquí
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Nomenclatura editable */}
                                        <td className="p-1 text-center">
                                            {editingNom === mono.id ? (
                                                <input autoFocus defaultValue={mono.nomenclatura} maxLength={2}
                                                    className="w-14 rounded border border-sky-500 bg-slate-900 px-1 py-0.5 text-center font-mono text-[11px] font-bold uppercase text-sky-300 outline-none"
                                                    onBlur={e => saveNom(mono.id, e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveNom(mono.id, (e.target as HTMLInputElement).value); }} />
                                            ) : (
                                                <button onClick={() => setEditingNom(mono.id)}
                                                    className="group inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[12px] font-bold text-emerald-300 hover:bg-slate-700"
                                                    title="Editar nomenclatura">
                                                    {mono.nomenclatura || '?'}
                                                    <Pencil size={8} className="text-slate-600 opacity-0 group-hover:opacity-100" />
                                                </button>
                                            )}
                                        </td>

                                        {/* Coeficiente — suma de índices */}
                                        <td className="py-1.5 pr-2 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono text-[12px] font-bold text-slate-100">
                                                    {fmtDef(coefD)}
                                                </span>
                                                {Math.abs(coefC - coefD) > 0.0005 && (
                                                    <span className="font-mono text-[8px] text-slate-600" title="Valor calculado">
                                                        calc: {coefC.toFixed(6)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* % = 100 para el monomio */}
                                        <td className="py-1.5 pr-2 text-right font-mono text-[11px] text-slate-400">
                                            100
                                        </td>

                                        {/* Acciones */}
                                        <td className="p-1">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <button onClick={() => setAddingTo(isPickerOpen ? null : mono.id)}
                                                    disabled={available.length === 0}
                                                    title="Agregar índice INEI"
                                                    className="rounded p-0.5 text-sky-600 transition-colors hover:bg-slate-700 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-30">
                                                    <Plus size={12} />
                                                </button>
                                                <button onClick={() => deleteMonomio(mono.id)}
                                                    title="Eliminar monomio"
                                                    className="rounded p-0.5 text-slate-700 transition-colors hover:bg-slate-700 hover:text-red-400">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* ── Picker inline ─────────────────────── */}
                                    {isPickerOpen && (
                                        <tr>
                                            <td colSpan={6} className="border-b border-sky-900/40 bg-sky-950/30 px-3 py-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-sky-600">Agregar:</span>
                                                    {available.length === 0
                                                        ? <span className="text-[9px] text-slate-600">Sin índices disponibles.</span>
                                                        : available.map(idx => (
                                                            <button key={idx.code} onClick={() => addIndex(mono.id, idx)}
                                                                className="flex items-center gap-1 rounded border border-sky-800/50 bg-sky-900/40 px-1.5 py-0.5 text-[9px] text-sky-300 transition-colors hover:bg-sky-800">
                                                                <span className="font-mono font-bold">{idx.code}</span>
                                                                <span>{idx.descripcion.length > 22 ? idx.descripcion.slice(0, 22) + '…' : idx.descripcion}</span>
                                                                <span className="font-mono text-sky-600">{fmtDef(idx.coefCalculado)}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    <button onClick={() => setAddingTo(null)} className="ml-1 text-[9px] text-slate-500 hover:text-slate-300">Cancelar</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* ── Sub-índices ───────────────────────── */}
                                    {isExp && mono.indices.map((idx, ii) => {
                                        const pct            = coefD > 0 ? (idx.coefDefinido / coefD) * 100 : 0;
                                        const isEditingCoef  = editingCoef?.mId === mono.id && editingCoef?.code === idx.code;
                                        const isBeingDragged = dragging?.mId === mono.id && dragging?.code === idx.code;

                                        return (
                                            <tr key={`${mono.id}-${idx.code}`}
                                                draggable
                                                onDragStart={e => onDragStart(e, mono.id, idx.code)}
                                                onDragEnd={onDragEnd}
                                                {...dropProps(mono.id)}
                                                className={[
                                                    'border-b border-slate-800/50 transition-all',
                                                    isBeingDragged ? 'opacity-30 bg-slate-900'
                                                        : isDropTgt ? 'bg-sky-950/10'
                                                        : 'bg-slate-950 hover:bg-slate-900/60',
                                                ].join(' ')}
                                                style={{ cursor: 'grab' }}
                                            >
                                                {/* Grip + número */}
                                                <td className="p-1">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <GripVertical size={10} className="text-slate-700" />
                                                        <span className="text-[9px] text-slate-700">{mi + 1}.{ii + 1}</span>
                                                    </div>
                                                </td>

                                                {/* Descripción (indentada 2 niveles) */}
                                                <td className="py-1.5 pl-7 pr-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[9px] text-slate-500">{idx.code}</span>
                                                        <span className="text-slate-300">{idx.descripcion}</span>
                                                    </div>
                                                </td>

                                                <td className="p-1 text-center text-[9px] text-slate-700">—</td>

                                                {/* Coeficiente — editable */}
                                                <td className="p-1 pr-2 text-right">
                                                    {isEditingCoef ? (
                                                        <input autoFocus defaultValue={fmtDef(idx.coefDefinido)}
                                                            className="w-20 rounded border border-emerald-500 bg-slate-900 px-1 py-0.5 text-right font-mono text-[10px] text-emerald-300 outline-none"
                                                            onBlur={e => saveCoef(mono.id, idx.code, e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveCoef(mono.id, idx.code, (e.target as HTMLInputElement).value); }} />
                                                    ) : (
                                                        <button onClick={() => setEditingCoef({ mId: mono.id, code: idx.code })}
                                                            className="group inline-flex w-full items-center justify-end gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] text-slate-300 hover:bg-slate-800"
                                                            title="Editar coeficiente">
                                                            {fmtDef(idx.coefDefinido)}
                                                            <Pencil size={7} className="text-slate-600 opacity-0 group-hover:opacity-100" />
                                                        </button>
                                                    )}
                                                </td>

                                                {/* % dentro del monomio */}
                                                <td className="py-1.5 pr-2 text-right font-mono text-[10px] text-slate-500">
                                                    {fmtPct(pct)}
                                                </td>

                                                {/* Quitar */}
                                                <td className="p-1 text-right">
                                                    <button onClick={() => removeIndex(mono.id, idx.code)}
                                                        title="Quitar del monomio"
                                                        className="rounded p-0.5 text-slate-700 hover:bg-slate-800 hover:text-red-400 transition-colors">
                                                        <X size={11} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                </React.Fragment>
                            );
                        })}
                    </tbody>

                    {/* ── TOTAL ─────────────────────────────────────────────── */}
                    <tfoot className="sticky bottom-0 z-10">
                        <tr className={totalOk ? 'bg-emerald-950/50' : 'bg-amber-950/40'}>
                            <td colSpan={3} className="border-t-2 border-slate-600 py-1.5 pr-2 text-right text-[10px] font-bold tracking-wider text-slate-300">
                                TOTAL
                            </td>
                            <td className={`border-t-2 border-slate-600 py-1.5 pr-2 text-right font-mono text-[12px] font-bold ${
                                totalOk ? 'text-emerald-300' : 'text-amber-300'
                            }`}>
                                {fmtDef(totalDef)}
                                {!totalOk && (
                                    <span className="ml-1 text-[8px] font-normal opacity-60">
                                        {totalDef > 1 ? `+${(totalDef - 1).toFixed(3)}` : `−${(1 - totalDef).toFixed(3)}`}
                                    </span>
                                )}
                            </td>
                            <td colSpan={2} className="border-t-2 border-slate-600" />
                        </tr>
                    </tfoot>
                </table>

                {/* ── Índices sin asignar (arrastrables) ───────────────────── */}
                {available.length > 0 && (
                    <div className="border-t border-slate-800 bg-slate-900/60 p-2">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                            Sin asignar ({available.length}) — arrastrar o usar +
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {available.map(idx => (
                                <div key={idx.code} draggable
                                    onDragStart={e => onDragStart(e, AVAIL_SOURCE, idx.code)}
                                    onDragEnd={onDragEnd}
                                    className={[
                                        'flex cursor-grab select-none items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] transition-colors',
                                        dragging?.mId === AVAIL_SOURCE && dragging?.code === idx.code
                                            ? 'border-sky-600 bg-sky-900/60 text-sky-300 opacity-60'
                                            : 'border-slate-700 bg-slate-800/40 text-slate-500 hover:border-sky-700 hover:text-sky-400',
                                    ].join(' ')} title="Arrastra a un monomio">
                                    <GripVertical size={9} className="shrink-0 text-slate-600" />
                                    <span className="font-mono font-bold text-sky-600">{idx.code}</span>
                                    <span>{idx.descripcion.length > 18 ? idx.descripcion.slice(0, 18) + '…' : idx.descripcion}</span>
                                    <span className="font-mono text-slate-600">({fmtDef(idx.coefCalculado)})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {monomios.length === 0 && totalInsumo > 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                        <p className="text-sm">Sin monomios</p>
                        <button onClick={rebuild} className="mt-2 rounded bg-sky-900/40 px-3 py-1 text-xs text-sky-300 hover:bg-sky-800 transition-colors">
                            Auto-construir
                        </button>
                    </div>
                )}
                {totalInsumo === 0 && (
                    <div className="flex items-center justify-center py-10 text-[10px] text-slate-600">
                        Sin datos ACU para este padre.
                    </div>
                )}
            </div>

            {/* ── Nota normativa (igual que referencia S10) ─────────────────── */}
            <div className="shrink-0 border-t border-slate-800 px-3 py-1 text-[8px] uppercase tracking-wide text-slate-600">
                NOTA: Los índices unificados en la fórmula polinómica cuentan con la vigencia correspondiente. · DS 011-79-VC · Máx. {MAX_MONOMIOS} monomios · Coef. mín. {(MIN_COEF_MON * 100).toFixed(0)}% · Σ = 1.000
            </div>
        </div>
    );
}
