/**
 * Selector de requisito normativo (EM.010 RNE Perú) para un ambiente.
 * Busca sobre el catálogo completo sembrado en BD (295 áreas).
 */

import { BookOpen, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NormativeRequirementRow } from '../engine/types';

interface Props {
    requirements: NormativeRequirementRow[];
    onSelect: (row: NormativeRequirementRow) => void;
    onClose: () => void;
}

export default function NormativePicker({ requirements, onSelect, onClose }: Props) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>('');

    const categories = useMemo(() => {
        const seen = new Map<string, string>();
        for (const r of requirements) {
            if (!seen.has(r.category_key)) {
                seen.set(r.category_key, r.category);
            }
        }
        return [...seen.entries()];
    }, [requirements]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return requirements.filter((r) => {
            if (category && r.category_key !== category) {
                return false;
            }
            if (!q) {
                return true;
            }
            return (
                r.area_name.toLowerCase().includes(q) ||
                r.category.toLowerCase().includes(q) ||
                (r.subcategory ?? '').toLowerCase().includes(q)
            );
        });
    }, [requirements, search, category]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-[#101218] shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-semibold text-zinc-100">Normativa EM.010 — Requisitos mínimos de iluminación</h3>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100" aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
                    <div className="relative min-w-52 flex-1">
                        <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar ambiente (aula, oficina, pasillo...)"
                            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pr-3 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
                        />
                    </div>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-zinc-100 focus:border-amber-500/60 focus:outline-none [&>option]:bg-[#15171f]">
                        <option value="">Todas las categorías</option>
                        {categories.map(([key, name]) => (
                            <option key={key} value={key}>
                                {key}. {name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {filtered.length === 0 ? (
                        <p className="py-8 text-center text-xs text-zinc-500">Sin resultados para la búsqueda.</p>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-[#101218] text-[10px] uppercase tracking-wide text-zinc-500">
                                <tr>
                                    <th className="px-2 py-1.5">Ambiente</th>
                                    <th className="px-2 py-1.5">Categoría</th>
                                    <th className="px-2 py-1.5 text-right">Em (lux)</th>
                                    <th className="px-2 py-1.5 text-right">UGRL</th>
                                    <th className="px-2 py-1.5 text-right">Uo</th>
                                    <th className="px-2 py-1.5 text-right">Ra</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map((row) => (
                                    <tr
                                        key={row.id}
                                        onClick={() => onSelect(row)}
                                        title={Array.isArray(row.requirements) ? row.requirements.join(' • ') : undefined}
                                        className="cursor-pointer text-zinc-200 transition hover:bg-amber-500/10">
                                        <td className="px-2 py-1.5">{row.area_name}</td>
                                        <td className="px-2 py-1.5 text-zinc-400">
                                            {row.category}
                                            {row.subcategory ? ` · ${row.subcategory}` : ''}
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-400">
                                            {row.em_lux ?? '—'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{row.ugrl ?? '—'}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{row.uo ?? '—'}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{row.ra ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="border-t border-white/10 px-4 py-2 text-[10px] text-zinc-500">
                    {filtered.length} de {requirements.length} áreas · Norma EM.010 RNE Perú. Los valores son parámetros técnicos oficiales.
                </div>
            </div>
        </div>
    );
}
