import { AlertTriangle, ChevronDown, ChevronRight, GripVertical, LogOut, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormulaIndice {
    code:          string;
    descripcion:   string;
    coefCalculado: number;
    coefDefinido:  number;
}

// Un monomio tiene siempre 1–MAX_IDX_PER_MON índices.
// indices[0] = primario (define al padre); el resto son índices agrupados dentro.
interface FormulaMonomio {
    id:           string;
    nomenclatura: string;
    indices:      FormulaIndice[];
}

// ── Normativa DS 011-79-VC ────────────────────────────────────────────────────
const MAX_MONOMIOS    = 8;
const MAX_IDX_PER_MON = 3;   // art. 2: máx 3 índices por monomio
const MIN_COEF_MON    = 0.05;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDef  = (n: number) => n.toFixed(3);
const fmtPct  = (n: number) => n.toFixed(1);
const sumDef  = (m: FormulaMonomio) => m.indices.reduce((s, i) => s + i.coefDefinido,  0);
const sumCalc = (m: FormulaMonomio) => m.indices.reduce((s, i) => s + i.coefCalculado, 0);

function usedLetterSet(list: FormulaMonomio[]): Set<string> {
    return new Set(list.map(m => m.nomenclatura));
}
function nextLetter(list: FormulaMonomio[]): string {
    const used = usedLetterSet(list);
    return LETTERS.find(l => !used.has(l)) ?? '?';
}
function allUsedCodes(list: FormulaMonomio[]): Set<string> {
    const s = new Set<string>();
    for (const m of list) for (const i of m.indices) s.add(i.code);
    return s;
}

// ── Auto-build: 1 monomio por insumo, sin agrupación automática ───────────────
function buildAutoMonomios(
    parentMap:   Map<string, number>,
    sortedCodes: string[],
    codeToDesc:  Map<string, string>,
): FormulaMonomio[] {
    const total = Array.from(parentMap.values()).reduce((s, v) => s + v, 0);
    if (total === 0 || sortedCodes.length === 0) return [];

    return sortedCodes
        .filter(c => (parentMap.get(c) ?? 0) > 0)
        .sort((a, b) => (parentMap.get(b) ?? 0) - (parentMap.get(a) ?? 0))
        .map((c, i) => {
            const coefC = (parentMap.get(c) ?? 0) / total;
            return {
                id:           `m-${c}-${i}`,
                nomenclatura: LETTERS[i] ?? '?',
                indices: [{
                    code:          c,
                    descripcion:   codeToDesc.get(c) ?? `Índice ${c}`,
                    coefCalculado: coefC,
                    coefDefinido:  parseFloat(coefC.toFixed(3)),
                }],
            };
        });
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    parentMap:   Map<string, number>;
    budgetTotal: number;
    codeToDesc:  Map<string, string>;
    sortedCodes: string[];
}

// ── K formula bar ─────────────────────────────────────────────────────────────
function KFormulaBar({ monomios }: { monomios: FormulaMonomio[] }) {
    const visible = monomios.filter(m => sumDef(m) > 0);
    if (visible.length === 0) return null;
    return (
        <div className="shrink-0 overflow-x-auto border-b border-slate-700 bg-slate-950 px-3 py-2">
            <div className="flex min-w-max items-center gap-1 text-[11px]">
                <span className="mr-1 font-bold text-slate-300">K =</span>
                {visible.map((m, i) => {
                    const coef = sumDef(m);
                    const nom  = m.nomenclatura || '?';
                    return (
                        <React.Fragment key={m.id}>
                            {i > 0 && <span className="mx-1.5 text-slate-600">+</span>}
                            <span className="font-mono font-semibold text-amber-300">{fmtDef(coef)}</span>
                            <span className="ml-1 mr-0.5 text-slate-600">·</span>
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
    // expandedIds  → qué padres están expandidos (muestran hijos nivel 2)
    // expandedIdx  → qué hijos están expandidos (muestran nivel 3); key = `${mId}::${code}`
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [expandedIdx, setExpandedIdx] = useState<Set<string>>(new Set());
    const [editingNom,  setEditingNom]  = useState<string | null>(null);
    const [editingCoef, setEditingCoef] = useState<{ mId: string; code: string } | null>(null);
    const [dragId,      setDragId]      = useState<string | null>(null);
    const [dragOverId,  setDragOverId]  = useState<string | null>(null);

    const autoBuilt = useRef(false);

    const totalInsumo = useMemo(
        () => Array.from(parentMap.values()).reduce((s, v) => s + v, 0),
        [parentMap],
    );

    // ── Auto-build (una vez) ──────────────────────────────────────────────────
    useEffect(() => {
        if (autoBuilt.current || totalInsumo === 0 || sortedCodes.length === 0) return;
        autoBuilt.current = true;
        const gen = buildAutoMonomios(parentMap, sortedCodes, codeToDesc);
        setMonomios(gen);
        setExpandedIds(new Set(gen.map(m => m.id)));
    }, [totalInsumo, sortedCodes, parentMap, codeToDesc]);

    // ── Derivados ─────────────────────────────────────────────────────────────
    const usedCodes = useMemo(() => allUsedCodes(monomios), [monomios]);

    const available = useMemo<FormulaIndice[]>(() => {
        if (totalInsumo === 0) return [];
        return sortedCodes
            .filter(c => !usedCodes.has(c) && (parentMap.get(c) ?? 0) > 0)
            .map(c => {
                const coefC = (parentMap.get(c) ?? 0) / totalInsumo;
                return {
                    code:          c,
                    descripcion:   codeToDesc.get(c) ?? `Índice ${c}`,
                    coefCalculado: coefC,
                    coefDefinido:  parseFloat(coefC.toFixed(3)),
                };
            })
            .sort((a, b) => b.coefCalculado - a.coefCalculado);
    }, [sortedCodes, usedCodes, parentMap, totalInsumo, codeToDesc]);

    const totalDef    = monomios.reduce((s, m) => s + sumDef(m), 0);
    const totalOk     = Math.abs(totalDef - 1.0) < 0.005;
    const excessAlert = monomios.length > MAX_MONOMIOS;

    // ── Toggle expand ─────────────────────────────────────────────────────────
    const togglePadre = useCallback((id: string) =>
        setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);

    const toggleHijo = useCallback((key: string) =>
        setExpandedIdx(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; }), []);

    const rebuild = useCallback(() => {
        autoBuilt.current = true;
        const gen = buildAutoMonomios(parentMap, sortedCodes, codeToDesc);
        setMonomios(gen);
        setExpandedIds(new Set(gen.map(m => m.id)));
        setExpandedIdx(new Set());
        setEditingNom(null); setEditingCoef(null);
        setDragId(null); setDragOverId(null);
    }, [parentMap, sortedCodes, codeToDesc]);

    // ── Agregar índice disponible como nuevo monomio standalone ───────────────
    const addFromAvailable = useCallback((idx: FormulaIndice) => {
        setMonomios(prev => {
            const nom = nextLetter(prev);
            const id  = `m-${idx.code}-${Date.now()}`;
            return [...prev, { id, nomenclatura: nom, indices: [idx] }];
        });
    }, []);

    const deleteMonomio = useCallback((id: string) => {
        setMonomios(prev => prev.filter(m => m.id !== id));
    }, []);

    // Extrae un índice secundario a un nuevo monomio standalone
    const extractIndex = useCallback((mId: string, code: string) => {
        setMonomios(prev => {
            const m = prev.find(x => x.id === mId);
            if (!m) return prev;
            const idx = m.indices.find(i => i.code === code);
            if (!idx || m.indices.length <= 1) return prev;
            const nom = nextLetter(prev);
            return [
                ...prev.map(x => x.id === mId ? { ...x, indices: x.indices.filter(i => i.code !== code) } : x),
                { id: `m-${code}-${Date.now()}`, nomenclatura: nom, indices: [idx] },
            ];
        });
    }, []);

    const saveNom = useCallback((mId: string, val: string) => {
        const nom = val.toUpperCase().slice(0, 2) || '?';
        setMonomios(prev => prev.map(m => m.id === mId ? { ...m, nomenclatura: nom } : m));
        setEditingNom(null);
    }, []);

    const saveCoef = useCallback((mId: string, code: string, raw: string) => {
        const val = parseFloat(raw);
        if (!isNaN(val)) {
            const clamped = Math.max(0, Math.min(1, val));
            setMonomios(prev => prev.map(m =>
                m.id === mId
                    ? { ...m, indices: m.indices.map(i => i.code === code ? { ...i, coefDefinido: clamped } : i) }
                    : m,
            ));
        }
        setEditingCoef(null);
    }, []);

    // ── Drag & Drop ───────────────────────────────────────────────────────────
    // Arrastrar un monomio sobre otro agrega sus índices dentro del destino.
    // Solo es válido si destino.indices.length + src.indices.length ≤ MAX_IDX_PER_MON.
    const canDropOnto = useCallback((targetId: string): boolean => {
        if (!dragId || dragId === targetId) return false;
        const src = monomios.find(m => m.id === dragId);
        const tgt = monomios.find(m => m.id === targetId);
        if (!src || !tgt) return false;
        return tgt.indices.length + src.indices.length <= MAX_IDX_PER_MON;
    }, [dragId, monomios]);

    const onDragStart = useCallback((e: React.DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setDragId(id);
    }, []);

    const onDragOver = useCallback((e: React.DragEvent, targetId: string) => {
        if (!canDropOnto(targetId)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(targetId);
    }, [canDropOnto]);

    const onDragLeave = useCallback((_e: React.DragEvent, id: string) =>
        setDragOverId(prev => prev === id ? null : prev), []);

    const onDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!dragId || !canDropOnto(targetId)) { setDragId(null); setDragOverId(null); return; }

        setMonomios(prev => {
            const src = prev.find(m => m.id === dragId);
            if (!src) return prev;
            return prev
                .filter(m => m.id !== dragId)
                .map(m => m.id === targetId
                    ? { ...m, indices: [...m.indices, ...src.indices] }
                    : m,
                );
        });
        setDragId(null); setDragOverId(null);
    }, [dragId, canDropOnto]);

    const onDragEnd = useCallback(() => { setDragId(null); setDragOverId(null); }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-[11px]">

            {/* ── Toolbar ───────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Fórmula Polinómica
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    excessAlert ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                    {monomios.length}/{MAX_MONOMIOS} monomios{excessAlert ? ' ⚠' : ''}
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
            </div>

            {/* ── Alerta exceso de monomios ─────────────────────────────────── */}
            {excessAlert && (
                <div className="flex shrink-0 items-center gap-1.5 border-b border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-[9px] text-amber-400">
                    <AlertTriangle size={11} className="shrink-0" />
                    DS 011-79-VC: máximo {MAX_MONOMIOS} monomios. Tienes {monomios.length}. Arrastra monomios entre sí para agrupar sus índices dentro (máx. {MAX_IDX_PER_MON} por monomio).
                </div>
            )}

            {/* ── K formula ─────────────────────────────────────────────────── */}
            <KFormulaBar monomios={monomios} />

            {/* ── Tabla ─────────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-800 text-[10px] font-semibold text-slate-400">
                            <th className="w-8 border-b border-slate-700 py-1.5" />
                            <th className="border-b border-slate-700 py-1.5 pl-2 text-left">Descripción</th>
                            <th className="w-20 border-b border-slate-700 py-1.5 text-center">Nomenclatura</th>
                            <th className="w-28 border-b border-slate-700 py-1.5 pr-2 text-right">Coeficiente</th>
                            <th className="w-20 border-b border-slate-700 py-1.5 pr-2 text-right">% Total</th>
                            <th className="w-12 border-b border-slate-700 py-1.5" />
                        </tr>
                    </thead>

                    <tbody>
                        {monomios.map(mono => {
                            const isExp      = expandedIds.has(mono.id);
                            const coefD      = sumDef(mono);
                            const coefC      = sumCalc(mono);
                            const primary    = mono.indices[0];
                            const isLow      = coefD > 0 && coefD < MIN_COEF_MON;
                            const isDropTgt  = dragOverId === mono.id;
                            const isDragging = dragId === mono.id;
                            const canRcv     = canDropOnto(mono.id);

                            return (
                                <React.Fragment key={mono.id}>

                                    {/* ── NIVEL 1: Padre monomio ────────────── */}
                                    <tr
                                        draggable
                                        onDragStart={e => onDragStart(e, mono.id)}
                                        onDragEnd={onDragEnd}
                                        onDragOver={e => onDragOver(e, mono.id)}
                                        onDragLeave={e => onDragLeave(e, mono.id)}
                                        onDrop={e => onDrop(e, mono.id)}
                                        className={[
                                            'border-b border-slate-700 transition-all duration-100',
                                            isDragging ? 'opacity-40' : '',
                                            isLow ? 'bg-red-950/30' : 'bg-slate-800/50',
                                            isDropTgt ? 'ring-2 ring-inset ring-sky-500/70 bg-sky-950/30' : 'hover:bg-slate-800',
                                        ].filter(Boolean).join(' ')}
                                        style={{ cursor: 'grab' }}
                                    >
                                        {/* Grip + expand */}
                                        <td className="p-1 text-center">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <GripVertical size={10} className="shrink-0 text-slate-600" />
                                                <button onClick={() => togglePadre(mono.id)}
                                                    className="text-amber-400 transition-colors hover:text-amber-200">
                                                    {isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </button>
                                            </div>
                                        </td>

                                        {/* Descripción padre */}
                                        <td className="py-1.5 pl-1 pr-1">
                                            <div className="flex items-center gap-1.5">
                                                {primary && (
                                                    <span className="shrink-0 rounded bg-slate-700 px-1 py-0.5 font-mono text-[9px] font-bold text-sky-400">
                                                        {primary.code}
                                                    </span>
                                                )}
                                                <span className="font-bold text-amber-300">
                                                    {primary?.descripcion
                                                        ?? <span className="italic text-slate-600">Monomio vacío</span>}
                                                </span>
                                                {mono.indices.length > 1 && (
                                                    <span className="shrink-0 rounded bg-violet-900/50 px-1 py-0.5 text-[8px] text-violet-400">
                                                        +{mono.indices.length - 1}
                                                    </span>
                                                )}
                                                {isLow && (
                                                    <span className="shrink-0 rounded bg-red-900/60 px-1 py-0.5 text-[8px] text-red-400"
                                                        title="Coef. < 5% (DS 011-79-VC art.3)">
                                                        &lt;5%
                                                    </span>
                                                )}
                                                {canRcv && dragId && !isDragging && (
                                                    <span className="shrink-0 animate-pulse rounded bg-sky-900/60 px-1 py-0.5 text-[8px] text-sky-300">
                                                        ↓ soltar aquí
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Nomenclatura */}
                                        <td className="p-1 text-center">
                                            {editingNom === mono.id ? (
                                                <input autoFocus defaultValue={mono.nomenclatura} maxLength={2}
                                                    className="w-14 rounded border border-sky-500 bg-slate-900 px-1 py-0.5 text-center font-mono text-[11px] font-bold uppercase text-sky-300 outline-none"
                                                    onBlur={e => saveNom(mono.id, e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveNom(mono.id, (e.target as HTMLInputElement).value); }} />
                                            ) : (
                                                <button onClick={() => setEditingNom(mono.id)}
                                                    className="group inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[12px] font-bold text-emerald-300 hover:bg-slate-700">
                                                    {mono.nomenclatura || '?'}
                                                    <Pencil size={8} className="text-slate-600 opacity-0 group-hover:opacity-100" />
                                                </button>
                                            )}
                                        </td>

                                        {/* Coeficiente total */}
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

                                        {/* % del total */}
                                        <td className="py-1.5 pr-2 text-right font-mono text-[11px] text-slate-400">
                                            {totalDef > 0 ? fmtPct((coefD / totalDef) * 100) : '—'}
                                        </td>

                                        {/* Eliminar */}
                                        <td className="p-1">
                                            <button onClick={() => deleteMonomio(mono.id)}
                                                title="Eliminar monomio"
                                                className="rounded p-0.5 text-slate-700 transition-colors hover:bg-slate-700 hover:text-red-400">
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>

                                    {/* ── NIVEL 2 + 3: hijos (padre expandido) ─ */}
                                    {isExp && mono.indices.map((idx, ii) => {
                                        const hijoKey   = `${mono.id}::${idx.code}`;
                                        const isHijoExp = expandedIdx.has(hijoKey);
                                        const pct       = coefD > 0 ? (idx.coefDefinido / coefD) * 100 : 0;
                                        const isEditing = editingCoef?.mId === mono.id && editingCoef?.code === idx.code;
                                        const isPrimary = ii === 0;

                                        return (
                                            <React.Fragment key={hijoKey}>

                                                {/* NIVEL 2: hijo — draggable igual que el padre */}
                                                <tr
                                                    draggable
                                                    onDragStart={e => onDragStart(e, mono.id)}
                                                    onDragEnd={onDragEnd}
                                                    onDragOver={e => onDragOver(e, mono.id)}
                                                    onDragLeave={e => onDragLeave(e, mono.id)}
                                                    onDrop={e => onDrop(e, mono.id)}
                                                    className={[
                                                        'border-b border-slate-700/50 transition-all',
                                                        isDragging ? 'opacity-40' : '',
                                                        isDropTgt && !isDragging ? 'bg-sky-950/10' : isPrimary ? 'bg-slate-800/30' : 'bg-slate-800/15',
                                                    ].filter(Boolean).join(' ')}
                                                    style={{ cursor: 'grab' }}
                                                >
                                                    <td className="p-1 text-center">
                                                        <div className="flex items-center justify-center pl-4">
                                                            <button
                                                                onClick={() => toggleHijo(hijoKey)}
                                                                onMouseDown={e => e.stopPropagation()}
                                                                className="text-amber-400/60 transition-colors hover:text-amber-300">
                                                                {isHijoExp
                                                                    ? <ChevronDown size={11} />
                                                                    : <ChevronRight size={11} />}
                                                            </button>
                                                        </div>
                                                    </td>

                                                    <td className="py-1 pl-6 pr-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="shrink-0 rounded bg-slate-700/70 px-1 py-0.5 font-mono text-[9px] font-bold text-sky-400/80">
                                                                {idx.code}
                                                            </span>
                                                            <span className={isPrimary
                                                                ? 'font-semibold text-amber-200/80'
                                                                : 'text-slate-300'}>
                                                                {idx.descripcion}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-1 text-center text-[9px] text-slate-700">—</td>

                                                    {/* Coeficiente hijo — editable */}
                                                    <td className="py-1 pr-2 text-right">
                                                        {isEditing ? (
                                                            <input autoFocus defaultValue={fmtDef(idx.coefDefinido)}
                                                                className="w-20 rounded border border-emerald-500 bg-slate-900 px-1 py-0.5 text-right font-mono text-[10px] text-emerald-300 outline-none"
                                                                onBlur={e => saveCoef(mono.id, idx.code, e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') saveCoef(mono.id, idx.code, (e.target as HTMLInputElement).value); }} />
                                                        ) : (
                                                            <button
                                                                onClick={() => setEditingCoef({ mId: mono.id, code: idx.code })}
                                                                onMouseDown={e => e.stopPropagation()}
                                                                className="group inline-flex w-full items-center justify-end gap-0.5 rounded px-1 py-0.5 font-mono text-[11px] font-bold text-slate-300 hover:bg-slate-800">
                                                                {fmtDef(idx.coefDefinido)}
                                                                <Pencil size={7} className="text-slate-600 opacity-0 group-hover:opacity-100" />
                                                            </button>
                                                        )}
                                                    </td>

                                                    {/* % dentro del monomio */}
                                                    <td className="py-1 pr-2 text-right font-mono text-[10px] text-slate-500">
                                                        {fmtPct(pct)}
                                                    </td>

                                                    {/* Extraer (solo índices secundarios) */}
                                                    <td className="p-1 text-right">
                                                        {!isPrimary && (
                                                            <button
                                                                onClick={() => extractIndex(mono.id, idx.code)}
                                                                onMouseDown={e => e.stopPropagation()}
                                                                title="Extraer como monomio independiente"
                                                                className="rounded p-0.5 text-slate-700 transition-colors hover:bg-slate-700 hover:text-violet-400">
                                                                <LogOut size={11} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* NIVEL 3: hijo del hijo — draggable igual que el padre */}
                                                {isHijoExp && (
                                                    <tr
                                                        draggable
                                                        onDragStart={e => onDragStart(e, mono.id)}
                                                        onDragEnd={onDragEnd}
                                                        onDragOver={e => onDragOver(e, mono.id)}
                                                        onDragLeave={e => onDragLeave(e, mono.id)}
                                                        onDrop={e => onDrop(e, mono.id)}
                                                        className={[
                                                            'border-b border-slate-800/40 bg-slate-950',
                                                            isDragging ? 'opacity-40' : '',
                                                        ].filter(Boolean).join(' ')}
                                                        style={{ cursor: 'grab' }}
                                                    >
                                                        <td className="p-1 text-center text-[10px] text-slate-700">└</td>
                                                        <td className="py-1.5 pl-12 pr-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[9px] text-slate-500">{idx.code}</span>
                                                                <span className="text-slate-400">{idx.descripcion}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-1 text-center text-[9px] text-slate-700">—</td>
                                                        <td className="p-1 pr-2 text-right font-mono text-[10px] text-slate-500"
                                                            title="Coeficiente calculado desde ACU">
                                                            {fmtDef(idx.coefCalculado)}
                                                        </td>
                                                        <td className="py-1.5 pr-2 text-right font-mono text-[9px] italic text-slate-600">
                                                            calc
                                                        </td>
                                                        <td />
                                                    </tr>
                                                )}

                                            </React.Fragment>
                                        );
                                    })}

                                </React.Fragment>
                            );
                        })}
                    </tbody>

                    {/* ── Total ─────────────────────────────────────────────── */}
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

                {/* ── Sin asignar ───────────────────────────────────────────── */}
                {available.length > 0 && (
                    <div className="border-t border-slate-800 bg-slate-900/60 p-2">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                            Sin asignar ({available.length}) — clic para agregar como monomio
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {available.map(idx => (
                                <button key={idx.code}
                                    onClick={() => addFromAvailable(idx)}
                                    className="flex cursor-pointer select-none items-center gap-1 rounded border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[9px] text-slate-500 transition-colors hover:border-sky-700 hover:text-sky-400">
                                    <Plus size={9} className="shrink-0 text-sky-600" />
                                    <span className="font-mono font-bold text-sky-600">{idx.code}</span>
                                    <span>{idx.descripcion.length > 18 ? idx.descripcion.slice(0, 18) + '…' : idx.descripcion}</span>
                                    <span className="font-mono text-slate-600">({fmtDef(idx.coefCalculado)})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {monomios.length === 0 && totalInsumo > 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                        <p className="text-sm">Sin monomios</p>
                        <button onClick={rebuild}
                            className="mt-2 rounded bg-sky-900/40 px-3 py-1 text-xs text-sky-300 transition-colors hover:bg-sky-800">
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

            {/* ── Nota normativa ─────────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-slate-800 px-3 py-1 text-[8px] uppercase tracking-wide text-slate-600">
                DS 011-79-VC · Máx. {MAX_MONOMIOS} monomios · Máx. {MAX_IDX_PER_MON} índices/monomio · Coef. mín. {(MIN_COEF_MON * 100).toFixed(0)}% · Σ = 1.000
            </div>
        </div>
    );
}
