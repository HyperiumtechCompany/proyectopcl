// src/components/FormulaPolinomicaManualSelector.tsx

import { Plus, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormulaIndice {
    code: string;
    descripcion: string;
    coefCalculado: number;
    coefDefinido: number;
}

interface FormulaMonomio {
    id: string;
    nomenclatura: string;
    indices: FormulaIndice[];
}

interface Props {
    available: FormulaIndice[];
    monomios: FormulaMonomio[];
    onAddMonomio: (indices: FormulaIndice[], symbol: string) => void;
    onAddToExisting: (targetId: string, indices: FormulaIndice[]) => void;
    maxPerMonomio: number;
    maxMonomios: number;
    fmtDef: (n: number) => string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FormulaPolinomicaManualSelector({
    available,
    monomios,
    onAddMonomio,
    onAddToExisting,
    maxPerMonomio,
    maxMonomios,
    fmtDef,
}: Props) {

    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [symInput, setSymInput] = useState('');
    const [counter, setCounter] = useState(1);

    const toggleSelect = useCallback((code: string) => {
        setSelectedCodes(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedCodes(new Set());
    }, []);

    const handleCreateManual = useCallback(() => {
        if (selectedCodes.size === 0) {
            alert('Selecciona al menos un insumo');
            return;
        }
        if (selectedCodes.size > maxPerMonomio) {
            alert(`Máximo ${maxPerMonomio} insumos por monomio`);
            return;
        }
        if (monomios.length >= maxMonomios) {
            alert(`Máximo ${maxMonomios} monomios`);
            return;
        }

        const indices: FormulaIndice[] = [];
        for (const code of selectedCodes) {
            const found = available.find(a => a.code === code);
            if (found) {
                indices.push({
                    code: found.code,
                    descripcion: found.descripcion,
                    coefCalculado: found.coefCalculado,
                    coefDefinido: found.coefDefinido,
                });
            }
        }

        const symbol = symInput.trim().toUpperCase() || `M${counter}`;
        onAddMonomio(indices, symbol);

        setSelectedCodes(new Set());
        setSymInput('');
        setCounter(c => c + 1);
    }, [selectedCodes, available, monomios, symInput, counter, maxPerMonomio, maxMonomios, onAddMonomio]);

    const handleAddToExisting = useCallback((targetId: string) => {
        if (selectedCodes.size === 0) return;

        const indices: FormulaIndice[] = [];
        for (const code of selectedCodes) {
            const found = available.find(a => a.code === code);
            if (found) {
                indices.push({
                    code: found.code,
                    descripcion: found.descripcion,
                    coefCalculado: found.coefCalculado,
                    coefDefinido: found.coefDefinido,
                });
            }
        }

        const target = monomios.find(m => m.id === targetId);
        if (target && target.indices.length + indices.length > maxPerMonomio) {
            alert(`Máximo ${maxPerMonomio} insumos por monomio`);
            return;
        }

        onAddToExisting(targetId, indices);
        setSelectedCodes(new Set());
    }, [selectedCodes, available, monomios, maxPerMonomio, onAddToExisting]);

    if (available.length === 0) return null;

    return (
        <div className="border-t border-slate-800 bg-slate-900/60 p-2">

            {selectedCodes.size > 0 && (
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-900/50 bg-sky-900/20 px-3 py-1.5 mb-2">
                    <span className="text-xs text-sky-300">
                        {selectedCodes.size} seleccionado{selectedCodes.size !== 1 ? 's' : ''}
                    </span>
                    {selectedCodes.size > maxPerMonomio && (
                        <span className="text-[10px] text-amber-400">
                            Máx. {maxPerMonomio} por monomio
                        </span>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                        <input
                            className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-center text-xs font-mono font-bold text-emerald-300 outline-none placeholder-slate-600 focus:border-emerald-500 uppercase"
                            placeholder="Símbolo"
                            maxLength={4}
                            value={symInput}
                            onChange={(e) => setSymInput(e.target.value)}
                        />
                        <button
                            disabled={selectedCodes.size === 0 || selectedCodes.size > maxPerMonomio || monomios.length >= maxMonomios}
                            onClick={handleCreateManual}
                            className="flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                        >
                            <Plus size={11} /> Nuevo monomio
                        </button>
                        {monomios.length > 0 && (
                            <select
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none"
                                defaultValue=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) handleAddToExisting(val);
                                    e.target.value = '';
                                }}
                            >
                                <option value="">Agregar a…</option>
                                {monomios.map((m) => {
                                    const free = maxPerMonomio - m.indices.length;
                                    return (
                                        <option
                                            key={m.id}
                                            value={m.id}
                                            disabled={free < 1 || selectedCodes.size > free}
                                        >
                                            {m.nomenclatura} — ({m.indices.length}/{maxPerMonomio})
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                        <button
                            className="rounded p-1 text-slate-500 hover:text-slate-300"
                            onClick={clearSelection}
                        >
                            <X size={11} />
                        </button>
                    </div>
                </div>
            )}

            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                Sin asignar ({available.length}) — haz clic para seleccionar
            </p>
            <div className="flex flex-wrap gap-1">
                {available.map(idx => {
                    const isSelected = selectedCodes.has(idx.code);
                    return (
                        <button
                            key={idx.code}
                            onClick={() => toggleSelect(idx.code)}
                            className={`flex cursor-pointer select-none items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] transition-colors ${
                                isSelected
                                    ? 'border-sky-500 bg-sky-900/50 text-sky-300'
                                    : 'border-slate-700 bg-slate-800/40 text-slate-500 hover:border-sky-700 hover:text-sky-400'
                            }`}
                        >
                            <span className="font-mono font-bold text-sky-600">{idx.code}</span>
                            <span>{idx.descripcion.length > 18 ? idx.descripcion.slice(0, 18) + '…' : idx.descripcion}</span>
                            <span className="font-mono text-slate-600">({fmtDef(idx.coefCalculado)})</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}